'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const { resolveStatic } = require('../server');

test('static resolver blocks .env and parent paths', function () {
  assert.equal(resolveStatic('/.env'), null);
  assert.equal(resolveStatic('/../.env'), null);
  assert.equal(resolveStatic('/lib/../../../.env'), null);
});

test('static resolver maps / to index.html inside the repo', function () {
  const filePath = resolveStatic('/');
  assert.equal(filePath, path.join(__dirname, '..', 'index.html'));
});
