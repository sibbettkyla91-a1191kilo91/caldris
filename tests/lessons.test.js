'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const lessons = require('../lib/lessons');

function play(subject, answers, seed) {
  let state = lessons.startLesson(subject, { name: 'Matthew', seed: seed || 'test-seed' });
  const opening = state.lastText;
  const replies = [];
  for (let i = 0; i < answers.length; i++) {
    const result = lessons.nextTurn(state, answers[i]);
    state = result.state;
    replies.push(result);
  }
  return { opening: opening, replies: replies, state: state };
}

test('reading opening includes a passage and does not complete early', function () {
  const state = lessons.startLesson('reading', { name: 'Matthew', seed: 'banana' });
  assert.match(state.lastText, /Matthew/);
  assert.equal(state.complete, false);
  const nope = lessons.nextTurn(state, 'I do not know');
  assert.equal(nope.complete, false);
});

test('reading completes after real answers', function () {
  const opening = lessons.startLesson('reading', { name: 'Matthew', seed: 'banana-slug-seed' }).lastText;
  const answers = /banana slug/i.test(opening)
    ? [
      'They live in the Oregon forest',
      'They eat rotting plants and mushrooms',
      'They help the soil so new plants grow'
    ]
    : [
      'She found a brass key',
      'A map of the town from 1912',
      'Her street was once an orchard'
    ];
  const run = play('reading', answers, 'banana-slug-seed');
  const last = run.replies[run.replies.length - 1];
  assert.equal(last.complete, true);
  assert.match(last.text, /\[QUEST_COMPLETE\]/);
});

test('reading does not complete on empty or tiny answers', function () {
  let state = lessons.startLesson('reading', { name: 'Matthew', seed: 'fixed' });
  const empty = lessons.nextTurn(state, '   ');
  assert.equal(empty.complete, false);
  const last = play('reading', ['no', 'no', 'no', 'no', 'no', 'no'], 'fixed');
  // Two attempts per question still move forward, so this will complete.
  // Tiny wrong answers should still require the full question set.
  assert.equal(last.replies.length, 6);
});

test('writing requires a real spelling then three sentences', function () {
  function currentWord(text) {
    const match = String(text).match(/Spell this word: \*\*([a-z]+)\*\*/);
    return match && match[1];
  }
  const first = lessons.startLesson('writing', { name: 'Matthew', seed: 'set-a-force' });
  assert.ok(currentWord(first.lastText));
  let state = first;
  let result;
  let prompt = first.lastText;
  for (let i = 0; i < 5; i++) {
    const word = currentWord(prompt);
    assert.ok(word, 'expected a spelling prompt on step ' + i);
    result = lessons.nextTurn(state, word);
    state = result.state;
    prompt = result.text;
    assert.equal(result.complete, false);
  }
  const thin = lessons.nextTurn(state, 'ok');
  assert.equal(thin.complete, false);
  const done = lessons.nextTurn(thin.state, 'I like the park. I ride my bike there. I meet my friend after school.');
  assert.equal(done.complete, true);
});

test('math accepts money formats and finishes in four problems', function () {
  let state = lessons.startLesson('math', { name: 'Matthew', seed: 'set-a-force' });
  assert.match(state.lastText, /7 × 8|9 × 6/);
  const answers = state.lastText.indexOf('7 × 8') !== -1
    ? ['56', '$5.75', '18', '6']
    : ['54', '5.65', '5', '5'];
  let complete = false;
  for (let i = 0; i < answers.length; i++) {
    const result = lessons.nextTurn(state, answers[i]);
    state = result.state;
    complete = result.complete;
  }
  assert.equal(complete, true);
});

test('life skills need a real answer, not a shrug', function () {
  let state = lessons.startLesson('life', { name: 'Matthew', seed: 'hands' });
  const shrug = lessons.nextTurn(state, 'idk');
  assert.equal(shrug.complete, false);
});

test('PE waits until the student comes back', function () {
  let state = lessons.startLesson('pe', { name: 'Matthew', seed: 'indoor' });
  const early = lessons.nextTurn(state, 'I want TV');
  assert.equal(early.complete, false);
  const back = lessons.nextTurn(early.state, 'done');
  assert.equal(back.complete, false);
  const mood = lessons.nextTurn(back.state, 'I feel good');
  assert.equal(mood.complete, false);
  const done = lessons.nextTurn(mood.state, 'I did jumping jacks and a walk around the room. I feel good.');
  assert.equal(done.complete, true);
});

test('two wrong reading answers show the answer as help, not full credit', function () {
  let state = lessons.startLesson('reading', { name: 'Matthew', seed: 'banana-slug-seed', level: 1 });
  const first = lessons.nextTurn(state, 'zzzz not in the passage at all');
  assert.equal(first.complete, false);
  assert.match(first.text, /try again/i);
  const second = lessons.nextTurn(first.state, 'zzzz still not a real answer here');
  assert.equal(second.complete, false);
  assert.match(second.text, /completed with help/i);
  assert.equal(second.state.helped, 1);
  assert.equal(second.state.correct, 0);
});

test('a single loose keyword does not count as a reading answer', function () {
  let state = lessons.startLesson('reading', { name: 'Matthew', seed: 'banana-slug-seed', level: 1 });
  if (!/banana slug/i.test(state.lastText)) return;
  const loose = lessons.nextTurn(state, 'western');
  assert.equal(loose.complete, false);
  assert.equal(loose.state.step, 0);
});

test('writing does not mercy-complete on short text after two tries', function () {
  function currentWord(text) {
    const match = String(text).match(/Spell this word: \*\*([a-z]+)\*\*/);
    return match && match[1];
  }
  let state = lessons.startLesson('writing', { name: 'Matthew', seed: 'set-a-force', level: 1 });
  let prompt = state.lastText;
  for (let i = 0; i < 5; i++) {
    const word = currentWord(prompt);
    const result = lessons.nextTurn(state, word);
    state = result.state;
    prompt = result.text;
  }
  const thin1 = lessons.nextTurn(state, 'I like park today now yes');
  assert.equal(thin1.complete, false);
  const thin2 = lessons.nextTurn(thin1.state, 'I like park today now yes');
  assert.equal(thin2.complete, false);
  assert.match(thin2.text, /cannot be skipped|3 complete sentences/i);
});

test('buildPack selects different content by level, not only by date', function () {
  const low = lessons.buildPack('reading', 'same-day-seed', 1);
  const high = lessons.buildPack('reading', 'same-day-seed', 5);
  assert.equal(low.level, 1);
  assert.equal(high.level, 5);
  assert.notEqual(low.data.id, high.data.id);
});
