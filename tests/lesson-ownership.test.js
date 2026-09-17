'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const ownership = require('../lib/lesson-ownership');
const quests = require('../lib/quests');

const APP = fs.readFileSync(path.join(__dirname, '../js/app.js'), 'utf8');

function fnBody(name) {
  const start = APP.indexOf('function ' + name + '(');
  assert.ok(start !== -1, name + ' exists');
  const next = APP.indexOf('\n  function ', start + 1);
  return APP.slice(start, next === -1 ? undefined : next);
}

test('opening a quest does not invoke automatic lesson-start Claude', function () {
  const body = fnBody('openQuest');
  assert.doesNotMatch(body, /askClaude\s*\(/);
  assert.doesNotMatch(body, /lesson-start/);
  assert.match(APP, /function setCurriculumPrompt/);
  assert.match(APP, /function setTeacherFeedback/);
  assert.match(APP, /function invalidateClaude/);
});

test('opening a quest renders the current deterministic beat prompt', function () {
  const body = fnBody('openQuest');
  assert.match(body, /currentBeat\s*\(/);
  assert.match(body, /promptOnReopen|setCurriculumPrompt/);
  assert.doesNotMatch(body, /saved\.teacherLine/);
  const quest = quests.buildQuest('reading', 'Fri Sep 11 2026', 1);
  const beat = quest.beats[0];
  assert.equal(ownership.promptFromBeat(beat), beat.prompt);
  assert.ok(beat.prompt);
});

test('answer controls stay bound to the same beat as the prompt', function () {
  const quest = quests.buildQuest('reading', 'Fri Sep 11 2026', 1);
  const beat = ownership.liveBeat(quest, { beatIndex: 0, usingScaffold: false });
  assert.ok(beat.prompt);
  assert.equal(ownership.promptFromBeat(beat), beat.prompt);
  if (beat.type === 'tap') {
    assert.ok(Array.isArray(beat.options) && beat.options.length >= 2);
  }
  const sig = ownership.controlsSignature(beat);
  assert.ok(sig.startsWith(beat.type));
  const render = fnBody('renderBeat');
  assert.match(render, /currentBeat\s*\(/);
  assert.match(render, /beat\.options|beat\.items|beat\.spots/);
});

test('advancing a beat changes prompt and controls together', function () {
  const quest = quests.buildQuest('reading', 'Fri Sep 11 2026', 1);
  const start = { beatIndex: 0, claudeSeq: 1, usingScaffold: false, attempts: 0 };
  const a = ownership.liveBeat(quest, start);
  const next = ownership.afterCorrect(start);
  const b = ownership.liveBeat(quest, next);
  assert.equal(next.beatIndex, 1);
  assert.equal(next.claudeSeq, 2);
  assert.notEqual(ownership.promptFromBeat(a), ownership.promptFromBeat(b));
  assert.notEqual(ownership.controlsSignature(a), ownership.controlsSignature(b));
  const submit = fnBody('submitAnswer');
  assert.match(submit, /invalidateClaude\s*\(/);
  assert.match(submit, /beatIndex\s*\+=\s*1/);
  assert.match(submit, /renderBeat\s*\(/);
  assert.match(submit, /restateCurriculumPrompt|setCurriculumPrompt/);
  assert.doesNotMatch(submit, /combined|line \+ .*next\.prompt/);
});

test('a stale Claude sequence cannot overwrite the live beat', function () {
  let seq = 0;
  seq = ownership.nextSeq(seq);
  const requestForBeat0 = seq;
  const after = ownership.afterCorrect({ beatIndex: 0, claudeSeq: seq });
  assert.equal(ownership.isStale(requestForBeat0, after.claudeSeq), true);
  assert.equal(ownership.isStale(after.claudeSeq, after.claudeSeq), false);
  assert.equal(ownership.claudeMayWriteCurriculumPrompt(), false);
  const livePrompt = 'How many lanterns hung by the bridge?';
  const claudeText = 'What color is the lantern?';
  assert.equal(ownership.applyClaudeToPrompt(requestForBeat0, after.claudeSeq, livePrompt, claudeText), livePrompt);
  const ask = fnBody('askClaude');
  assert.match(ask, /seq !== claudeSeq/);
  assert.match(ask, /setTeacherFeedback\(result\.text/);
  assert.doesNotMatch(ask, /setCurriculumPrompt\(result\.text/);
  assert.doesNotMatch(ask, /setTeacherLine\(result\.text/);
});

test('scaffold activation changes the prompt and controls together', function () {
  const beat = { id: 't1', type: 'type', prompt: 'Spell river.', accepted: ['river'], hint: 'R-I-V-E-R' };
  const quest = { beats: [beat] };
  const start = { beatIndex: 0, claudeSeq: 3, usingScaffold: false, attempts: 2 };
  const scState = ownership.afterScaffold(start);
  const sc = ownership.liveBeat(quest, scState, quests.scaffoldFor);
  assert.equal(scState.beatIndex, 0);
  assert.equal(scState.usingScaffold, true);
  assert.equal(sc.type, 'tap');
  assert.ok(ownership.promptFromBeat(sc));
  assert.equal(ownership.promptFromBeat(sc), sc.prompt);
  assert.notEqual(ownership.promptFromBeat(sc), beat.prompt);
  assert.notEqual(ownership.controlsSignature(sc), ownership.controlsSignature(beat));
  const submit = fnBody('submitAnswer');
  assert.match(submit, /usingScaffold = true/);
  assert.match(submit, /invalidateClaude\s*\(/);
  assert.match(submit, /restateCurriculumPrompt|setCurriculumPrompt/);
});

test('reopening a saved quest uses the current deterministic beat prompt', function () {
  const beat = { prompt: 'What color is the lantern?', options: [{ id: 'a', label: 'gold' }] };
  const saved = { teacherLine: 'Count the fish. How many do you see?', beatIndex: 0 };
  assert.equal(ownership.promptOnReopen(beat, saved), 'What color is the lantern?');
  assert.notEqual(ownership.promptOnReopen(beat, saved), saved.teacherLine);
  const body = fnBody('openQuest');
  assert.match(body, /promptOnReopen|beat && beat\.prompt/);
  assert.doesNotMatch(body, /teacherLine = saved\.teacherLine/);
});

test('user-question Claude responses do not change the active curriculum beat', function () {
  assert.equal(ownership.claudeMayAdvanceBeat(), false);
  const start = { beatIndex: 2, usingScaffold: false, attempts: 1, claudeSeq: 4 };
  const after = ownership.afterUserQuestion(start);
  assert.equal(after.beatIndex, 2);
  assert.equal(after.usingScaffold, false);
  assert.equal(after.attempts, 1);
  const kid = fnBody('handleKidText');
  assert.match(kid, /askClaude\(clean,\s*'user-question'\)/);
  assert.doesNotMatch(kid, /beatIndex/);
  const ask = fnBody('askClaude');
  assert.doesNotMatch(ask, /beatIndex/);
  assert.doesNotMatch(ask, /usingScaffold\s*=/);
  assert.match(ask, /setTeacherFeedback/);
});

test('askClaude lesson-start is gone from the app shell', function () {
  assert.doesNotMatch(APP, /askClaude\([^)]*lesson-start/);
  assert.match(APP, /setTeacherFeedback/);
  assert.doesNotMatch(APP, /setTeacherLine\(/);
  const next = fnBody('handleNext');
  assert.doesNotMatch(next, /askClaude\s*\(/);
  assert.match(next, /restateCurriculumPrompt|setCurriculumPrompt/);
});

test('invalidateClaude runs on every curriculum ownership change', function () {
  ['openQuest', 'submitAnswer', 'handleNext', 'finishQuest', 'showHub', 'closeQuest'].forEach(function (name) {
    assert.match(fnBody(name), /invalidateClaude\s*\(/, name + ' invalidates pending Claude');
  });
});
