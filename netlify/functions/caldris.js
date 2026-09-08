/**
 * Netlify Function for the Caldris `/api/caldris` endpoint.
 *
 * This mirrors the proxy logic in `server.js` (the local dev server) so the app
 * can be deployed on Netlify. The repo's static files (index.html,
 * assets/images/*) are published directly and this function handles the API
 * call. A redirect in `netlify.toml` maps `/api/caldris` ->
 * `/.netlify/functions/caldris`, so the frontend keeps using its relative path.
 *
 * It is a thin proxy to the Anthropic Messages API: it injects the server-side
 * API key/version headers and forwards the request body, then returns
 * Anthropic's JSON response unchanged so the frontend can read
 * `data.content[].text`.
 *
 * Configuration (environment variables):
 *   ANTHROPIC_API_KEY    Anthropic API key. Required for live AI responses.
 *   ANTHROPIC_VERSION    Anthropic API version header (default 2023-06-01)
 *   ANTHROPIC_BASE_URL   Upstream base URL (default https://api.anthropic.com)
 *                        Useful for pointing tests at a local mock.
 *
 * Zero runtime dependencies — uses only the Node.js standard library, matching
 * server.js and avoiding any package.json requirement.
 */

'use strict';

const http = require('http');
const https = require('https');
const { URL } = require('url');

const ANTHROPIC_BASE_URL = process.env.ANTHROPIC_BASE_URL || 'https://api.anthropic.com';
const ANTHROPIC_VERSION = process.env.ANTHROPIC_VERSION || '2023-06-01';

function jsonResponse(statusCode, obj) {
  return {
    statusCode,
    headers: { 'content-type': 'application/json; charset=utf-8' },
    body: JSON.stringify(obj),
  };
}

/**
 * Forward a Messages request to the Anthropic API (or a mock upstream).
 * Returns { status, body } where body is the raw upstream response string.
 * Chooses http vs https based on the upstream protocol so a local http mock
 * works during testing.
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

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return jsonResponse(405, { error: 'Method not allowed' });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return jsonResponse(503, {
      error: 'ANTHROPIC_API_KEY is not configured on the server.',
      hint: 'Set the ANTHROPIC_API_KEY environment variable to enable live AI responses.',
    });
  }

  let parsed;
  try {
    const raw = event.isBase64Encoded
      ? Buffer.from(event.body || '', 'base64').toString('utf8')
      : event.body || '';
    parsed = JSON.parse(raw || '{}');
  } catch (e) {
    return jsonResponse(400, { error: 'Invalid JSON body' });
  }

  const payload = {
    model: parsed.model || 'claude-sonnet-5',
    max_tokens: parsed.max_tokens || 900,
    messages: Array.isArray(parsed.messages) ? parsed.messages : [],
  };
  if (parsed.system) payload.system = parsed.system;

  try {
    const upstream = await callAnthropic(payload, apiKey);
    return {
      statusCode: upstream.status,
      headers: { 'content-type': 'application/json; charset=utf-8' },
      body: upstream.body,
    };
  } catch (e) {
    return jsonResponse(502, { error: 'Failed to reach Anthropic API', detail: String(e && e.message) });
  }
};
