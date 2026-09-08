'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');
const { validatePayload, callAnthropic, publicErrorStatus, publicErrorMessage } = require('./lib/anthropic');

const ROOT = __dirname;
const PORT = Number(process.env.PORT) || 3000;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
  '.md': 'text/plain; charset=utf-8'
};

const BLOCKED = new Set(['.env', '.env.local', '.env.example']);

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return;
  const text = fs.readFileSync(filePath, 'utf8');
  text.split(/\r?\n/).forEach(function (line) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.charAt(0) === '#') return;
    const eq = trimmed.indexOf('=');
    if (eq < 1) return;
    const key = trimmed.slice(0, eq).trim();
    if (!/^[A-Z0-9_]+$/.test(key)) return;
    if (process.env[key]) return;
    let value = trimmed.slice(eq + 1).trim();
    if ((value.charAt(0) === '"' && value.charAt(value.length - 1) === '"') ||
        (value.charAt(0) === "'" && value.charAt(value.length - 1) === "'")) {
      value = value.slice(1, -1);
    }
    process.env[key] = value;
  });
}

loadEnvFile(path.join(ROOT, '.env'));

function send(res, status, headers, body) {
  res.writeHead(status, headers);
  res.end(body);
}

function sendJson(res, status, obj) {
  send(res, status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store'
  }, JSON.stringify(obj));
}

function isSafePath(urlPath) {
  if (!urlPath || urlPath.indexOf('..') !== -1) return false;
  if (urlPath.indexOf('\\') !== -1) return false;
  return true;
}

function resolveStatic(urlPath) {
  let rel = decodeURIComponent(urlPath.split('?')[0]);
  if (rel === '/') rel = '/index.html';
  if (!isSafePath(rel)) return null;

  const base = path.normalize(path.join(ROOT, rel));
  if (base !== ROOT && !base.startsWith(ROOT + path.sep)) return null;

  const name = path.basename(base);
  if (BLOCKED.has(name) || name.startsWith('.env') || name === '.git') return null;
  if (base.split(path.sep).indexOf('.git') !== -1) return null;
  return base;
}

function serveStatic(req, res) {
  const filePath = resolveStatic(req.url || '/');
  if (!filePath) {
    send(res, 403, { 'content-type': 'text/plain; charset=utf-8' }, 'Forbidden');
    return;
  }

  fs.stat(filePath, function (err, stat) {
    if (err || !stat.isFile()) {
      send(res, 404, { 'content-type': 'text/plain; charset=utf-8' }, 'Not found');
      return;
    }
    const ext = path.extname(filePath).toLowerCase();
    const type = MIME[ext] || 'application/octet-stream';
    res.writeHead(200, { 'content-type': type, 'cache-control': 'no-cache' });
    fs.createReadStream(filePath).pipe(res);
  });
}

function readBody(req, limit) {
  return new Promise(function (resolve, reject) {
    const chunks = [];
    let size = 0;
    req.on('data', function (chunk) {
      size += chunk.length;
      if (size > limit) {
        reject(Object.assign(new Error('payload too large'), { code: 'TOO_LARGE' }));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', function () {
      resolve(Buffer.concat(chunks).toString('utf8'));
    });
    req.on('error', reject);
  });
}

async function handleCaldris(req, res) {
  if (req.method === 'OPTIONS') {
    send(res, 204, {
      'access-control-allow-origin': '*',
      'access-control-allow-methods': 'POST, OPTIONS',
      'access-control-allow-headers': 'content-type'
    }, '');
    return;
  }
  if (req.method !== 'POST') {
    sendJson(res, 405, { error: 'Use POST.' });
    return;
  }

  let raw;
  try {
    raw = await readBody(req, 200000);
  } catch (err) {
    sendJson(res, err.code === 'TOO_LARGE' ? 413 : 400, { error: 'Could not read request.' });
    return;
  }

  let body;
  try {
    body = raw ? JSON.parse(raw) : {};
  } catch (e) {
    sendJson(res, 400, { error: 'Request must be JSON.' });
    return;
  }

  const checked = validatePayload(body);
  if (!checked.ok) {
    sendJson(res, 400, { error: checked.error });
    return;
  }

  try {
    const data = await callAnthropic(checked.payload);
    sendJson(res, 200, data);
  } catch (err) {
    sendJson(res, publicErrorStatus(err), {
      error: publicErrorMessage(err),
      offline_ok: err.code === 'NO_API_KEY'
    });
  }
}

function handleHealth(res) {
  sendJson(res, 200, {
    ok: true,
    live: !!process.env.ANTHROPIC_API_KEY,
    time: new Date().toISOString()
  });
}

const server = http.createServer(function (req, res) {
  const urlPath = (req.url || '/').split('?')[0];

  if (urlPath === '/api/health') {
    handleHealth(res);
    return;
  }
  if (urlPath === '/api/caldris') {
    handleCaldris(req, res).catch(function () {
      sendJson(res, 500, { error: 'Unexpected server error.' });
    });
    return;
  }
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    sendJson(res, 405, { error: 'Method not allowed.' });
    return;
  }
  serveStatic(req, res);
});

if (require.main === module) {
  server.listen(PORT, '127.0.0.1', function () {
    const live = process.env.ANTHROPIC_API_KEY ? 'live Claude ready' : 'offline lessons only (add ANTHROPIC_API_KEY to .env)';
    console.log('Caldris is running at http://127.0.0.1:' + PORT);
    console.log(live);
  });
}

module.exports = {
  server: server,
  resolveStatic: resolveStatic,
  loadEnvFile: loadEnvFile
};
