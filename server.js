#!/usr/bin/env node
/**
 * Caldris local development server.
 *
 * Serves the static single-page app (index.html) and implements the
 * `/api/caldris` endpoint that the frontend calls. In production this endpoint
 * is an AWS Lambda handler (see README); this server is the local stand-in so
 * the app can be exercised end-to-end during development.
 *
 * The handler is a thin proxy to the Anthropic Messages API: it injects the
 * server-side API key/version headers and forwards the request body, then
 * returns Anthropic's JSON response unchanged so the frontend can read
 * `data.content[].text`.
 *
 * Configuration (environment variables):
 *   PORT                 HTTP port to listen on (default 3000)
 *   HOST                 Interface to bind (default 0.0.0.0)
 *   ANTHROPIC_API_KEY    Anthropic API key. Required for live AI responses.
 *   ANTHROPIC_VERSION    Anthropic API version header (default 2023-06-01)
 *   ANTHROPIC_BASE_URL   Upstream base URL (default https://api.anthropic.com)
 *                        Useful for pointing tests at a local mock.
 *
 * Zero runtime dependencies — uses only the Node.js standard library.
 */

'use strict';

const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');

const PORT = parseInt(process.env.PORT || '3000', 10);
const HOST = process.env.HOST || '0.0.0.0';
const ANTHROPIC_BASE_URL = process.env.ANTHROPIC_BASE_URL || 'https://api.anthropic.com';
const ANTHROPIC_VERSION = process.env.ANTHROPIC_VERSION || '2023-06-01';
const ROOT = __dirname;

const STATIC_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

function sendJson(res, status, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
  });
  res.end(body);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', (c) => {
      size += c.length;
      if (size > 5 * 1024 * 1024) {
        reject(new Error('Request body too large'));
        req.destroy();
        return;
      }
      chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

/**
 * Forward a Messages request to the Anthropic API (or a mock upstream).
 * Returns { status, body } where body is the raw upstream response string.
 */
function callAnthropic(payload, apiKey) {
  return new Promise((resolve, reject) => {
    const upstream = new URL('/v1/messages', ANTHROPIC_BASE_URL);
    const data = Buffer.from(JSON.stringify(payload), 'utf8');
    const transport = upstream.protocol === 'http:' ? http : https;
    const reqOptions = {
      method: 'POST',
      hostname: upstream.hostname,
      port: upstream.port || (upstream.protocol === 'http:' ? 80 : 443),
      path: upstream.pathname,
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': data.length,
        'x-api-key': apiKey,
        'anthropic-version': ANTHROPIC_VERSION,
      },
    };
    const upstreamReq = transport.request(reqOptions, (upstreamRes) => {
      const parts = [];
      upstreamRes.on('data', (c) => parts.push(c));
      upstreamRes.on('end', () =>
        resolve({ status: upstreamRes.statusCode || 502, body: Buffer.concat(parts).toString('utf8') })
      );
    });
    upstreamReq.on('error', reject);
    upstreamReq.write(data);
    upstreamReq.end();
  });
}

async function handleCaldris(req, res) {
  if (req.method !== 'POST') {
    sendJson(res, 405, { error: 'Method not allowed' });
    return;
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    sendJson(res, 503, {
      error: 'ANTHROPIC_API_KEY is not configured on the server.',
      hint: 'Set the ANTHROPIC_API_KEY environment variable to enable live AI responses.',
    });
    return;
  }

  let parsed;
  try {
    parsed = JSON.parse((await readBody(req)) || '{}');
  } catch (e) {
    sendJson(res, 400, { error: 'Invalid JSON body' });
    return;
  }

  const payload = {
    model: parsed.model || 'claude-sonnet-4-20250514',
    max_tokens: parsed.max_tokens || 900,
    messages: Array.isArray(parsed.messages) ? parsed.messages : [],
  };
  if (parsed.system) payload.system = parsed.system;

  try {
    const upstream = await callAnthropic(payload, apiKey);
    res.writeHead(upstream.status, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(upstream.body);
  } catch (e) {
    sendJson(res, 502, { error: 'Failed to reach Anthropic API', detail: String(e && e.message) });
  }
}

function serveStatic(req, res) {
  const urlPath = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
  let rel = urlPath === '/' ? '/index.html' : urlPath;
  // Prevent path traversal.
  const resolved = path.normalize(path.join(ROOT, rel));
  if (!resolved.startsWith(ROOT)) {
    sendJson(res, 403, { error: 'Forbidden' });
    return;
  }
  fs.readFile(resolved, (err, buf) => {
    if (err) {
      sendJson(res, 404, { error: 'Not found' });
      return;
    }
    const type = STATIC_TYPES[path.extname(resolved).toLowerCase()] || 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': type, 'Content-Length': buf.length });
    res.end(buf);
  });
}

const server = http.createServer((req, res) => {
  const pathname = new URL(req.url, 'http://localhost').pathname;
  if (pathname === '/api/caldris') {
    handleCaldris(req, res).catch((e) => {
      sendJson(res, 500, { error: 'Internal server error', detail: String(e && e.message) });
    });
    return;
  }
  if (pathname === '/healthz') {
    sendJson(res, 200, { ok: true, anthropicKeyConfigured: Boolean(process.env.ANTHROPIC_API_KEY) });
    return;
  }
  serveStatic(req, res);
});

server.listen(PORT, HOST, () => {
  const keyState = process.env.ANTHROPIC_API_KEY ? 'configured' : 'MISSING';
  console.log(`Caldris dev server listening on http://${HOST}:${PORT}`);
  console.log(`  ANTHROPIC_API_KEY: ${keyState}`);
  console.log(`  Upstream: ${ANTHROPIC_BASE_URL}`);
});
