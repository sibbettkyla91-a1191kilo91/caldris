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

test('static resolver allows the realm art files', function () {
  assert.equal(
    resolveStatic('/assets/caldris-main.jpg'),
    path.join(__dirname, '..', 'assets', 'caldris-main.jpg')
  );
  assert.equal(
    resolveStatic('/assets/sidekick.jpg'),
    path.join(__dirname, '..', 'assets', 'sidekick.jpg')
  );
});
