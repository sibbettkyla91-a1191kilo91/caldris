'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const core = require('../lib/caldris-core');

const TODAY = 'Tue Sep 08 2026';
const YESTERDAY = 'Mon Sep 07 2026';

function setup(seed, today) {
  return core.create({
    storage: core.memoryStore(seed),
    today: today || TODAY,
    clock: function () { return '3:00 PM'; }
  });
}

test('profile survives a date change with the same storage', function () {
  const store = core.memoryStore();
  const monday = core.create({ storage: store, today: YESTERDAY });
  monday.completeSetup('Matthew', '2468');
  monday.saveSession(Object.assign(monday.getSession(), {
    xp: 75,
    completed: { reading: true, writing: true, math: true }
  }));

  const tuesday = core.create({ storage: store, today: TODAY });
  const session = tuesday.getSession();
  assert.equal(session.setupDone, true);
  assert.equal(session.name, 'Matthew');
  assert.equal(session.pin, '2468');
  assert.equal(session.date, TODAY);
  assert.equal(session.xp, 0);
  assert.deepEqual(session.completed, {});
  assert.equal(tuesday.getProfile().pin, '2468');
});

test('legacy session migrates name and PIN into a lasting profile', function () {
  const store = core.memoryStore();
  store.setItem(core.SESSION_KEY, JSON.stringify({
    date: YESTERDAY,
    name: 'Matthew',
    pin: '1357',
    setupDone: true,
    xp: 25,
    completed: { reading: true }
  }));

  const app = core.create({ storage: store, today: TODAY });
  const profile = app.getProfile();
  const session = app.getSession();
  assert.equal(profile.name, 'Matthew');
  assert.equal(profile.pin, '1357');
  assert.equal(session.xp, 0);
  assert.equal(session.setupDone, true);
});

test('TV unlocks only with 75 XP and at least 3 subjects', function () {
  const reading = core.subjectById('reading');
  const writing = core.subjectById('writing');
  const pe = core.subjectById('pe');
  let session = core.emptyDay(TODAY, { name: 'Matthew', pin: '0000', setupDone: true });
  let levels = {};
  let shared = { date: TODAY, academy: {} };

  session = core.applyQuestComplete(session, levels, shared, reading).session;
  session = core.applyQuestComplete(session, levels, shared, writing).session;
  assert.equal(core.tvUnlocked(session), false);

  session = core.applyQuestComplete(session, levels, shared, pe).session;
  assert.equal(session.xp, 65);
  assert.equal(core.tvUnlocked(session), false);

  const math = core.subjectById('math');
  session = core.applyQuestComplete(session, levels, shared, math).session;
  assert.equal(session.xp, 90);
  assert.equal(core.completedCount(session), 4);
  assert.equal(core.tvUnlocked(session), true);
});

test('completing the same subject twice does not double XP', function () {
  const reading = core.subjectById('reading');
  let session = core.emptyDay(TODAY, { name: 'Matthew', pin: '0000', setupDone: true });
  const first = core.applyQuestComplete(session, {}, { academy: {} }, reading);
  const second = core.applyQuestComplete(first.session, first.levels, first.shared, reading);
  assert.equal(second.session.xp, 25);
});

test('three completed sessions raise a subject level', function () {
  const math = core.subjectById('math');
  let session = core.emptyDay(TODAY, { name: 'Matthew', pin: '0000', setupDone: true });
  let levels = {};
  let shared = { academy: {} };
  for (let i = 0; i < 3; i++) {
    session.completed = {};
    const next = core.applyQuestComplete(session, levels, shared, math);
    session = next.session;
    levels = next.levels;
    shared = next.shared;
  }
  assert.equal(levels.math, 2);
  assert.equal(levels.math_sessions, 3);
});

test('parent toggle adds and removes XP cleanly', function () {
  let session = core.emptyDay(TODAY, { name: 'Matthew', pin: '0000', setupDone: true });
  session = core.toggleQuest(session, 'reading');
  assert.equal(session.xp, 25);
  assert.equal(session.completed.reading, true);
  session = core.toggleQuest(session, 'reading');
  assert.equal(session.xp, 0);
  assert.equal(session.completed.reading, undefined);
});

test('resetDay clears today but keeps the profile', function () {
  const app = setup();
  app.completeSetup('Matthew', '2468');
  app.saveSession(Object.assign(app.getSession(), {
    xp: 40,
    completed: { pe: true },
    incidents: [{ text: 'late start', time: '9:00 AM' }]
  }));
  app.saveSummary('pe', [{ role: 'caldris', text: 'Go walk.' }, { role: 'user', text: 'done' }]);

  const fresh = app.resetDay();
  assert.equal(fresh.xp, 0);
  assert.deepEqual(fresh.completed, {});
  assert.deepEqual(fresh.incidents, []);
  assert.equal(fresh.name, 'Matthew');
  assert.equal(app.getProfile().pin, '2468');
  assert.equal(app.getSummaries()[TODAY], undefined);
});

test('setup rejects a short PIN', function () {
  const app = setup();
  const result = app.completeSetup('Matthew', '12');
  assert.equal(result.ok, false);
  assert.equal(app.getProfile(), null);
});

test('formatCaldrisHtml escapes markup before bold', function () {
  const html = core.formatCaldrisHtml('Use <script>alert(1)</script> and **bold**');
  assert.equal(html.includes('<script>'), false);
  assert.equal(html.includes('<strong>bold</strong>'), true);
  assert.equal(html.includes('&lt;script&gt;'), true);
});

test('helped items award zero XP share and log an incident', function () {
  const reading = core.subjectById('reading');
  let session = core.emptyDay(TODAY, { name: 'Matthew', pin: '0000', setupDone: true });
  const next = core.applyQuestComplete(session, {}, { academy: {} }, reading, {
    subjectId: 'reading',
    correct: 2,
    helped: 1,
    total: 3
  });
  assert.equal(next.session.xp, 17);
  assert.equal(next.session.completed.reading, true);
  assert.equal(next.session.incidents.length, 1);
  assert.match(next.session.incidents[0].text, /completed with help/i);
});

test('a fully helped lesson awards no XP but still marks the subject done', function () {
  const math = core.subjectById('math');
  let session = core.emptyDay(TODAY, { name: 'Matthew', pin: '0000', setupDone: true });
  const next = core.applyQuestComplete(session, {}, { academy: {} }, math, {
    subjectId: 'math',
    correct: 0,
    helped: 4,
    total: 4
  });
  assert.equal(next.session.xp, 0);
  assert.equal(next.session.completed.math, true);
});
