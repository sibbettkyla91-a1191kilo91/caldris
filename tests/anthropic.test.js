'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { validatePayload, callAnthropic, publicErrorStatus } = require('../lib/anthropic');
const core = require('../lib/caldris-core');

test('rejects missing messages', function () {
  const result = validatePayload({ system: 'hi' });
  assert.equal(result.ok, false);
});

test('rejects a bad role', function () {
  const result = validatePayload({
    messages: [{ role: 'system', content: 'nope' }]
  });
  assert.equal(result.ok, false);
});

test('accepts a normal chat payload and falls back on unknown models', function () {
  const result = validatePayload({
    system: 'You are Caldris',
    messages: [{ role: 'user', content: 'Start reading.' }],
    model: 'totally-fake-model',
    max_tokens: 900
  });
  assert.equal(result.ok, true);
  assert.equal(result.payload.model, core.DEFAULT_MODEL);
  assert.equal(result.payload.max_tokens, 900);
});

test('callAnthropic fails closed without a key', async function () {
  await assert.rejects(
    () => callAnthropic({
      system: 'x',
      messages: [{ role: 'user', content: 'hi' }],
      model: core.DEFAULT_MODEL,
      max_tokens: 20
    }, { apiKey: '', fetch: async function () { throw new Error('should not fetch'); } }),
    function (err) {
      return err.code === 'NO_API_KEY' && publicErrorStatus(err) === 503;
    }
  );
});

test('callAnthropic sends the Anthropic shape and returns content', async function () {
  let captured;
  const data = await callAnthropic({
    system: 'You are Caldris',
    messages: [{ role: 'user', content: 'Hello' }],
    model: core.DEFAULT_MODEL,
    max_tokens: 50
  }, {
    apiKey: 'test-key',
    fetch: async function (url, init) {
      captured = { url: url, init: init };
      return {
        ok: true,
        status: 200,
        text: async function () {
          return JSON.stringify({
            content: [{ type: 'text', text: 'Hello, Matthew.' }]
          });
        }
      };
    }
  });
  assert.equal(captured.init.headers['x-api-key'], 'test-key');
  assert.equal(JSON.parse(captured.init.body).messages[0].content, 'Hello');
  assert.equal(data.content[0].text, 'Hello, Matthew.');
});

test('unknown model 404 retries the default model', async function () {
  let calls = 0;
  const data = await callAnthropic({
    system: 'You are Caldris',
    messages: [{ role: 'user', content: 'Hello' }],
    model: 'claude-opus-4-6',
    max_tokens: 50
  }, {
    apiKey: 'test-key',
    fetch: async function (url, init) {
      calls += 1;
      const body = JSON.parse(init.body);
      if (body.model === 'claude-opus-4-6') {
        return {
          ok: false,
          status: 404,
          text: async function () { return JSON.stringify({ error: { message: 'not found' } }); }
        };
      }
      return {
        ok: true,
        status: 200,
        text: async function () {
          return JSON.stringify({ content: [{ type: 'text', text: 'Recovered.' }] });
        }
      };
    }
  });
  assert.equal(calls, 2);
  assert.equal(data.content[0].text, 'Recovered.');
});
