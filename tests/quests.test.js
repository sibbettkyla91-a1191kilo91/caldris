'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const quests = require('../lib/quests');

test('five daily subjects exist with XP that sums to the theater cap', function () {
  assert.equal(quests.SUBJECTS.length, 5);
  const ids = quests.SUBJECTS.map((s) => s.id);
  assert.deepEqual(ids, ['reading', 'writing', 'math', 'life', 'pe']);
  const xp = quests.SUBJECTS.reduce((n, s) => n + s.xp, 0);
  assert.equal(xp, 110);
});

test('daily packs shuffle by date but stay stable for the same day', function () {
  const a = quests.buildQuest('reading', 'Fri Sep 11 2026', 1);
  const b = quests.buildQuest('reading', 'Fri Sep 11 2026', 1);
  const c = quests.buildQuest('reading', 'Sat Sep 12 2026', 1);
  assert.equal(a.title, b.title);
  assert.equal(a.beats.length, b.beats.length);
  assert.ok(a.beats.length >= 3 && a.beats.length <= 6);
  assert.ok(c.title);
});

test('tap and type answers grade without shameful false completes', function () {
  const quest = quests.buildQuest('reading', 'Fri Sep 11 2026', 1);
  const tap = quest.beats.find((beat) => beat.type === 'tap');
  const typed = quest.beats.find((beat) => beat.type === 'type');
  assert.equal(quests.checkBeat(tap, tap.correct).correct, true);
  assert.equal(quests.checkBeat(tap, 'nope').correct, false);
  if (typed) {
    assert.equal(quests.checkBeat(typed, typed.accepted[0]).correct, true);
    assert.equal(quests.checkBeat(typed, '').correct, false);
  }
});

test('order beats require the full sequence', function () {
  const beat = {
    type: 'order',
    items: [{ id: 'a' }, { id: 'b' }, { id: 'c' }],
    correct: ['a', 'b', 'c']
  };
  assert.equal(quests.checkBeat(beat, ['a', 'b', 'c']).correct, true);
  assert.equal(quests.checkBeat(beat, ['c', 'b', 'a']).correct, false);
  assert.equal(quests.checkBeat(beat, ['a', 'b', 'c']).almost, false);
  assert.equal(quests.checkBeat(beat, ['c', 'b', 'a']).almost, true);
});

test('after misses, a type beat can scaffold into a choice', function () {
  const beat = { id: 't1', type: 'type', accepted: ['sun'], hint: 'clouds' };
  const scaffold = quests.scaffoldFor(beat);
  assert.equal(scaffold.type, 'tap');
  assert.equal(scaffold.correct, 'right');
  assert.equal(quests.checkBeat(scaffold, 'right').correct, true);
});

test('normalize treats spoken punctuation as typeable text', function () {
  assert.equal(quests.normalize('The Sun!'), 'the sun');
  assert.equal(quests.normalize('  Blue,  '), 'blue');
});
