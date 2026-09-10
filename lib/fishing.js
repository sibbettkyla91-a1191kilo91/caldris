(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.CaldrisFishing = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var STORAGE_KEY = 'mq_fishing_v1';
  var MAX_CASTS_PER_DAY = 5;
  var DUPES_PER_GEAR = 5;
  var GEAR_PIECES = ['pole', 'reel', 'lure'];

  // Edit these weights only — they must sum to 100.
  // rollCast() uses a fresh Math.random() each time (injectable for tests).
  var CAST_ODDS = [
    { id: 'nothing', chance: 15 },
    { id: 'common', chance: 55 },
    { id: 'uncommon', chance: 20 },
    { id: 'rare', chance: 8 },
    { id: 'exotic', chance: 2 }
  ];

  // Art filenames live in assets/fish/<id>.jpg (or the path on each row).
  // Drop matching images there — the UI hides a missing file and keeps the name.
  var SPECIES = [
    { id: 'bluegill', name: 'Bluegill', rarity: 'common', art: 'assets/fish/bluegill.jpg' },
    { id: 'yellow-perch', name: 'Yellow Perch', rarity: 'common', art: 'assets/fish/yellow-perch.jpg' },
    { id: 'creek-chub', name: 'Creek Chub', rarity: 'common', art: 'assets/fish/creek-chub.jpg' },
    { id: 'pumpkinseed', name: 'Pumpkinseed Sunfish', rarity: 'common', art: 'assets/fish/pumpkinseed.jpg' },
    { id: 'brown-bullhead', name: 'Brown Bullhead', rarity: 'common', art: 'assets/fish/brown-bullhead.jpg' },
    { id: 'prickly-sculpin', name: 'Prickly Sculpin', rarity: 'common', art: 'assets/fish/prickly-sculpin.jpg' },
    { id: 'rainbow-trout', name: 'Rainbow Trout', rarity: 'uncommon', art: 'assets/fish/rainbow-trout.jpg' },
    { id: 'largemouth-bass', name: 'Largemouth Bass', rarity: 'uncommon', art: 'assets/fish/largemouth-bass.jpg' },
    { id: 'smallmouth-bass', name: 'Smallmouth Bass', rarity: 'uncommon', art: 'assets/fish/smallmouth-bass.jpg' },
    { id: 'kokanee', name: 'Kokanee', rarity: 'uncommon', art: 'assets/fish/kokanee.jpg' },
    { id: 'mountain-whitefish', name: 'Mountain Whitefish', rarity: 'uncommon', art: 'assets/fish/mountain-whitefish.jpg' },
    { id: 'chinook-salmon', name: 'Chinook Salmon', rarity: 'rare', art: 'assets/fish/chinook-salmon.jpg' },
    { id: 'winter-steelhead', name: 'Winter Steelhead', rarity: 'rare', art: 'assets/fish/winter-steelhead.jpg' },
    { id: 'white-sturgeon', name: 'White Sturgeon', rarity: 'rare', art: 'assets/fish/white-sturgeon.jpg' },
    { id: 'bull-trout', name: 'Bull Trout', rarity: 'rare', art: 'assets/fish/bull-trout.jpg' },
    { id: 'golden-mirror-carp', name: 'Golden Mirror Carp', rarity: 'exotic', art: 'assets/fish/golden-mirror-carp.jpg' },
    { id: 'phantom-kokanee', name: 'Phantom Kokanee', rarity: 'exotic', art: 'assets/fish/phantom-kokanee.jpg' },
    { id: 'caldris-sunfish', name: 'Caldris Sunfish', rarity: 'exotic', art: 'assets/fish/caldris-sunfish.jpg' },
    { id: 'moonscale-bass', name: 'Moonscale Bass', rarity: 'exotic', art: 'assets/fish/moonscale-bass.jpg' }
  ];

  var CATCH_LINES = {
    common: [
      'Ha! A regular. Still counts. I never said I was picky before breakfast.',
      'That’s a fish. I knew this dock had opinions.',
      'Common? Sure. Also: on my stringer. You’re welcome.'
    ],
    uncommon: [
      'Now we’re talking. I almost used my serious hat.',
      'Uncommon. Which is my everyday mood, honestly.',
      'See? The water likes us. I told the water we were cool.'
    ],
    rare: [
      'RARE. Don’t blink. I will be insufferable about this for a week.',
      'I felt that one in my fins. Write it down. No, I’ll remember. Maybe write it down.',
      'That’s a story fish. I am already exaggerating the size.'
    ],
    exotic: [
      'EXOTIC. I am going to need a bigger story and a smaller audience of doubters.',
      'Did the realm just wink? Because that fish is not from a normal Tuesday.',
      'I knew the hat was lucky. Do not wash the hat.'
    ]
  };

  var MISS_LINES = [
    'Water said “not yet.” Water is dramatic. We stay.',
    'A nibble, a rumor, a splash — then nothing. Classic. Cast again when you’ve got one.',
    'They are laughing down there. Let them. We have time and snacks.',
    'Empty hook, full attitude. That’s still a cast I’ll brag about poorly.',
    'Missed. Not a failure — a scout. I mapped a square inch of river. Huge.'
  ];

  function memoryStore(seed) {
    var data = Object.assign({}, seed || {});
    return {
      getItem: function (key) {
        return Object.prototype.hasOwnProperty.call(data, key) ? data[key] : null;
      },
      setItem: function (key, value) {
        data[key] = String(value);
      },
      removeItem: function (key) {
        delete data[key];
      }
    };
  }

  function defaultStore() {
    if (typeof localStorage !== 'undefined') return localStorage;
    return memoryStore();
  }

  function parseJson(raw, fallback) {
    if (!raw) return fallback;
    try {
      return JSON.parse(raw);
    } catch (e) {
      return fallback;
    }
  }

  function emptyState(today) {
    return {
      date: today,
      castsRemaining: 0,
      earnedFrom: {},
      catches: {},
      duplicateBank: 0,
      gearSteps: 0
    };
  }

  function normalizeState(raw, today) {
    var state = Object.assign(emptyState(today), raw && typeof raw === 'object' ? raw : {});
    if (!state.catches || typeof state.catches !== 'object') state.catches = {};
    if (!state.earnedFrom || typeof state.earnedFrom !== 'object') state.earnedFrom = {};
    if (typeof state.castsRemaining !== 'number' || state.castsRemaining < 0) state.castsRemaining = 0;
    if (typeof state.duplicateBank !== 'number' || state.duplicateBank < 0) state.duplicateBank = 0;
    if (typeof state.gearSteps !== 'number' || state.gearSteps < 0) state.gearSteps = 0;
    if (state.date !== today) {
      state.date = today;
      state.castsRemaining = 0;
      state.earnedFrom = {};
    }
    return state;
  }

  function speciesById(id) {
    for (var i = 0; i < SPECIES.length; i++) {
      if (SPECIES[i].id === id) return SPECIES[i];
    }
    return null;
  }

  function speciesByRarity(rarity) {
    return SPECIES.filter(function (s) { return s.rarity === rarity; });
  }

  function oddsTotal() {
    return CAST_ODDS.reduce(function (sum, row) { return sum + row.chance; }, 0);
  }

  function pickWeighted(rand) {
    var roll = rand() * oddsTotal();
    var acc = 0;
    for (var i = 0; i < CAST_ODDS.length; i++) {
      acc += CAST_ODDS[i].chance;
      if (roll < acc) return CAST_ODDS[i].id;
    }
    return CAST_ODDS[CAST_ODDS.length - 1].id;
  }

  function pickOne(list, rand) {
    if (!list.length) return null;
    return list[Math.floor(rand() * list.length) % list.length];
  }

  function pickLine(list, rand) {
    return pickOne(list, rand) || '';
  }

  function gearFromSteps(steps) {
    return {
      pole: Math.floor((steps + 2) / 3),
      reel: Math.floor((steps + 1) / 3),
      lure: Math.floor(steps / 3),
      nextPiece: GEAR_PIECES[steps % 3],
      steps: steps
    };
  }

  function create(options) {
    options = options || {};
    var store = options.storage || defaultStore();
    var today = options.today || new Date().toDateString();
    var rand = options.random || Math.random;

    function read() {
      return normalizeState(parseJson(store.getItem(STORAGE_KEY), null), today);
    }

    function write(state) {
      try {
        store.setItem(STORAGE_KEY, JSON.stringify(state));
        return true;
      } catch (e) {
        return false;
      }
    }

    function awardCast(subjectId) {
      var state = read();
      if (!subjectId || state.earnedFrom[subjectId]) {
        return { awarded: false, castsRemaining: state.castsRemaining, state: state };
      }
      var earnedCount = Object.keys(state.earnedFrom).length;
      if (earnedCount >= MAX_CASTS_PER_DAY) {
        return { awarded: false, castsRemaining: state.castsRemaining, state: state };
      }
      state.earnedFrom[subjectId] = true;
      state.castsRemaining += 1;
      write(state);
      return { awarded: true, castsRemaining: state.castsRemaining, state: state };
    }

    function resetDaily() {
      var state = read();
      state.date = today;
      state.castsRemaining = 0;
      state.earnedFrom = {};
      write(state);
      return state;
    }

    function rollCast() {
      return pickWeighted(rand);
    }

    function cast() {
      var state = read();
      if (state.castsRemaining < 1) {
        return { ok: false, error: 'no_casts', state: state };
      }
      state.castsRemaining -= 1;

      var rarity = rollCast();
      if (rarity === 'nothing') {
        write(state);
        return {
          ok: true,
          caught: false,
          rarity: 'nothing',
          line: pickLine(MISS_LINES, rand),
          castsRemaining: state.castsRemaining,
          gear: gearFromSteps(state.gearSteps),
          newSpecies: false,
          state: state
        };
      }

      var fish = pickOne(speciesByRarity(rarity), rand);
      var prev = state.catches[fish.id] || 0;
      var isNew = prev === 0;
      state.catches[fish.id] = prev + 1;
      var traded = 0;
      if (!isNew) {
        state.duplicateBank += 1;
        while (state.duplicateBank >= DUPES_PER_GEAR) {
          state.duplicateBank -= DUPES_PER_GEAR;
          state.gearSteps += 1;
          traded += 1;
        }
      }
      write(state);
      return {
        ok: true,
        caught: true,
        rarity: rarity,
        species: fish,
        count: state.catches[fish.id],
        newSpecies: isNew,
        line: pickLine(CATCH_LINES[rarity] || CATCH_LINES.common, rand),
        gearGained: traded,
        gear: gearFromSteps(state.gearSteps),
        duplicateBank: state.duplicateBank,
        castsRemaining: state.castsRemaining,
        state: state
      };
    }

    return {
      getState: read,
      awardCast: awardCast,
      resetDaily: resetDaily,
      cast: cast,
      rollCast: rollCast,
      getGear: function () { return gearFromSteps(read().gearSteps); },
      getCodex: function () {
        var state = read();
        return SPECIES.map(function (s) {
          var count = state.catches[s.id] || 0;
          return {
            id: s.id,
            name: s.name,
            rarity: s.rarity,
            art: s.art,
            count: count,
            caught: count > 0
          };
        });
      }
    };
  }

  return {
    STORAGE_KEY: STORAGE_KEY,
    MAX_CASTS_PER_DAY: MAX_CASTS_PER_DAY,
    DUPES_PER_GEAR: DUPES_PER_GEAR,
    GEAR_PIECES: GEAR_PIECES,
    CAST_ODDS: CAST_ODDS,
    SPECIES: SPECIES,
    memoryStore: memoryStore,
    speciesById: speciesById,
    speciesByRarity: speciesByRarity,
    gearFromSteps: gearFromSteps,
    oddsTotal: oddsTotal,
    create: create
  };
});
