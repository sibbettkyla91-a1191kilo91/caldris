'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const voice = require('../lib/voice');

test('sentence split keeps the leftover clause and the full thought', function () {
  const text = 'Start at 3. Count on 4. Write 7';
  const parts = voice.splitSentences(text);
  assert.deepEqual(parts, ['Start at 3.', 'Count on 4.', 'Write 7']);
  assert.equal(parts.join(' '), text);
  assert.ok(parts.join(' ').length >= text.length - 2);
});

test('long teacher line is not truncated mid-clause', function () {
  const text = 'When we add, we start at the first number and count on. 2 + 3 is 3, then 4, then 5. How many is 2 + 3?';
  const parts = voice.splitSentences(text);
  const rebuilt = parts.join(' ');
  assert.equal(rebuilt, text);
  assert.ok(parts.length >= 2);
  assert.ok(parts[parts.length - 1].indexOf('How many') !== -1);
});

test('empty and punctuation-only text do not enqueue junk', function () {
  assert.deepEqual(voice.splitSentences(''), []);
  assert.deepEqual(voice.splitSentences('   '), []);
  assert.equal(voice.cleanSpeechText('**Hello** _Matthew_'), 'Hello Matthew');
});

test('re-render must not cancel speech; only user interrupt / skip / mute / leave / replay', function () {
  assert.equal(voice.shouldCancelSpeech('render'), false);
  assert.equal(voice.shouldCancelSpeech('advance'), false);
  assert.equal(voice.shouldCancelSpeech('claude-arrive'), false);
  assert.equal(voice.shouldCancelSpeech('queue'), false);
  assert.equal(voice.shouldCancelSpeech('user-question'), true);
  assert.equal(voice.shouldCancelSpeech('skip'), true);
  assert.equal(voice.shouldCancelSpeech('mute'), true);
  assert.equal(voice.shouldCancelSpeech('leave'), true);
  assert.equal(voice.shouldCancelSpeech('replay'), true);
});

test('queued speak without interrupt keeps the first line in lastText until a new enqueue replaces it', function () {
  const engine = voice.createVoiceEngine({});
  engine.enable();
  engine.speak('Hello Matthew. I am Caldris.', 'queue');
  const first = engine.getLastText();
  engine.speak('How many is 2 plus 3?', 'queue');
  assert.equal(engine.getLastText(), 'How many is 2 plus 3?');
  assert.equal(first, 'Hello Matthew. I am Caldris.');
  const debug = engine.getDebug();
  assert.equal(debug.full, 'How many is 2 plus 3?'.length);
});

test('replay speaks the same full last line', function () {
  const engine = voice.createVoiceEngine({});
  engine.enable();
  engine.speak('You earned the stamp. This room is done for today.', 'queue');
  engine.replay();
  assert.equal(engine.getLastText(), 'You earned the stamp. This room is done for today.');
  assert.equal(engine.getDebug().full, engine.getLastText().length);
});

test('kid voice picker prefers a friendly English name', function () {
  const voices = [
    { name: 'Zarvox', lang: 'en-US' },
    { name: 'Google UK English Female', lang: 'en-GB' },
    { name: 'Reed', lang: 'en-US' }
  ];
  const picked = voice.pickKidVoice(voices);
  assert.equal(picked.name, 'Google UK English Female');
});
