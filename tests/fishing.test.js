'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fishing = require('../lib/fishing');

const TODAY = 'Thu Sep 10 2026';

function app(random, seed) {
  return fishing.create({
    storage: fishing.memoryStore(seed),
    today: TODAY,
    random: random || Math.random
  });
}

function scripted(values) {
  let i = 0;
  return function () {
    return values[i++] ?? 0;
  };
}

function alwaysFirstCommon() {
  let step = 0;
  return function () {
    const phase = step % 3;
    step += 1;
    return phase === 0 ? 0.16 : 0;
  };
}

test('cast odds are an editable 100-point table', function () {
  assert.equal(fishing.oddsTotal(), 100);
  const ids = fishing.CAST_ODDS.map(function (row) { return row.id; });
  assert.deepEqual(ids, ['nothing', 'common', 'uncommon', 'rare', 'exotic']);
  assert.equal(fishing.CAST_ODDS[0].chance, 15);
  assert.equal(fishing.CAST_ODDS[1].chance, 55);
  assert.equal(fishing.CAST_ODDS[2].chance, 20);
  assert.equal(fishing.CAST_ODDS[3].chance, 8);
  assert.equal(fishing.CAST_ODDS[4].chance, 2);
});

test('species pool covers four rarities with 15–20 names', function () {
  assert.ok(fishing.SPECIES.length >= 15 && fishing.SPECIES.length <= 20);
  assert.equal(fishing.speciesByRarity('common').length, 6);
  assert.equal(fishing.speciesByRarity('uncommon').length, 5);
  assert.equal(fishing.speciesByRarity('rare').length, 4);
  assert.equal(fishing.speciesByRarity('exotic').length, 4);
});

test('one cast per subject per day, max five', function () {
  const dock = app();
  assert.equal(dock.awardCast('reading').awarded, true);
  assert.equal(dock.awardCast('reading').awarded, false);
  assert.equal(dock.awardCast('writing').state.castsRemaining, 2);
  dock.awardCast('math');
  dock.awardCast('life');
  dock.awardCast('pe');
  assert.equal(dock.getState().castsRemaining, 5);
  assert.equal(dock.awardCast('bonus').awarded, false);
});

test('a new day resets casts but keeps the codex and gear', function () {
  const store = fishing.memoryStore();
  const monday = fishing.create({
    storage: store,
    today: 'Mon Sep 07 2026',
    random: function () { return 0.99; }
  });
  monday.awardCast('reading');
  monday.cast();
  const before = monday.getState();
  assert.ok(Object.keys(before.catches).length >= 1);

  const tuesday = fishing.create({ storage: store, today: TODAY, random: Math.random });
  const after = tuesday.getState();
  assert.equal(after.castsRemaining, 0);
  assert.deepEqual(after.earnedFrom, {});
  assert.deepEqual(after.catches, before.catches);
  assert.equal(after.gearSteps, before.gearSteps);
});

test('first catch is a codex entry; duplicates increment count and the trade-in bank', function () {
  const dock = app(scripted([
    0.20, 0, 0,
    0.20, 0, 0
  ]));
  const species = fishing.speciesByRarity('common')[0];
  dock.awardCast('reading');
  dock.awardCast('writing');
  const first = dock.cast();
  assert.equal(first.ok, true);
  assert.equal(first.caught, true);
  assert.equal(first.species.id, species.id);
  assert.equal(first.newSpecies, true);
  assert.equal(first.count, 1);
  assert.equal(first.gear.steps, 0);
  assert.equal(first.duplicateBank, 0);

  const second = dock.cast();
  assert.equal(second.caught, true);
  assert.equal(second.species.id, species.id);
  assert.equal(second.newSpecies, false);
  assert.equal(second.count, 2);
  assert.equal(second.duplicateBank, 1);
  assert.equal(second.gear.steps, 0);
});

test('five duplicate fish unlock the next cosmetic gear piece only', function () {
  const store = fishing.memoryStore({
    [fishing.STORAGE_KEY]: JSON.stringify({
      date: TODAY,
      castsRemaining: 6,
      earnedFrom: { reading: true },
      catches: {},
      duplicateBank: 0,
      gearSteps: 0
    })
  });
  const dock = fishing.create({
    storage: store,
    today: TODAY,
    random: alwaysFirstCommon()
  });
  const species = fishing.speciesByRarity('common')[0];
  for (let n = 0; n < 6; n++) dock.cast();
  const state = dock.getState();
  assert.equal(state.catches[species.id], 6);
  assert.equal(state.gearSteps, 1);
  assert.equal(state.duplicateBank, 0);
  const gear = fishing.gearFromSteps(1);
  assert.equal(gear.pole, 1);
  assert.equal(gear.reel, 0);
  assert.equal(gear.lure, 0);
  assert.equal(gear.nextPiece, 'reel');
});

test('gear steps never change cast odds', function () {
  const sequence = [0.10, 0.20, 0.80, 0.93, 0.99];
  function replay(steps) {
    let i = 0;
    const dock = app(function () {
      const v = sequence[i % sequence.length];
      i += 1;
      return v;
    });
    const storeState = dock.getState();
    storeState.gearSteps = steps;
    dock.awardCast('reading');
    return [dock.rollCast(), dock.rollCast(), dock.rollCast(), dock.rollCast(), dock.rollCast()];
  }
  assert.deepEqual(replay(0), replay(9));
});

test('rolls use the live random function, not a date hash', function () {
  const dock = app(scripted([0.05, 0.40, 0.92]));
  assert.equal(dock.rollCast(), 'nothing');
  assert.equal(dock.rollCast(), 'common');
  assert.equal(dock.rollCast(), 'rare');
});

test('a miss spends a cast and never unlocks gear', function () {
  const dock = app(function () { return 0.05; });
  dock.awardCast('reading');
  const miss = dock.cast();
  assert.equal(miss.ok, true);
  assert.equal(miss.caught, false);
  assert.equal(miss.rarity, 'nothing');
  assert.ok(miss.line.length > 0);
  assert.equal(dock.getState().castsRemaining, 0);
  assert.equal(dock.getState().gearSteps, 0);
  assert.deepEqual(dock.getState().catches, {});
});

test('fishing storage is mq_fishing_v1 and does not write academy keys', function () {
  const store = fishing.memoryStore();
  const dock = fishing.create({ storage: store, today: TODAY, random: function () { return 0.16; } });
  const session = { xp: 25, completed: { reading: true }, name: 'Matthew', pin: '1234' };
  const before = JSON.stringify(session);
  dock.awardCast('reading');
  dock.cast();
  assert.equal(JSON.stringify(session), before);
  assert.ok(store.getItem('mq_fishing_v1'));
  assert.equal(store.getItem('mq_acad_v3'), null);
  assert.equal(store.getItem('mq_profile_v1'), null);
  assert.equal(store.getItem('mq_levels_v1'), null);
  assert.equal(fishing.STORAGE_KEY, 'mq_fishing_v1');
});
