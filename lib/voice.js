(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.CaldrisVoice = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var KID_VOICE_NAMES = [
    'Google UK English Female',
    'Google US English',
    'Samantha',
    'Karen',
    'Moira',
    'Tessa',
    'Victoria',
    'Fiona',
    'Daniel',
    'Arthur',
    'Google UK English Male'
  ];

  function cleanSpeechText(text) {
    return String(text || '')
      .replace(/[#_*`]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Split on sentence boundaries only. Never drop the leftover clause.
   * A thought with no terminal punctuation is kept as the last chunk.
   */
  function splitSentences(text) {
    var clean = cleanSpeechText(text);
    if (!clean) return [];
    var parts = [];
    var re = /[^.!?]+(?:[.!?]+["')\]]*|\s*$)/g;
    var match;
    while ((match = re.exec(clean)) !== null) {
      var chunk = match[0].replace(/\s+/g, ' ').trim();
      if (chunk) parts.push(chunk);
    }
    if (!parts.length) parts.push(clean);
    var rebuilt = parts.join(' ').replace(/\s+/g, ' ').trim();
    if (rebuilt !== clean) {
      var leftover = clean;
      parts.forEach(function (p) {
        leftover = leftover.replace(p, '').trim();
      });
      leftover = leftover.replace(/\s+/g, ' ').trim();
      if (leftover) parts.push(leftover);
    }
    return parts;
  }

  /**
   * speechSynthesis.cancel() is only legal for these reasons.
   * Re-render, route paint, Claude arrival, and beat advance must NOT cancel.
   */
  function shouldCancelSpeech(reason) {
    return reason === 'user-question' ||
      reason === 'skip' ||
      reason === 'mute' ||
      reason === 'leave' ||
      reason === 'replay';
  }

  function pickKidVoice(voices) {
    var list = Array.isArray(voices) ? voices : [];
    var i;
    for (i = 0; i < KID_VOICE_NAMES.length; i++) {
      var want = KID_VOICE_NAMES[i];
      var hit = list.filter(function (v) { return v && v.name === want; })[0];
      if (hit) return hit;
    }
    var enFemale = list.filter(function (v) {
      return v && /^en/i.test(v.lang || '') && /female/i.test(v.name || '');
    })[0];
    if (enFemale) return enFemale;
    var en = list.filter(function (v) { return v && /^en/i.test(v.lang || ''); })[0];
    return en || list[0] || null;
  }

  function createVoiceEngine(opts) {
    opts = opts || {};
    var synth = opts.speechSynthesis || null;
    var Utterance = opts.SpeechSynthesisUtterance || (typeof SpeechSynthesisUtterance !== 'undefined' ? SpeechSynthesisUtterance : null);
    var onState = typeof opts.onState === 'function' ? opts.onState : function () {};
    var onBlocked = typeof opts.onBlocked === 'function' ? opts.onBlocked : function () {};
    var onTalking = typeof opts.onTalking === 'function' ? opts.onTalking : function () {};

    var enabled = false;
    var muted = false;
    var paused = false;
    var queue = [];
    var busy = false;
    var generation = 0;
    var lastFullText = '';
    var spokenLength = 0;
    var currentChunk = '';
    var state = 'idle';
    var startTimer = null;
    var voice = null;
    var lastDebug = { full: 0, spoken: 0, chunks: 0, cancelled: false };

    function setState(next) {
      state = next;
      onState(state, {
        enabled: enabled,
        muted: muted,
        paused: paused,
        lastFullText: lastFullText,
        spokenLength: spokenLength
      });
    }

    function refreshVoice() {
      if (!synth || typeof synth.getVoices !== 'function') return;
      voice = pickKidVoice(synth.getVoices() || []);
    }

    function clearStartTimer() {
      if (startTimer) {
        clearTimeout(startTimer);
        startTimer = null;
      }
    }

    function hardCancel() {
      clearStartTimer();
      queue = [];
      busy = false;
      currentChunk = '';
      if (synth && typeof synth.cancel === 'function') {
        try { synth.cancel(); } catch (e) {}
      }
    }

    function recordDebug() {
      lastDebug = {
        full: lastFullText.length,
        spoken: spokenLength,
        chunks: splitSentences(lastFullText).length,
        cancelled: spokenLength < lastFullText.length && !busy && !queue.length,
        text: lastFullText
      };
      return lastDebug;
    }

    function pump() {
      if (paused || muted || !enabled) return;
      if (busy) return;
      if (!queue.length) {
        recordDebug();
        setState(muted ? 'muted' : 'idle');
        onTalking(false);
        return;
      }
      if (!synth || !Utterance) {
        spokenLength = lastFullText.length;
        queue = [];
        recordDebug();
        setState('idle');
        return;
      }
      currentChunk = queue.shift();
      busy = true;
      var myGen = generation;
      var u = new Utterance(currentChunk);
      if (voice) u.voice = voice;
      u.rate = 0.95;
      u.pitch = 1.08;
      u.volume = 1;
      u.onstart = function () {
        if (myGen !== generation) return;
        clearStartTimer();
        setState('playing');
        onTalking(true);
      };
      u.onend = function () {
        if (myGen !== generation) return;
        spokenLength += currentChunk.length;
        busy = false;
        currentChunk = '';
        onTalking(false);
        setTimeout(pump, 50);
      };
      u.onerror = function (ev) {
        if (myGen !== generation) return;
        busy = false;
        var err = ev && ev.error;
        if (err === 'canceled' || err === 'interrupted') {
          recordDebug();
          return;
        }
        setState('error');
        onBlocked({ reason: err || 'speak-error', text: lastFullText });
      };
      setState('playing');
      startTimer = setTimeout(function () {
        if (myGen !== generation) return;
        if (state === 'playing' && busy) {
          onBlocked({ reason: 'autoplay', text: lastFullText });
        }
      }, 1400);
      try {
        synth.speak(u);
      } catch (e) {
        busy = false;
        onBlocked({ reason: 'speak-throw', text: lastFullText });
      }
    }

    function enqueue(text, reason) {
      var clean = cleanSpeechText(text);
      if (!clean) return recordDebug();
      if (shouldCancelSpeech(reason)) {
        generation += 1;
        hardCancel();
        spokenLength = 0;
      }
      lastFullText = clean;
      if (!shouldCancelSpeech(reason) && busy) {
        splitSentences(clean).forEach(function (chunk) { queue.push(chunk); });
      } else {
        spokenLength = 0;
        queue = splitSentences(clean);
      }
      recordDebug();
      if (enabled && !muted && !paused) pump();
      return lastDebug;
    }

    return {
      enable: function () {
        enabled = true;
        muted = false;
        paused = false;
        refreshVoice();
        setState('idle');
      },
      disable: function () {
        generation += 1;
        hardCancel();
        enabled = false;
        setState('muted');
      },
      speak: function (text, reason) {
        return enqueue(text, reason || 'queue');
      },
      replay: function () {
        if (!lastFullText) return lastDebug;
        return enqueue(lastFullText, 'replay');
      },
      skip: function () {
        generation += 1;
        hardCancel();
        spokenLength = lastFullText.length;
        recordDebug();
        setState('idle');
        onTalking(false);
      },
      pause: function () {
        paused = true;
        if (synth && typeof synth.pause === 'function') {
          try { synth.pause(); } catch (e) {}
        }
        setState('paused');
      },
      resume: function () {
        paused = false;
        if (synth && typeof synth.resume === 'function') {
          try { synth.resume(); } catch (e) {}
        }
        setState(busy ? 'playing' : 'idle');
        pump();
      },
      mute: function () {
        muted = true;
        generation += 1;
        hardCancel();
        setState('muted');
        onTalking(false);
      },
      unmute: function () {
        muted = false;
        paused = false;
        setState('idle');
      },
      setVoices: function (voices) {
        voice = pickKidVoice(voices);
      },
      refreshVoice: refreshVoice,
      getLastText: function () { return lastFullText; },
      getDebug: function () { return recordDebug(); },
      getState: function () { return state; },
      isEnabled: function () { return enabled; },
      isMuted: function () { return muted; },
      isPaused: function () { return paused; }
    };
  }

  return {
    cleanSpeechText: cleanSpeechText,
    splitSentences: splitSentences,
    shouldCancelSpeech: shouldCancelSpeech,
    pickKidVoice: pickKidVoice,
    createVoiceEngine: createVoiceEngine,
    KID_VOICE_NAMES: KID_VOICE_NAMES
  };
});
