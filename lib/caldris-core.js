(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.CaldrisCore = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var PROFILE_KEY = 'mq_profile_v1';
  var LEVELS_KEY = 'mq_levels_v1';
  var SESSION_KEY = 'mq_acad_v3';
  var SHARED_KEY = 'mq_ecosystem_v1';
  var SUMMARY_KEY = 'mq_summaries_v1';
  var LAST_SCORE_KEY = 'mq_last_lesson_score_v1';
  var TV_XP = 75;
  var MIN_SUBJECTS_FOR_TV = 3;
  var SESSIONS_PER_LEVEL = 3;
  var HELPED_XP_SHARE = 0;

  var LEVEL_NAMES = ['Foundation', 'Building', 'Expanding', 'Advanced', 'Master'];

  var SUBJECTS = [
    { id: 'reading', name: 'Reading', desc: 'Passage + comprehension with Caldris', icon: '📖', xp: 25, color: '#4a7fa5', ibg: 'rgba(74,127,165,.14)', model: 'claude-sonnet-4-20250514', qbLink: ['reading'] },
    { id: 'writing', name: 'Writing & Spelling', desc: 'Spelling drill + writing prompt', icon: '✍️', xp: 25, color: '#7b5ea7', ibg: 'rgba(123,94,167,.14)', model: 'claude-sonnet-4-20250514', qbLink: ['writing', 'math'] },
    { id: 'math', name: 'Math', desc: 'Real-world problems with Caldris', icon: '🔢', xp: 25, color: '#2a8070', ibg: 'rgba(42,128,112,.14)', model: 'claude-sonnet-4-20250514', qbLink: ['writing', 'math'] },
    { id: 'life', name: 'Life Skills', desc: 'Practical knowledge for the real world', icon: '⚔️', xp: 20, color: '#9a7020', ibg: 'rgba(154,112,32,.12)', model: 'claude-sonnet-4-20250514', qbLink: [] },
    { id: 'pe', name: 'Physical Ed', desc: 'Movement quest — get outside', icon: '🏃', xp: 15, color: '#3d8a5c', ibg: 'rgba(61,138,92,.12)', model: 'claude-sonnet-4-20250514', qbLink: [] }
  ];

  var ALLOWED_MODELS = [
    'claude-sonnet-4-20250514',
    'claude-opus-4-6',
    'claude-sonnet-4-5',
    'claude-opus-4-1',
    'claude-3-5-sonnet-latest',
    'claude-3-5-haiku-latest'
  ];

  var DEFAULT_MODEL = 'claude-sonnet-4-20250514';

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

  function emptyDay(today, profile) {
    return {
      date: today,
      completed: {},
      xp: 0,
      incidents: [],
      name: profile && profile.name ? profile.name : '',
      pin: profile && profile.pin ? profile.pin : '',
      setupDone: !!(profile && profile.setupDone)
    };
  }

  function isUsableProfile(p) {
    return !!(p && p.setupDone && p.name && /^\d{4}$/.test(String(p.pin || '')));
  }

  function subjectById(id) {
    for (var i = 0; i < SUBJECTS.length; i++) {
      if (SUBJECTS[i].id === id) return SUBJECTS[i];
    }
    return null;
  }

  function completedCount(session) {
    var completed = (session && session.completed) || {};
    var n = 0;
    for (var i = 0; i < SUBJECTS.length; i++) {
      if (completed[SUBJECTS[i].id]) n++;
    }
    return n;
  }

  function tvUnlocked(session) {
    var xp = (session && session.xp) || 0;
    return xp >= TV_XP && completedCount(session) >= MIN_SUBJECTS_FOR_TV;
  }

  function readStoreItem(key) {
    try {
      if (typeof localStorage === 'undefined') return null;
      return localStorage.getItem(key);
    } catch (e) {
      return null;
    }
  }

  function removeStoreItem(key) {
    try {
      if (typeof localStorage !== 'undefined') localStorage.removeItem(key);
    } catch (e) {}
  }

  function parseLessonScore(raw) {
    if (!raw) return null;
    try {
      var score = typeof raw === 'string' ? JSON.parse(raw) : raw;
      if (!score || typeof score !== 'object') return null;
      var correct = Number(score.correct) || 0;
      var helped = Number(score.helped) || 0;
      var total = Number(score.total);
      if (!isFinite(total) || total < 1) total = correct + helped;
      if (total < 1) return null;
      return {
        subjectId: score.subjectId || '',
        correct: correct,
        helped: helped,
        total: total,
        items: Array.isArray(score.items) ? score.items : []
      };
    } catch (e) {
      return null;
    }
  }

  function takePendingLessonScore(subject) {
    var score = parseLessonScore(readStoreItem(LAST_SCORE_KEY));
    if (!score) return null;
    removeStoreItem(LAST_SCORE_KEY);
    if (subject && score.subjectId && score.subjectId !== subject.id) return null;
    return score;
  }

  function xpFromLessonScore(subject, score) {
    var full = subject && typeof subject.xp === 'number' ? subject.xp : 0;
    if (!score || !score.total) return full;
    var share = (score.correct + HELPED_XP_SHARE * score.helped) / score.total;
    if (share < 0) share = 0;
    if (share > 1) share = 1;
    return Math.round(full * share);
  }

  function applyQuestComplete(session, levels, shared, subject, score) {
    var nextSession = Object.assign({}, session, {
      completed: Object.assign({}, session.completed || {}),
      incidents: ((session && session.incidents) || []).slice()
    });
    var nextLevels = Object.assign({}, levels || {});
    var nextShared = Object.assign({}, shared || {}, {
      academy: Object.assign({}, (shared && shared.academy) || {})
    });

    var pending = parseLessonScore(score) || takePendingLessonScore(subject);
    var awarded = xpFromLessonScore(subject, pending);

    if (!nextSession.completed[subject.id]) {
      nextSession.completed[subject.id] = true;
      nextSession.xp = (nextSession.xp || 0) + awarded;
      if (pending && pending.helped > 0) {
        nextSession.incidents.push({
          text: subject.name + ': ' + pending.helped + ' item(s) completed with help (answer shown). Awarded ' + awarded + '/' + subject.xp + ' XP.',
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        });
      }
    }

    var sessKey = subject.id + '_sessions';
    var sess = (nextLevels[sessKey] || 0) + 1;
    nextLevels[sessKey] = sess;
    var curLv = nextLevels[subject.id] || 1;
    if (sess % SESSIONS_PER_LEVEL === 0 && curLv < 5) {
      nextLevels[subject.id] = curLv + 1;
    }

    if (subject.qbLink) {
      subject.qbLink.forEach(function (id) {
        nextShared.academy[id] = true;
      });
    }
    nextShared.academy[subject.id] = true;

    return { session: nextSession, levels: nextLevels, shared: nextShared };
  }

  function toggleQuest(session, subjectId) {
    var subject = subjectById(subjectId);
    if (!subject) return session;
    var next = Object.assign({}, session, {
      completed: Object.assign({}, session.completed || {})
    });
    if (!next.completed[subjectId]) {
      next.completed[subjectId] = true;
      next.xp = (next.xp || 0) + subject.xp;
    } else {
      delete next.completed[subjectId];
      next.xp = Math.max(0, (next.xp || 0) - subject.xp);
    }
    return next;
  }

  function escapeHtml(text) {
    return String(text == null ? '' : text)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function formatCaldrisHtml(text) {
    return escapeHtml(text)
      .replace(/\n/g, '<br>')
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  }

  function create(options) {
    options = options || {};
    var store = options.storage || defaultStore();
    var today = options.today || new Date().toDateString();

    function read(key, fallback) {
      return parseJson(store.getItem(key), fallback);
    }

    function write(key, value) {
      try {
        store.setItem(key, JSON.stringify(value));
        return true;
      } catch (e) {
        return false;
      }
    }

    function getProfile() {
      var stored = read(PROFILE_KEY, null);
      if (isUsableProfile(stored)) return stored;

      var legacy = read(SESSION_KEY, null);
      if (isUsableProfile(legacy)) {
        var migrated = { name: legacy.name, pin: String(legacy.pin), setupDone: true };
        write(PROFILE_KEY, migrated);
        return migrated;
      }
      return null;
    }

    function saveProfile(profile) {
      if (!isUsableProfile(profile)) return false;
      return write(PROFILE_KEY, {
        name: String(profile.name).trim(),
        pin: String(profile.pin),
        setupDone: true
      });
    }

    function getSession() {
      var profile = getProfile();
      var stored = read(SESSION_KEY, null);
      if (stored && stored.date === today) {
        if (profile) {
          stored.name = profile.name;
          stored.pin = profile.pin;
          stored.setupDone = true;
        }
        if (!stored.completed) stored.completed = {};
        if (!stored.incidents) stored.incidents = [];
        if (typeof stored.xp !== 'number') stored.xp = 0;
        return stored;
      }
      return emptyDay(today, profile);
    }

    function saveSession(session) {
      var profile = getProfile();
      var next = Object.assign({}, session, { date: today });
      if (profile) {
        next.name = profile.name;
        next.pin = profile.pin;
        next.setupDone = true;
      }
      return write(SESSION_KEY, next);
    }

    function getLevels() {
      var levels = read(LEVELS_KEY, {});
      return levels && typeof levels === 'object' ? levels : {};
    }

    function saveLevels(levels) {
      return write(LEVELS_KEY, levels || {});
    }

    function getShared() {
      var stored = read(SHARED_KEY, null);
      if (stored && stored.date === today) {
        if (!stored.academy) stored.academy = {};
        return stored;
      }
      return { date: today, academy: {} };
    }

    function saveShared(shared) {
      return write(SHARED_KEY, Object.assign({ date: today, academy: {} }, shared));
    }

    function getSummaries() {
      var all = read(SUMMARY_KEY, {});
      return all && typeof all === 'object' ? all : {};
    }

    function saveSummary(subjectId, messages) {
      var all = getSummaries();
      if (!all[today]) all[today] = {};
      all[today][subjectId] = {
        messages: (messages || []).filter(function (m) { return m && m.role !== 'system'; }).slice(-30),
        completedAt: options.clock
          ? options.clock()
          : new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };
      return write(SUMMARY_KEY, all);
    }

    function clearTodaySummaries() {
      var all = getSummaries();
      delete all[today];
      return write(SUMMARY_KEY, all);
    }

    function completeSetup(name, pin) {
      var profile = { name: String(name || '').trim(), pin: String(pin || ''), setupDone: true };
      if (!isUsableProfile(profile)) return { ok: false, error: 'invalid_profile' };
      saveProfile(profile);
      var session = emptyDay(today, profile);
      saveSession(session);
      return { ok: true, profile: profile, session: session };
    }

    function resetDay() {
      var profile = getProfile();
      var fresh = emptyDay(today, profile);
      saveSession(fresh);
      saveShared({ date: today, academy: {} });
      clearTodaySummaries();
      return fresh;
    }

    return {
      today: today,
      getProfile: getProfile,
      saveProfile: saveProfile,
      getSession: getSession,
      saveSession: saveSession,
      getLevels: getLevels,
      saveLevels: saveLevels,
      getShared: getShared,
      saveShared: saveShared,
      getSummaries: getSummaries,
      saveSummary: saveSummary,
      completeSetup: completeSetup,
      resetDay: resetDay,
      tvUnlocked: function () { return tvUnlocked(getSession()); },
      completedCount: function () { return completedCount(getSession()); }
    };
  }

  return {
    PROFILE_KEY: PROFILE_KEY,
    LEVELS_KEY: LEVELS_KEY,
    SESSION_KEY: SESSION_KEY,
    SHARED_KEY: SHARED_KEY,
    SUMMARY_KEY: SUMMARY_KEY,
    LAST_SCORE_KEY: LAST_SCORE_KEY,
    TV_XP: TV_XP,
    MIN_SUBJECTS_FOR_TV: MIN_SUBJECTS_FOR_TV,
    SESSIONS_PER_LEVEL: SESSIONS_PER_LEVEL,
    HELPED_XP_SHARE: HELPED_XP_SHARE,
    LEVEL_NAMES: LEVEL_NAMES,
    SUBJECTS: SUBJECTS,
    ALLOWED_MODELS: ALLOWED_MODELS,
    DEFAULT_MODEL: DEFAULT_MODEL,
    memoryStore: memoryStore,
    emptyDay: emptyDay,
    isUsableProfile: isUsableProfile,
    subjectById: subjectById,
    completedCount: completedCount,
    tvUnlocked: tvUnlocked,
    applyQuestComplete: applyQuestComplete,
    takePendingLessonScore: takePendingLessonScore,
    xpFromLessonScore: xpFromLessonScore,
    parseLessonScore: parseLessonScore,
    toggleQuest: toggleQuest,
    escapeHtml: escapeHtml,
    formatCaldrisHtml: formatCaldrisHtml,
    create: create
  };
});
