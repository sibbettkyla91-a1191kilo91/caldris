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
  var LOOKBACK_DAYS = 14;

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

  function emptySession(today) {
    return { date: today, completed: {}, xp: 0, incidents: [] };
  }

  function snapshotDay(s) {
    return {
      date: s && s.date,
      completed: Object.assign({}, (s && s.completed) || {}),
      xp: (s && s.xp) || 0,
      incidents: ((s && s.incidents) || []).slice()
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

    function getProfile() {
      var raw = readJson(PROFILE_KEY, null);
      if (raw && typeof raw === 'object') {
        return {
          name: raw.name || '',
          pin: raw.pin || '',
          setupDone: !!raw.setupDone
        };
      }
      // One-time migration: older builds stored name/PIN only on the daily session.
      var session = readJson(SESSION_KEY, null);
      if (session && (session.name || session.pin)) {
        var migrated = {
          name: session.name || '',
          pin: session.pin || '',
          setupDone: !!session.setupDone
        };
        saveProfile(migrated);
        return migrated;
      }
      return { name: '', pin: '', setupDone: false };
    }

    function saveProfile(p) {
      writeJson(PROFILE_KEY, {
        name: (p && p.name) || '',
        pin: (p && p.pin) || '',
        setupDone: !!(p && p.setupDone)
      });
    }

    function getSession() {
      var profile = getProfile();
      var raw = readJson(SESSION_KEY, null);
      if (raw && raw.date && raw.date !== today) {
        archiveDay(raw);
        raw = emptySession(today);
        writeJson(SESSION_KEY, raw);
      }
      if (!raw || raw.date !== today) raw = emptySession(today);
      if (!raw.completed || typeof raw.completed !== 'object') raw.completed = {};
      if (!Array.isArray(raw.incidents)) raw.incidents = raw.incidents || [];
      raw.name = profile.name;
      raw.pin = profile.pin;
      raw.setupDone = profile.setupDone;
      return raw;
    }

    function saveSession(s) {
      if (!s) return;
      writeJson(SESSION_KEY, s);
      if (s.date) archiveDay(s);
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
          name: session.name || ''
        };
      }

      var archived = getHistory()[target];
      var day = archived && hasProgress(archived) ? archived : (hasProgress(inferred) ? inferred : (archived || inferred));
      return {
        date: target,
        isToday: false,
        completed: day.completed || {},
        xp: day.xp || 0,
        incidents: day.incidents || [],
        summaries: summaries,
        source: archived && hasProgress(archived) ? 'history' : (hasProgress(inferred) ? 'summaries' : (archived ? 'history' : 'empty')),
        name: getProfile().name || ''
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

    return {
      getProfile: getProfile,
      saveProfile: saveProfile,
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
      formatReportDate: formatReportDate
    };
  }

  return {
    create: create,
    memoryStore: memoryStore,
    addCalendarDays: addCalendarDays,
    formatReportDate: formatReportDate,
    SESSION_KEY: SESSION_KEY,
    SUMMARY_KEY: SUMMARY_KEY,
    PROFILE_KEY: PROFILE_KEY,
    HISTORY_KEY: HISTORY_KEY,
    LOOKBACK_DAYS: LOOKBACK_DAYS
  };
});
