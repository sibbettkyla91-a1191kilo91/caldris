'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const progress = require('../lib/progress');

const TODAY = 'Fri Sep 11 2026';
const YESTERDAY = 'Thu Sep 10 2026';
const SUBJECTS = [
  { id: 'reading', xp: 25 },
  { id: 'writing', xp: 25 },
  { id: 'math', xp: 25 },
  { id: 'life', xp: 20 },
  { id: 'pe', xp: 15 }
];

function app(seed) {
  return progress.create({
    storage: progress.memoryStore(seed),
    today: TODAY,
    subjects: SUBJECTS
  });
}

test('a new day archives yesterday and starts a fresh session', function () {
  const store = progress.memoryStore({
    [progress.PROFILE_KEY]: JSON.stringify({ name: 'Matthew', pin: '2468', setupDone: true }),
    [progress.SESSION_KEY]: JSON.stringify({
      date: YESTERDAY,
      completed: { reading: true, math: true },
      xp: 50,
      incidents: [{ text: 'Needed a snack break', time: '10:15 AM' }],
      name: 'Matthew',
      pin: '2468',
      setupDone: true
    })
  });
  const acad = progress.create({ storage: store, today: TODAY, subjects: SUBJECTS });
  const session = acad.getSession();

  assert.equal(session.date, TODAY);
  assert.deepEqual(session.completed, {});
  assert.equal(session.xp, 0);
  assert.equal(session.name, 'Matthew');
  assert.equal(session.pin, undefined);
  assert.ok(acad.verifyPin('2468'));
  assert.ok(progress.isHashedPin(acad.getProfile().pin));

  const archived = acad.getHistory()[YESTERDAY];
  assert.ok(archived);
  assert.deepEqual(archived.completed, { reading: true, math: true });
  assert.equal(archived.xp, 50);
  assert.equal(archived.incidents.length, 1);
  assert.equal(archived.pin, undefined);
  assert.equal(JSON.parse(store.getItem(progress.HISTORY_KEY))[YESTERDAY].pin, undefined);
});

test('profile name and PIN migrate off a stale session before rollover', function () {
  const acad = progress.create({
    storage: progress.memoryStore({
      [progress.SESSION_KEY]: JSON.stringify({
        date: YESTERDAY,
        completed: { pe: true },
        xp: 15,
        name: 'Matthew',
        pin: '1357',
        setupDone: true
      })
    }),
    today: TODAY,
    subjects: SUBJECTS
  });

  const session = acad.getSession();
  const profile = acad.getProfile();
  assert.equal(profile.name, 'Matthew');
  assert.ok(acad.verifyPin('1357'));
  assert.ok(progress.isHashedPin(profile.pin));
  assert.notEqual(profile.pin, '1357');
  assert.equal(session.name, 'Matthew');
  assert.equal(session.pin, undefined);
  assert.equal(acad.getHistory()[YESTERDAY].xp, 15);
});

test('parent report for yesterday uses the archive', function () {
  const acad = app();
  acad.saveProfile({ name: 'Matthew', pin: '2468', setupDone: true });
  acad.saveSession({
    date: YESTERDAY,
    completed: { reading: true, writing: true, math: true },
    xp: 75,
    incidents: []
  });

  const report = acad.getDayReport(YESTERDAY);
  assert.equal(report.isToday, false);
  assert.equal(report.source, 'history');
  assert.equal(report.xp, 75);
  assert.equal(Object.keys(report.completed).length, 3);
  assert.equal(report.name, 'Matthew');
});

test('yesterday transcripts still show after a rollover with no archive', function () {
  const acad = progress.create({
    storage: progress.memoryStore({
      [progress.SUMMARY_KEY]: JSON.stringify({
        [YESTERDAY]: {
          reading: {
            messages: [{ role: 'user', text: 'The fox hid.' }, { role: 'caldris', text: 'Yes!' }],
            completedAt: '11:04 AM'
          },
          math: {
            messages: [{ role: 'user', text: '12' }],
            completedAt: '11:40 AM'
          }
        }
      })
    }),
    today: TODAY,
    subjects: SUBJECTS
  });

  const report = acad.getDayReport(YESTERDAY);
  assert.equal(report.source, 'summaries');
  assert.equal(report.completed.reading, true);
  assert.equal(report.completed.math, true);
  assert.equal(report.xp, 50);
  assert.ok(report.summaries.reading.messages.length >= 1);
});

test('today stays live and is not confused with yesterday', function () {
  const acad = app();
  acad.saveProfile({ name: 'Matthew', pin: '2468', setupDone: true });
  acad.saveSession({
    date: TODAY,
    completed: { life: true },
    xp: 20,
    name: 'Matthew',
    pin: '2468',
    setupDone: true
  });

  const today = acad.getDayReport(TODAY);
  const yesterday = acad.getDayReport(YESTERDAY);
  assert.equal(today.isToday, true);
  assert.equal(today.xp, 20);
  assert.equal(today.completed.life, true);
  assert.equal(yesterday.isToday, false);
  assert.equal(yesterday.xp, 0);
  assert.equal(acad.hasReport(YESTERDAY), false);
  assert.equal(acad.hasReport(TODAY), true);
});

test('date list includes yesterday and neighborDate pages across days', function () {
  const acad = app();
  const dates = acad.listReportDates();
  assert.ok(dates.includes(TODAY));
  assert.ok(dates.includes(YESTERDAY));
  assert.equal(dates[dates.length - 1], TODAY);
  assert.equal(acad.neighborDate(TODAY, -1), YESTERDAY);
  assert.equal(acad.neighborDate(TODAY, 1), null);
  assert.equal(acad.yesterdayDate(), YESTERDAY);
  assert.equal(progress.formatReportDate(YESTERDAY), 'Thursday, September 10, 2026');
});

test('saveSummary stores transcripts under today without wiping other days', function () {
  const acad = progress.create({
    storage: progress.memoryStore({
      [progress.SUMMARY_KEY]: JSON.stringify({
        [YESTERDAY]: { pe: { messages: [{ role: 'user', text: 'I ran.' }], completedAt: '3:00 PM' } }
      })
    }),
    today: TODAY,
    subjects: SUBJECTS
  });
  acad.saveSummary('reading', [
    { role: 'system', text: 'hidden' },
    { role: 'caldris', text: 'Hello' },
    { role: 'user', text: 'Hi' }
  ], '9:15 AM');

  const all = acad.getSummaries();
  assert.ok(all[YESTERDAY].pe);
  assert.equal(all[TODAY].reading.completedAt, '9:15 AM');
  assert.equal(all[TODAY].reading.messages.length, 2);
});

test('completing a subject adds XP up to the daily cap', function () {
  const acad = app();
  acad.saveProfile({ name: 'Matthew', pin: '2468', setupDone: true });
  const first = acad.completeSubject('reading');
  assert.equal(first.awarded, true);
  assert.equal(first.xp, 25);
  assert.equal(acad.completeSubject('reading').awarded, false);
  acad.completeSubject('writing');
  acad.completeSubject('math');
  acad.completeSubject('life');
  acad.completeSubject('pe');
  assert.equal(acad.getSession().xp, acad.dailyXpCap());
  assert.equal(acad.dailyXpCap(), 110);
});

test('screen time unlocks only when all required quests are done', function () {
  const acad = app();
  acad.saveProfile({ name: 'Matthew', pin: '2468', setupDone: true });
  acad.completeSubject('reading');
  acad.completeSubject('writing');
  acad.completeSubject('math');
  const s = acad.getSession();
  s.xp = 200;
  acad.saveSession(s);
  assert.equal(acad.isTvUnlocked(), false);
  acad.completeSubject('life');
  acad.completeSubject('pe');
  assert.equal(acad.isTvUnlocked(), true);
  assert.equal(acad.countDone(), 5);
});

test('parent override can unlock or re-lock TV and writes the incident log', function () {
  const acad = app();
  acad.saveProfile({ name: 'Matthew', pin: '2468', setupDone: true });
  assert.equal(acad.isTvUnlocked(), false);
  acad.setTvForce('unlock', 'Parent unlocked TV today (override).');
  assert.equal(acad.isTvUnlocked(), true);
  assert.equal(acad.getSession().incidents.length, 1);
  acad.setTvForce('lock', 'Parent re-locked TV.');
  assert.equal(acad.isTvUnlocked(), false);
  assert.equal(acad.getSession().incidents.length, 2);
});

test('reset for a new day clears child progress and re-locks TV', function () {
  const acad = app();
  acad.saveProfile({ name: 'Matthew', pin: '2468', setupDone: true });
  acad.completeSubject('reading');
  acad.completeSubject('writing');
  acad.completeSubject('math');
  acad.completeSubject('life');
  acad.completeSubject('pe');
  acad.addIncident('Needed a stretch break');
  assert.equal(acad.isTvUnlocked(), true);
  assert.equal(acad.getProfile().streak, 1);

  const after = acad.resetDay();
  assert.deepEqual(after.completed, {});
  assert.equal(after.xp, 0);
  assert.equal(after.tvForce, null);
  assert.equal(acad.isTvUnlocked(), false);
  assert.equal(acad.verifyPin('2468'), true);
  assert.equal(acad.getProfile().name, 'Matthew');
  assert.equal(acad.getSession().incidents.length, 1);
  assert.equal(acad.getProfile().streak, 0);
});

test('mid-quest beat progress is saved and does not complete the subject', function () {
  const acad = app();
  acad.saveQuestState('math', { beatIndex: 2, attempts: 1, log: [{ role: 'user', text: '5' }] });
  const state = acad.getQuestState('math');
  assert.equal(state.beatIndex, 2);
  assert.equal(acad.getSession().completed.math, undefined);
  assert.equal(acad.isTvUnlocked(), false);
});

test('PIN stays hashed and a wrong PIN does not match', function () {
  const acad = app();
  acad.saveProfile({ name: 'Matthew', pin: '2468', setupDone: true });
  assert.ok(progress.isHashedPin(acad.getProfile().pin));
  assert.equal(acad.verifyPin('2468'), true);
  assert.equal(acad.verifyPin('0000'), false);
  assert.equal(acad.changePin('0000', '1357').ok, false);
  assert.equal(acad.changePin('2468', '1357').ok, true);
  assert.equal(acad.verifyPin('1357'), true);
  assert.equal(acad.verifyPin('2468'), false);
});

test('rank titles follow streak, not XP', function () {
  assert.equal(progress.rankForStreak(0).title, 'Adventurer');
  assert.equal(progress.rankForStreak(3).title, 'Pathfinder');
  assert.equal(progress.rankForStreak(7).title, 'Realm Keeper');
  assert.equal(progress.rankForStreak(14).title, 'Star Warden');
});
