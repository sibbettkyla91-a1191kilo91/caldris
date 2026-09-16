(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.CaldrisProgress = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var SESSION_KEY = 'mq_acad_v3';
  var SUMMARY_KEY = 'mq_summaries_v1';
  var PROFILE_KEY = 'mq_profile_v1';
  var HISTORY_KEY = 'mq_history_v1';
  var SETTINGS_KEY = 'mq_settings_v1';
  var LOOKBACK_DAYS = 14;
  var PIN_PREFIX = 'p1_';

  var RANKS = [
    { min: 0, id: 'adventurer', title: 'Adventurer' },
    { min: 3, id: 'pathfinder', title: 'Pathfinder' },
    { min: 7, id: 'keeper', title: 'Realm Keeper' },
    { min: 14, id: 'warden', title: 'Star Warden' },
    { min: 30, id: 'mythic', title: 'Mythic Warden' }
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

  function addCalendarDays(dateString, n) {
    var d = new Date(dateString);
    if (Number.isNaN(d.getTime())) d = new Date();
    d.setDate(d.getDate() + n);
    return d.toDateString();
  }

  function formatReportDate(dateString) {
    var d = new Date(dateString);
    if (Number.isNaN(d.getTime())) return String(dateString || '');
    return d.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric'
    });
  }

  function hashPin(pin) {
    var str = 'caldris-pin-v1|' + String(pin || '');
    var h = 2166136261;
    var r, i;
    for (r = 0; r < 24; r++) {
      for (i = 0; i < str.length; i++) {
        h ^= str.charCodeAt(i);
        h = Math.imul(h, 16777619);
      }
      str += (h >>> 0).toString(16);
    }
    var hex = (h >>> 0).toString(16);
    while (hex.length < 8) hex = '0' + hex;
    return PIN_PREFIX + hex;
  }

  function isHashedPin(value) {
    return typeof value === 'string' && value.indexOf(PIN_PREFIX) === 0;
  }

  function isPlainPin(value) {
    return typeof value === 'string' && /^\d{4}$/.test(value);
  }

  function pinsMatch(stored, entered) {
    if (!stored || entered == null) return false;
    if (isHashedPin(stored)) return stored === hashPin(entered);
    return stored === String(entered);
  }

  function rankForStreak(streak) {
    var n = streak || 0;
    var best = RANKS[0];
    for (var i = 0; i < RANKS.length; i++) {
      if (n >= RANKS[i].min) best = RANKS[i];
    }
    return best;
  }

  function emptySession(today) {
    return {
      date: today,
      completed: {},
      xp: 0,
      incidents: [],
      tvForce: null,
      questState: {},
      lastActivity: '',
      unlockCelebrated: false
    };
  }

  function snapshotDay(s) {
    return {
      date: s && s.date,
      completed: Object.assign({}, (s && s.completed) || {}),
      xp: (s && s.xp) || 0,
      incidents: ((s && s.incidents) || []).slice(),
      tvForce: (s && s.tvForce) || null
    };
  }

  function hasProgress(day) {
    if (!day) return false;
    if ((day.xp || 0) > 0) return true;
    if ((day.incidents || []).length > 0) return true;
    var completed = day.completed || {};
    for (var key in completed) {
      if (Object.prototype.hasOwnProperty.call(completed, key) && completed[key]) return true;
    }
    return false;
  }

  function countDone(completed, subjects) {
    var n = 0;
    (subjects || []).forEach(function (sub) {
      if (completed && completed[sub.id]) n += 1;
    });
    return n;
  }

  function allRequiredComplete(completed, subjects) {
    if (!subjects || !subjects.length) return false;
    for (var i = 0; i < subjects.length; i++) {
      if (!(completed && completed[subjects[i].id])) return false;
    }
    return true;
  }

  function dailyXpCap(subjects) {
    return (subjects || []).reduce(function (sum, sub) { return sum + (sub.xp || 0); }, 0);
  }

  function isTvUnlocked(session, subjects) {
    if (!session) return false;
    if (session.tvForce === 'unlock') return true;
    if (session.tvForce === 'lock') return false;
    return allRequiredComplete(session.completed, subjects);
  }

  function create(opts) {
    opts = opts || {};
    var storage = opts.storage || defaultStore();
    var today = opts.today || new Date().toDateString();
    var subjects = Array.isArray(opts.subjects) ? opts.subjects : [];

    function readJson(key, fallback) {
      return parseJson(storage.getItem(key), fallback);
    }

    function writeJson(key, value) {
      try {
        storage.setItem(key, JSON.stringify(value));
      } catch (e) {}
    }

    function getHistory() {
      var raw = readJson(HISTORY_KEY, {});
      return raw && typeof raw === 'object' ? raw : {};
    }

    function saveHistory(history) {
      writeJson(HISTORY_KEY, history);
    }

    function archiveDay(s) {
      if (!s || !s.date) return;
      var history = getHistory();
      history[s.date] = snapshotDay(s);
      saveHistory(history);
    }

    function getSettings() {
      var raw = readJson(SETTINGS_KEY, null);
      if (!raw || typeof raw !== 'object') {
        return { soundEnabled: false, ttsEnabled: false };
      }
      return {
        soundEnabled: !!raw.soundEnabled,
        ttsEnabled: !!raw.ttsEnabled
      };
    }

    function saveSettings(s) {
      writeJson(SETTINGS_KEY, {
        soundEnabled: !!(s && s.soundEnabled),
        ttsEnabled: !!(s && s.ttsEnabled)
      });
    }

    function persistProfile(p) {
      writeJson(PROFILE_KEY, p);
    }

    function getProfile() {
      var raw = readJson(PROFILE_KEY, null);
      var migrated = null;
      if (!(raw && typeof raw === 'object')) {
        var session = readJson(SESSION_KEY, null);
        if (session && (session.name || session.pin)) {
          migrated = {
            name: session.name || '',
            pin: session.pin || '',
            setupDone: !!session.setupDone
          };
        } else {
          return {
            name: '',
            pin: '',
            setupDone: false,
            streak: 0,
            lastAllDoneDate: '',
            stampCounts: {},
            lifetimeDays: 0
          };
        }
        raw = migrated;
      }

      var pin = raw.pin || '';
      if (isPlainPin(pin)) pin = hashPin(pin);

      var profile = {
        name: raw.name || '',
        pin: pin,
        setupDone: !!raw.setupDone,
        streak: typeof raw.streak === 'number' ? raw.streak : 0,
        lastAllDoneDate: raw.lastAllDoneDate || '',
        stampCounts: raw.stampCounts && typeof raw.stampCounts === 'object' ? raw.stampCounts : {},
        lifetimeDays: typeof raw.lifetimeDays === 'number' ? raw.lifetimeDays : 0
      };
      persistProfile(profile);
      return profile;
    }

    function saveProfile(p) {
      var current = getProfile();
      var pin = (p && p.pin != null && p.pin !== '') ? p.pin : current.pin;
      if (isPlainPin(pin)) pin = hashPin(pin);
      var next = {
        name: p && p.name != null ? p.name : current.name,
        pin: pin,
        setupDone: p && p.setupDone != null ? !!p.setupDone : current.setupDone,
        streak: p && p.streak != null ? p.streak : current.streak,
        lastAllDoneDate: p && p.lastAllDoneDate != null ? p.lastAllDoneDate : current.lastAllDoneDate,
        stampCounts: p && p.stampCounts ? p.stampCounts : current.stampCounts,
        lifetimeDays: p && p.lifetimeDays != null ? p.lifetimeDays : current.lifetimeDays
      };
      persistProfile(next);
      return next;
    }

    function verifyPin(entered) {
      return pinsMatch(getProfile().pin, entered);
    }

    function changePin(currentPin, nextPin) {
      if (!verifyPin(currentPin)) return { ok: false, error: 'current' };
      if (!isPlainPin(nextPin)) return { ok: false, error: 'format' };
      saveProfile({ pin: nextPin });
      return { ok: true };
    }

    function stripSecrets(s) {
      if (!s) return s;
      var copy = Object.assign({}, s);
      delete copy.pin;
      return copy;
    }

    function getSession() {
      var profile = getProfile();
      var raw = readJson(SESSION_KEY, null);
      if (raw && raw.date && raw.date !== today) {
        archiveDay(stripSecrets(raw));
        raw = emptySession(today);
        writeJson(SESSION_KEY, raw);
      }
      if (!raw || raw.date !== today) raw = emptySession(today);
      if (!raw.completed || typeof raw.completed !== 'object') raw.completed = {};
      if (!Array.isArray(raw.incidents)) raw.incidents = [];
      if (!raw.questState || typeof raw.questState !== 'object') raw.questState = {};
      if (raw.tvForce !== 'unlock' && raw.tvForce !== 'lock') raw.tvForce = null;
      raw.name = profile.name;
      raw.setupDone = profile.setupDone;
      delete raw.pin;
      return raw;
    }

    function saveSession(s) {
      if (!s) return;
      var copy = stripSecrets(Object.assign({}, s));
      writeJson(SESSION_KEY, copy);
      if (copy.date) archiveDay(copy);
    }

    function touchActivity(s) {
      s.lastActivity = new Date().toISOString();
      return s;
    }

    function getSummaries() {
      var raw = readJson(SUMMARY_KEY, {});
      return raw && typeof raw === 'object' ? raw : {};
    }

    function saveSummary(subjectId, messages, completedAt) {
      var all = getSummaries();
      if (!all[today]) all[today] = {};
      all[today][subjectId] = {
        messages: (messages || []).filter(function (m) { return m && m.role !== 'system'; }).slice(-30),
        completedAt: completedAt || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };
      writeJson(SUMMARY_KEY, all);
    }

    function inferFromSummaries(date) {
      var daySummaries = getSummaries()[date] || {};
      var completed = {};
      var xp = 0;
      subjects.forEach(function (sub) {
        if (daySummaries[sub.id]) {
          completed[sub.id] = true;
          xp += sub.xp || 0;
        }
      });
      return { date: date, completed: completed, xp: xp, incidents: [] };
    }

    function listReportDates() {
      var seen = {};
      var i;
      for (i = LOOKBACK_DAYS - 1; i >= 0; i--) {
        seen[addCalendarDays(today, -i)] = true;
      }
      var history = getHistory();
      Object.keys(history).forEach(function (d) { seen[d] = true; });
      var summaries = getSummaries();
      Object.keys(summaries).forEach(function (d) { seen[d] = true; });
      var session = readJson(SESSION_KEY, null);
      if (session && session.date) seen[session.date] = true;
      return Object.keys(seen).sort(function (a, b) {
        return new Date(a).getTime() - new Date(b).getTime();
      });
    }

    function getDayReport(date) {
      var target = date || today;
      var summaries = getSummaries()[target] || {};
      var inferred = inferFromSummaries(target);
      var profile = getProfile();
      if (target === today) {
        var session = getSession();
        return {
          date: target,
          isToday: true,
          completed: session.completed || {},
          xp: session.xp || 0,
          incidents: session.incidents || [],
          summaries: summaries,
          source: 'session',
          name: session.name || '',
          tvUnlocked: isTvUnlocked(session, subjects),
          tvForce: session.tvForce || null,
          lastActivity: session.lastActivity || '',
          doneCount: countDone(session.completed, subjects),
          requiredCount: subjects.length
        };
      }

      var archived = getHistory()[target];
      var day = archived && hasProgress(archived) ? archived : (hasProgress(inferred) ? inferred : (archived || inferred));
      var reportSession = {
        completed: day.completed || {},
        xp: day.xp || 0,
        tvForce: day.tvForce || null
      };
      return {
        date: target,
        isToday: false,
        completed: day.completed || {},
        xp: day.xp || 0,
        incidents: day.incidents || [],
        summaries: summaries,
        source: archived && hasProgress(archived) ? 'history' : (hasProgress(inferred) ? 'summaries' : (archived ? 'history' : 'empty')),
        name: profile.name || '',
        tvUnlocked: isTvUnlocked(reportSession, subjects),
        tvForce: day.tvForce || null,
        lastActivity: '',
        doneCount: countDone(day.completed, subjects),
        requiredCount: subjects.length
      };
    }

    function neighborDate(date, delta) {
      var dates = listReportDates();
      var idx = dates.indexOf(date);
      if (idx < 0) return null;
      return dates[idx + delta] || null;
    }

    function yesterdayDate() {
      return addCalendarDays(today, -1);
    }

    function hasReport(date) {
      var report = getDayReport(date);
      if (hasProgress(report)) return true;
      return Object.keys(report.summaries || {}).length > 0;
    }

    function subjectById(id) {
      for (var i = 0; i < subjects.length; i++) {
        if (subjects[i].id === id) return subjects[i];
      }
      return null;
    }

    function noteStreakOnComplete() {
      var session = getSession();
      if (!allRequiredComplete(session.completed, subjects)) return getProfile();
      var profile = getProfile();
      if (profile.lastAllDoneDate === today) return profile;
      var yesterday = yesterdayDate();
      var nextStreak = profile.lastAllDoneDate === yesterday ? (profile.streak || 0) + 1 : 1;
      var stamps = Object.assign({}, profile.stampCounts || {});
      subjects.forEach(function (sub) {
        stamps[sub.id] = (stamps[sub.id] || 0) + (session.completed[sub.id] ? 1 : 0);
      });
      return saveProfile({
        streak: nextStreak,
        lastAllDoneDate: today,
        stampCounts: stamps,
        lifetimeDays: (profile.lifetimeDays || 0) + 1
      });
    }

    function completeSubject(subjectId) {
      var sub = subjectById(subjectId);
      var s = getSession();
      if (!sub || s.completed[subjectId]) {
        return { session: s, awarded: false, xp: s.xp || 0, unlocked: isTvUnlocked(s, subjects) };
      }
      s.completed[subjectId] = true;
      var cap = dailyXpCap(subjects);
      s.xp = Math.min(cap, (s.xp || 0) + (sub.xp || 0));
      touchActivity(s);
      saveSession(s);
      noteStreakOnComplete();
      return { session: getSession(), awarded: true, xp: s.xp, unlocked: isTvUnlocked(s, subjects) };
    }

    function uncompleteSubject(subjectId) {
      var sub = subjectById(subjectId);
      var s = getSession();
      if (!sub || !s.completed[subjectId]) {
        return { session: s, changed: false };
      }
      delete s.completed[subjectId];
      if (s.questState) delete s.questState[subjectId];
      s.xp = Math.max(0, (s.xp || 0) - (sub.xp || 0));
      if (!allRequiredComplete(s.completed, subjects) && s.tvForce !== 'unlock') {
        s.unlockCelebrated = false;
      }
      touchActivity(s);
      saveSession(s);
      var profile = getProfile();
      if (profile.lastAllDoneDate === today) {
        saveProfile({
          lastAllDoneDate: '',
          streak: Math.max(0, (profile.streak || 0) - 1),
          lifetimeDays: Math.max(0, (profile.lifetimeDays || 0) - 1)
        });
      }
      return { session: getSession(), changed: true };
    }

    function saveQuestState(subjectId, state) {
      var s = getSession();
      s.questState = s.questState || {};
      s.questState[subjectId] = state || {};
      touchActivity(s);
      saveSession(s);
      return s.questState[subjectId];
    }

    function getQuestState(subjectId) {
      var s = getSession();
      return (s.questState && s.questState[subjectId]) || null;
    }

    function addIncident(text, kind) {
      var s = getSession();
      s.incidents = s.incidents || [];
      s.incidents.push({
        text: String(text || '').slice(0, 400),
        kind: kind || 'note',
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      });
      saveSession(s);
      return s.incidents;
    }

    function removeIncident(index) {
      var s = getSession();
      if (!s.incidents || index < 0 || index >= s.incidents.length) return s.incidents || [];
      s.incidents.splice(index, 1);
      saveSession(s);
      return s.incidents;
    }

    function setTvForce(mode, note) {
      var s = getSession();
      s.tvForce = (mode === 'unlock' || mode === 'lock') ? mode : null;
      if (mode === 'unlock') s.unlockCelebrated = true;
      if (mode === 'lock') s.unlockCelebrated = false;
      touchActivity(s);
      saveSession(s);
      addIncident(note || (mode === 'unlock' ? 'Parent unlocked TV today (override).' : 'Parent re-locked TV.'), 'tv');
      return getSession();
    }

    function markUnlockCelebrated() {
      var s = getSession();
      s.unlockCelebrated = true;
      saveSession(s);
      return s;
    }

    function resetDay() {
      var profile = getProfile();
      if (profile.lastAllDoneDate === today) {
        saveProfile({
          lastAllDoneDate: '',
          streak: Math.max(0, (profile.streak || 0) - 1),
          lifetimeDays: Math.max(0, (profile.lifetimeDays || 0) - 1)
        });
      }
      var incidents = (getSession().incidents || []).slice();
      var fresh = emptySession(today);
      fresh.incidents = incidents;
      saveSession(fresh);
      var all = getSummaries();
      if (all[today]) {
        delete all[today];
        writeJson(SUMMARY_KEY, all);
      }
      return getSession();
    }

    function getRank() {
      return rankForStreak(getProfile().streak || 0);
    }

    return {
      getProfile: getProfile,
      saveProfile: saveProfile,
      verifyPin: verifyPin,
      changePin: changePin,
      getSession: getSession,
      saveSession: saveSession,
      getSummaries: getSummaries,
      saveSummary: saveSummary,
      getHistory: getHistory,
      archiveDay: archiveDay,
      listReportDates: listReportDates,
      getDayReport: getDayReport,
      neighborDate: neighborDate,
      yesterdayDate: yesterdayDate,
      hasReport: hasReport,
      formatReportDate: formatReportDate,
      completeSubject: completeSubject,
      uncompleteSubject: uncompleteSubject,
      saveQuestState: saveQuestState,
      getQuestState: getQuestState,
      addIncident: addIncident,
      removeIncident: removeIncident,
      setTvForce: setTvForce,
      markUnlockCelebrated: markUnlockCelebrated,
      resetDay: resetDay,
      isTvUnlocked: function (session) {
        return isTvUnlocked(session || getSession(), subjects);
      },
      allRequiredComplete: function (completed) {
        return allRequiredComplete(completed || getSession().completed, subjects);
      },
      dailyXpCap: function () { return dailyXpCap(subjects); },
      getSettings: getSettings,
      saveSettings: saveSettings,
      getRank: getRank,
      countDone: function (completed) { return countDone(completed || getSession().completed, subjects); }
    };
  }

  return {
    create: create,
    memoryStore: memoryStore,
    addCalendarDays: addCalendarDays,
    formatReportDate: formatReportDate,
    hashPin: hashPin,
    pinsMatch: pinsMatch,
    isHashedPin: isHashedPin,
    isTvUnlocked: isTvUnlocked,
    allRequiredComplete: allRequiredComplete,
    dailyXpCap: dailyXpCap,
    rankForStreak: rankForStreak,
    RANKS: RANKS,
    SESSION_KEY: SESSION_KEY,
    SUMMARY_KEY: SUMMARY_KEY,
    PROFILE_KEY: PROFILE_KEY,
    HISTORY_KEY: HISTORY_KEY,
    SETTINGS_KEY: SETTINGS_KEY,
    LOOKBACK_DAYS: LOOKBACK_DAYS
  };
});
