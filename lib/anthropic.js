'use strict';

const core = require('./caldris-core');

const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';
const ANTHROPIC_VERSION = '2023-06-01';
const MAX_MESSAGES = 40;
const MAX_CONTENT = 8000;
const MAX_SYSTEM = 20000;
const DEFAULT_MAX_TOKENS = 900;
const HARD_MAX_TOKENS = 2000;

function isPlainObject(value) {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function validatePayload(body) {
  if (!isPlainObject(body)) {
    return { ok: false, error: 'Request body must be a JSON object.' };
  }

  const system = body.system == null ? '' : String(body.system);
  if (system.length > MAX_SYSTEM) {
    return { ok: false, error: 'System prompt is too long.' };
  }

  if (!Array.isArray(body.messages) || body.messages.length === 0) {
    return { ok: false, error: 'messages must be a non-empty array.' };
  }
  if (body.messages.length > MAX_MESSAGES) {
    return { ok: false, error: 'Too many messages in this request.' };
  }

  const messages = [];
  for (let i = 0; i < body.messages.length; i++) {
    const item = body.messages[i];
    if (!isPlainObject(item)) {
      return { ok: false, error: 'Each message must be an object.' };
    }
    const role = item.role;
    if (role !== 'user' && role !== 'assistant') {
      return { ok: false, error: 'Message roles must be user or assistant.' };
    }
    const content = typeof item.content === 'string'
      ? item.content
      : Array.isArray(item.content)
        ? item.content.map(function (part) {
          if (typeof part === 'string') return part;
          if (part && typeof part.text === 'string') return part.text;
          return '';
        }).join('\n')
        : '';
    if (!content || !content.trim()) {
      return { ok: false, error: 'Each message needs text content.' };
    }
    if (content.length > MAX_CONTENT) {
      return { ok: false, error: 'A message is too long.' };
    }
    messages.push({ role: role, content: content });
  }

  let model = typeof body.model === 'string' && body.model.trim()
    ? body.model.trim()
    : core.DEFAULT_MODEL;
  if (core.ALLOWED_MODELS.indexOf(model) === -1) {
    model = core.DEFAULT_MODEL;
  }

  let maxTokens = Number(body.max_tokens);
  if (!Number.isFinite(maxTokens) || maxTokens < 1) maxTokens = DEFAULT_MAX_TOKENS;
  maxTokens = Math.min(Math.round(maxTokens), HARD_MAX_TOKENS);

  return {
    ok: true,
    payload: {
      system: system,
      messages: messages,
      model: model,
      max_tokens: maxTokens
    }
  };
}

async function callAnthropic(payload, options) {
  options = options || {};
  const apiKey = options.apiKey || process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    const err = new Error('ANTHROPIC_API_KEY is not set');
    err.code = 'NO_API_KEY';
    throw err;
  }

  const fetchFn = options.fetch || fetch;
  const url = options.url || ANTHROPIC_URL;
  const attempted = [];

  async function request(model) {
    attempted.push(model);
    const response = await fetchFn(url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': ANTHROPIC_VERSION
      },
      body: JSON.stringify({
        model: model,
        max_tokens: payload.max_tokens,
        system: payload.system,
        messages: payload.messages
      })
    });

    const raw = await response.text();
    let data = null;
    try { data = raw ? JSON.parse(raw) : null; } catch (e) { data = null; }

    return { response: response, data: data, raw: raw, model: model };
  }

  let result = await request(payload.model);
  if (result.response.status === 404 && payload.model !== core.DEFAULT_MODEL) {
    result = await request(core.DEFAULT_MODEL);
  }

  if (!result.response.ok) {
    const err = new Error('Anthropic request failed');
    err.code = 'ANTHROPIC_HTTP';
    err.status = result.response.status;
    err.details = result.data && result.data.error && result.data.error.message
      ? result.data.error.message
      : 'HTTP ' + result.response.status;
    err.attempted = attempted;
    throw err;
  }

  if (!result.data || !Array.isArray(result.data.content)) {
    const err = new Error('Unexpected Anthropic response');
    err.code = 'BAD_RESPONSE';
    throw err;
  }

  return result.data;
}

function publicErrorStatus(err) {
  if (!err) return 500;
  if (err.code === 'NO_API_KEY') return 503;
  if (err.status === 401 || err.status === 403) return 502;
  if (err.status === 429) return 429;
  if (err.status >= 500) return 502;
  if (err.status >= 400) return 502;
  return 500;
}

function publicErrorMessage(err) {
  if (!err) return 'The lesson service is unavailable.';
  if (err.code === 'NO_API_KEY') {
    return 'Live Caldris is not configured yet. Offline lessons still work.';
  }
  if (err.status === 429) return 'Caldris is busy. Please try again in a moment.';
  return 'Something went wrong reaching Caldris.';
}

module.exports = {
  ANTHROPIC_URL: ANTHROPIC_URL,
  validatePayload: validatePayload,
  callAnthropic: callAnthropic,
  publicErrorStatus: publicErrorStatus,
  publicErrorMessage: publicErrorMessage
};
