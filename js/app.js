(function () {
  'use strict';

  var TODAY = new Date().toDateString();
  var SUBJECTS = (window.CaldrisQuests && CaldrisQuests.SUBJECTS) || [];
  var progress = window.CaldrisProgress && CaldrisProgress.create({ today: TODAY, subjects: SUBJECTS });
  var fishing = window.CaldrisFishing && CaldrisFishing.create({ today: TODAY });
  var Teacher = window.CaldrisTeacher || {};
  var VoiceLib = window.CaldrisVoice || {};
  var Ownership = window.CaldrisLessonOwnership || {};
  var IMAGES = {
    mainRealm: 'assets/images/realm-main.jpg',
    campsite: 'assets/images/realm-campsite.jpg',
    player: 'assets/images/matthew.png',
    caldris: 'assets/images/caldris.jpg',
    sidekick: 'assets/images/sidekick.png'
  };
  var LEVELS_KEY = 'mq_levels_v1';
  var LINES = (window.CaldrisQuests && CaldrisQuests.CALDRIS) || {};
  var ROOM_EMOJI = { reading: '🌳', writing: '✏️', math: '🧮', life: '🍳', pe: '🌿' };

  var settings = progress ? progress.getSettings() : { soundEnabled: false, ttsEnabled: false };
  var recognition = null;
  var isListening = false;
  var userEditing = false;
  var micState = 'unknown';
  var inParentMode = false;
  var parentViewDate = TODAY;
  var audioCtx = null;

  var activeQuest = null;
  var beatIndex = 0;
  var attempts = 0;
  var usingScaffold = false;
  var questLog = [];
  var orderPicked = [];
  var fishTimer = null;
  var fishGlow = false;
  var lastXp = 0;
  var teacherLine = '';
  var hadExchange = false;
  var practiceMode = false;
  var claudeSeq = 0;
  var finishTimer = null;
  var voiceGestureDone = false;

  function $(id) { return document.getElementById(id); }
  function escapeHtml(s) {
    return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function pick(list) {
    if (!list || !list.length) return '';
    return list[Math.floor(Math.random() * list.length)];
  }

  var voice = VoiceLib.createVoiceEngine ? VoiceLib.createVoiceEngine({
    speechSynthesis: window.speechSynthesis || null,
    SpeechSynthesisUtterance: window.SpeechSynthesisUtterance || null,
    onState: function (state) { syncSpeaker(state); },
    onTalking: function (on) { setGuideMood(on ? 'talking' : ''); },
    onBlocked: function () { showTapToHear(!voiceGestureDone); }
  }) : null;

  function getLevels() {
    try { return JSON.parse(localStorage.getItem(LEVELS_KEY)) || {}; } catch (e) { return {}; }
  }
  function getGrade(subjectId) {
    var g = parseInt(getLevels()[subjectId + '_grade'], 10);
    if (!Number.isFinite(g) || g < 1) return 1;
    return Math.min(g, 12);
  }

  function persistSettings() {
    if (progress) progress.saveSettings(settings);
    var banner = $('sound-banner');
    if (banner) banner.hidden = !!(settings.soundEnabled && settings.ttsEnabled);
    syncSpeaker(voice ? voice.getState() : 'idle');
  }

  function syncSpeaker(state) {
    var btn = $('teacher-speaker');
    if (!btn) return;
    btn.className = 'speaker-btn';
    if (!settings.ttsEnabled || (voice && voice.isMuted())) {
      btn.className += ' muted';
      btn.textContent = '🔇';
      btn.setAttribute('aria-label', 'Teacher voice muted');
    } else if (state === 'paused' || (voice && voice.isPaused())) {
      btn.className += ' paused';
      btn.textContent = '⏸️';
      btn.setAttribute('aria-label', 'Teacher voice paused');
    } else if (state === 'playing') {
      btn.className += ' playing';
      btn.textContent = '🔊';
      btn.setAttribute('aria-label', 'Teacher is talking');
    } else {
      btn.textContent = '🔊';
      btn.setAttribute('aria-label', 'Teacher voice ready');
    }
  }

  function showTapToHear(on) {
    var el = $('tap-to-hear');
    if (!el) return;
    if (on && voiceGestureDone) {
      el.hidden = true;
      return;
    }
    el.hidden = !on;
  }

  function sfx(kind) {
    if (!settings.soundEnabled) return;
    try {
      var Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return;
      audioCtx = audioCtx || new Ctx();
      if (audioCtx.state === 'suspended') audioCtx.resume();
      var now = audioCtx.currentTime;
      var o = audioCtx.createOscillator();
      var g = audioCtx.createGain();
      o.connect(g); g.connect(audioCtx.destination);
      var freq = kind === 'lock' ? 180 : kind === 'unlock' ? 523 : kind === 'complete' ? 392 : 330;
      o.frequency.setValueAtTime(freq, now);
      if (kind === 'unlock' || kind === 'complete') {
        o.frequency.exponentialRampToValueAtTime(freq * 1.5, now + 0.18);
      }
      g.gain.setValueAtTime(0.0001, now);
      g.gain.exponentialRampToValueAtTime(0.08, now + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, now + 0.28);
      o.start(now); o.stop(now + 0.3);
    } catch (e) {}
  }

  function initVoiceList() {
    if (!voice) return;
    voice.refreshVoice();
  }

  function cleanTeacherText(text) {
    return VoiceLib.cleanSpeechText ? VoiceLib.cleanSpeechText(text) : String(text || '').trim();
  }

  function speakTeacher(text, reason) {
    var clean = cleanTeacherText(text);
    if (!clean) return;
    if (voice && settings.ttsEnabled) {
      var debug = voice.speak(clean, reason || 'queue');
      if (debug && typeof console !== 'undefined' && console.info) {
        console.info('[caldris-voice]', { full: debug.full, spoken: debug.spoken, chunks: debug.chunks, reason: reason || 'queue' });
      }
    }
  }

  function invalidateClaude() {
    claudeSeq = Ownership.nextSeq ? Ownership.nextSeq(claudeSeq) : claudeSeq + 1;
  }

  // #quest-prompt belongs only to the deterministic curriculum beat.
  function setCurriculumPrompt(text, reason) {
    var clean = cleanTeacherText(text);
    if (!clean) return;
    teacherLine = clean;
    var bubble = $('quest-prompt');
    if (bubble) bubble.textContent = clean;
    speakTeacher(clean, reason || 'queue');
  }

  function restoreCurriculumPrompt() {
    var beat = currentBeat();
    if (!beat) return;
    var text = (Ownership.promptFromBeat && Ownership.promptFromBeat(beat)) || beat.prompt;
    if (!text) return;
    teacherLine = cleanTeacherText(text);
    var bubble = $('quest-prompt');
    if (bubble) bubble.textContent = teacherLine;
  }

  function restateCurriculumPrompt(reason) {
    var beat = currentBeat();
    var text = (Ownership.promptFromBeat && Ownership.promptFromBeat(beat)) || (beat && beat.prompt);
    if (text) setCurriculumPrompt(text, reason || 'queue');
  }

  function setTeacherFeedback(text, reason, logIt) {
    var clean = cleanTeacherText(text);
    if (!clean) return;
    if (logIt !== false) questLog.push({ role: 'caldris', text: clean });
    var hint = $('quest-hint');
    var side = $('sidekick-line');
    if (hint) hint.textContent = clean;
    if (side) side.textContent = clean;
    speakTeacher(clean, reason || 'queue');
    restoreCurriculumPrompt();
  }

  function setGuideMood(mood) {
    ['hub-caldris', 'quest-caldris'].forEach(function (id) {
      var el = $(id);
      if (!el) return;
      el.className = 'guide-avatar' + (mood ? ' ' + mood : '');
    });
  }

  function enableSound() {
    settings.soundEnabled = true;
    settings.ttsEnabled = true;
    voiceGestureDone = true;
    persistSettings();
    showTapToHear(false);
    if (voice) voice.enable();
    sfx('chime');
    var hello = 'Hi Matthew. I am Caldris, your teacher. Tap a colorful room and I will teach one idea.';
    if (voice) voice.speak(hello, 'queue');
    var hub = $('hub-line');
    if (hub) hub.textContent = hello;
  }

  function toggleTeacherSpeaker() {
    if (!voice) return;
    if (!settings.ttsEnabled) {
      enableSound();
      return;
    }
    if (voice.isMuted()) {
      voice.unmute();
      if (teacherLine) voice.replay();
    } else if (voice.getState() === 'playing') {
      voice.pause();
    } else if (voice.isPaused()) {
      voice.resume();
    } else if (teacherLine) {
      voice.replay();
    }
    syncSpeaker(voice.getState());
  }

  function replayTeacher() {
    restoreCurriculumPrompt();
    if (!teacherLine) return;
    if (!settings.ttsEnabled) enableSound();
    if (voice) {
      voice.replay();
      var debug = voice.getDebug();
      if (debug && typeof console !== 'undefined') {
        console.info('[caldris-voice-replay]', { full: debug.full, spoken: debug.spoken, same: debug.text === teacherLine });
      }
    }
  }

  function skipTalking() {
    if (voice) voice.skip();
  }

  function initSR() {
    var SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { micState = 'unsupported'; return false; }
    recognition = new SR();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = 'en-US';
    recognition.onresult = function (e) {
      var finalText = '';
      var interim = '';
      var i;
      for (i = 0; i < e.results.length; i++) {
        var chunk = e.results[i][0].transcript;
        if (e.results[i].isFinal) finalText += chunk;
        else interim += chunk;
      }
      var inp = $('chat-in');
      if (inp) {
        inp.value = finalText || interim;
        inp.style.height = 'auto';
        inp.style.height = Math.min(inp.scrollHeight, 120) + 'px';
      }
      micState = 'granted';
      if (finalText) {
        userEditing = false;
        handleKidText(finalText);
      }
    };
    recognition.onend = function () { isListening = false; updateMic(); };
    recognition.onerror = function (ev) {
      isListening = false;
      if (ev && ev.error === 'not-allowed') {
        micState = 'denied';
        setMicStatus('Type your question.');
        if ($('chat-in')) $('chat-in').focus();
      }
      updateMic();
    };
    return true;
  }

  function toggleMic() {
    var inp = $('chat-in');
    if (!recognition && !initSR()) {
      setMicStatus('Type your question.');
      if (inp) inp.focus();
      return;
    }
    if (isListening) {
      try { recognition.stop(); } catch (e) {}
      return;
    }
    userEditing = false;
    isListening = true;
    updateMic();
    try { recognition.start(); } catch (e) {
      isListening = false;
      setMicStatus('Type your question.');
      if (inp) inp.focus();
      updateMic();
    }
  }

  function setMicStatus(text, on) {
    var bar = $('mic-status-bar');
    if (!bar) return;
    bar.textContent = text;
    bar.className = 'mic-status' + (on ? ' on' : '');
  }

  function updateMic() {
    var btn = $('mic-btn');
    if (btn) {
      btn.textContent = isListening ? '🔴' : '🎤';
      btn.className = 'mic-btn' + (isListening ? ' listening' : '');
    }
    if (isListening) setMicStatus('Listening… ask Caldris anything', true);
    else if (micState === 'denied') setMicStatus('Type your question.');
    else if (micState === 'unsupported') setMicStatus('Type your question. Voice isn’t on this device.');
    else setMicStatus('Hold 🎤 to talk, or type a question.');
  }

  function showView(id) {
    document.querySelectorAll('.view').forEach(function (v) { v.classList.remove('active'); });
    var el = $(id);
    if (el) el.classList.add('active');
    window.scrollTo(0, 0);
    var toggle = $('mode-toggle');
    if (toggle) toggle.style.display = (id === 'quest-view') ? 'none' : 'block';
    document.body.classList.toggle('parent-open', id === 'parent-view');
  }

  function burstOnce() {
    var layer = $('burst-layer');
    if (!layer) return;
    layer.innerHTML = '';
    for (var i = 0; i < 28; i++) {
      var d = document.createElement('div');
      d.className = 'rune';
      d.style.left = (6 + Math.random() * 88) + '%';
      d.style.top = (-10 + Math.random() * 20) + 'px';
      d.style.background = i % 2 ? '#ffd54a' : '#2a7de1';
      d.style.animationDelay = (Math.random() * 0.2) + 's';
      layer.appendChild(d);
    }
    setTimeout(function () { layer.innerHTML = ''; }, 1600);
  }

  function maybeCelebrateUnlock(wasUnlocked) {
    if (!progress || !progress.isTvUnlocked()) return;
    var s = progress.getSession();
    if (s.unlockCelebrated) return;
    if (wasUnlocked && s.unlockCelebrated) return;
    burstOnce();
    sfx('unlock');
    setGuideMood('celebrating');
    speakTeacher(LINES.unlock || 'All 5 rooms are stamped. Screen time is unlocked.', 'queue');
    progress.markUnlockCelebrated();
  }

  function hubLine(session, unlocked) {
    var done = progress.countDone(session.completed);
    if (unlocked) return 'The campus gate is open. Play, rest, and come back tomorrow.';
    if (done === 0) return 'Tap a colorful room. I will teach one idea, then you can ask me anything.';
    return (5 - done) + ' room' + (done === 4 ? '' : 's') + ' still need a stamp before TV unlocks.';
  }

  function renderHub() {
    if (!progress) return;
    var session = progress.getSession();
    var profile = progress.getProfile();
    var rank = progress.getRank();
    var unlocked = progress.isTvUnlocked(session);
    var cap = progress.dailyXpCap();
    var xp = session.xp || 0;
    var done = progress.countDone(session.completed);

    $('realm-bg').style.backgroundImage = 'url("' + IMAGES.mainRealm + '")';
    $('hub-name').textContent = profile.name || 'Adventurer';
    $('hub-meta').textContent = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
    $('streak-chip').textContent = (profile.streak ? '🔥 ' + profile.streak + ' day streak · ' : '⭐ ') + rank.title;
    $('hub-line').textContent = hubLine(session, unlocked);

    $('xp-display').textContent = xp + ' / ' + cap + ' XP';
    var bar = $('xp-bar');
    var pct = cap ? Math.min(100, (xp / cap) * 100) : 0;
    if (xp > lastXp) bar.classList.add('burst');
    requestAnimationFrame(function () { bar.style.width = pct + '%'; });
    setTimeout(function () { bar.classList.remove('burst'); }, 700);
    lastXp = xp;
    $('threshold-text').textContent = unlocked
      ? 'All rooms stamped. Stars were the cheer, not the key.'
      : (5 - done) + ' room' + (done === 4 ? '' : 's') + ' still keep the TV gate closed.';

    var banner = $('tv-banner');
    banner.className = 'tv-banner' + (unlocked ? ' unlocked' : '');
    $('tv-icon').textContent = unlocked ? '📺✅' : '📺🔒';
    $('tv-status-main').textContent = unlocked ? 'UNLOCKED' : 'LOCKED';
    $('tv-status-main').className = 'tv-status-main' + (unlocked ? ' go' : '');
    $('tv-status-sub').textContent = unlocked
      ? 'Gateway is open — great work today!'
      : 'Stamp all 5 rooms to unlock';

    var box = $('subjects');
    box.innerHTML = '';
    if (!SUBJECTS.length) {
      box.innerHTML = '<p class="empty-hint">No rooms are packed yet.</p>';
    }
    SUBJECTS.forEach(function (subj) {
      var isDone = !!(session.completed && session.completed[subj.id]);
      var card = document.createElement('button');
      card.type = 'button';
      card.className = 'subject-card room-' + subj.id + (isDone ? ' done' : ' ready');
      card.setAttribute('aria-label', (subj.room || subj.name) + (isDone ? ' complete' : ' ready'));
      card.innerHTML =
        '<div class="subj-icon">' + (ROOM_EMOJI[subj.id] || subj.icon) + '</div>' +
        '<div class="subj-info"><div class="subj-name">' + escapeHtml(subj.room || subj.name) + '</div>' +
        '<div class="subj-desc">' + escapeHtml(subj.name) + '</div></div>' +
        (isDone ? '<div class="door-sticker">🚪⭐</div><div class="subj-done-badge">STAMPED</div>' : '<div class="subj-xp">Tap to go in</div>');
      if (!isDone) card.addEventListener('click', function () { openQuest(subj); });
      box.appendChild(card);
    });

    renderDockBanner();
    persistSettings();
  }

  function renderDockBanner() {
    var el = $('dock-banner-sub');
    if (!el || !fishing) return;
    var n = fishing.getState().castsRemaining;
    el.textContent = n ? (n + (n === 1 ? ' bonus cast ready' : ' bonus casts ready') + ' — fishing never unlocks TV') : 'Bonus only — finish a room to earn a cast';
  }

  function currentBeat() {
    if (!activeQuest) return null;
    var beat = activeQuest.beats[beatIndex];
    if (usingScaffold) return CaldrisQuests.scaffoldFor(beat);
    return beat;
  }

  function persistQuest() {
    if (!progress || !activeQuest) return;
    progress.saveQuestState(activeQuest.subjectId, {
      beatIndex: beatIndex,
      attempts: attempts,
      usingScaffold: usingScaffold,
      log: questLog.slice(-24),
      title: activeQuest.title,
      hadExchange: hadExchange,
      teacherLine: teacherLine
    });
  }

  function updateNextBtn() {
    var btn = $('next-btn');
    if (!btn) return;
    btn.hidden = !hadExchange;
  }

  function renderDots() {
    var wrap = $('beat-dots');
    if (!wrap || !activeQuest) return;
    wrap.innerHTML = activeQuest.beats.map(function (_, i) {
      var cls = i < beatIndex ? 'done' : (i === beatIndex ? 'on' : '');
      return '<span class="beat-dot ' + cls + '"></span>';
    }).join('');
  }

  function renderBeat() {
    var beat = currentBeat();
    var stage = $('quest-stage');
    var passage = $('quest-passage');
    if (!beat || !stage) return;
    $('quest-hint').textContent = '';
    $('sidekick-line').textContent = usingScaffold ? 'Pick the true card. No rush.' : 'Ask Caldris anything. I brought snacks.';
    renderDots();
    if (activeQuest.passage && (beatIndex === 0 || beat.type === 'tap')) {
      passage.classList.remove('hidden');
      passage.textContent = activeQuest.passage;
    } else {
      passage.classList.add('hidden');
    }
    orderPicked = [];
    clearFish();
    var type = beat.type;
    if (type === 'tap') {
      stage.innerHTML = '<div class="choice-grid">' + (beat.options || []).map(function (opt) {
        return '<button type="button" class="choice-btn" data-id="' + escapeHtml(opt.id) + '">' + escapeHtml(opt.label) + '</button>';
      }).join('') + '</div>';
      stage.querySelectorAll('.choice-btn').forEach(function (btn) {
        btn.addEventListener('click', function () { submitAnswer(btn.getAttribute('data-id')); });
      });
    } else if (type === 'order') {
      stage.innerHTML = '<div class="order-row" id="order-picked"></div><div class="order-row" id="order-pool">' +
        (beat.items || []).map(function (it) {
          return '<button type="button" class="order-chip" data-id="' + escapeHtml(it.id) + '">' + escapeHtml(it.label) + '</button>';
        }).join('') + '</div>';
      stage.querySelectorAll('.order-chip').forEach(function (btn) {
        btn.addEventListener('click', function () { tapOrder(btn.getAttribute('data-id'), btn); });
      });
    } else if (type === 'map') {
      stage.innerHTML = '<div class="map-board" style="background-image:url(\'' + IMAGES.campsite + '\')">' +
        (beat.spots || []).map(function (sp) {
          return '<button type="button" class="map-spot" style="left:' + sp.x + '%;top:' + sp.y + '%" data-id="' +
            escapeHtml(sp.id) + '">' + escapeHtml(sp.label) + '</button>';
        }).join('') + '</div>';
      stage.querySelectorAll('.map-spot').forEach(function (btn) {
        btn.addEventListener('click', function () { submitAnswer(btn.getAttribute('data-id')); });
      });
    } else if (type === 'move') {
      stage.innerHTML = '<button type="button" class="move-btn" id="move-done">' + escapeHtml(beat.doneLabel || 'I Did It') + '</button>';
      $('move-done').addEventListener('click', function () { submitAnswer('done'); });
    } else if (type === 'fish') {
      stage.innerHTML = '<div class="fish-arena"><div class="bobber" id="bobber"></div></div><button type="button" class="cast-mini" id="fish-cast">CAST</button>';
      $('fish-cast').addEventListener('click', tapFish);
      armFish();
    } else {
      stage.innerHTML = '<p class="empty-hint">Type or speak your try. You can also ask why.</p>';
      if ($('chat-in')) $('chat-in').focus();
    }
    updateNextBtn();
  }

  function tapOrder(id, btn) {
    var beat = currentBeat();
    if (!beat) return;
    if (orderPicked.indexOf(id) !== -1) return;
    orderPicked.push(id);
    btn.classList.add('on');
    var picked = $('order-picked');
    if (picked) {
      var chip = document.createElement('span');
      chip.className = 'order-chip on';
      chip.textContent = (orderPicked.length) + '. ' + btn.textContent;
      picked.appendChild(chip);
    }
    if (orderPicked.length === (beat.items || []).length) submitAnswer(orderPicked.slice());
  }

  function armFish() {
    fishGlow = false;
    var bob = $('bobber');
    if (bob) bob.classList.remove('glow');
    clearFish();
    fishTimer = setTimeout(function () {
      fishGlow = true;
      if ($('bobber')) $('bobber').classList.add('glow');
      sfx('chime');
    }, 900 + Math.floor(Math.random() * 1400));
  }

  function clearFish() {
    if (fishTimer) { clearTimeout(fishTimer); fishTimer = null; }
    fishGlow = false;
  }

  function tapFish() {
    if (fishGlow) {
      clearFish();
      submitAnswer('caught');
    } else {
      $('quest-hint').textContent = 'Wait for the bobber to glow.';
      setGuideMood('concerned');
      setTeacherFeedback('Not yet. Watch the glow, then tap.', 'queue', false);
      attempts += 1;
      persistQuest();
    }
  }

  function showPractice(on) {
    practiceMode = !!on;
    var el = $('practice-banner');
    if (el) el.hidden = !on;
  }

  function paintRoomChrome(subj) {
    var shell = $('room-shell');
    if (shell) shell.className = 'room-shell room-' + subj.id;
    $('quest-title').textContent = (activeQuest && activeQuest.title) || (subj.room || subj.name);
    $('quest-sub').textContent = (subj.room || subj.name) + ' · ' + subj.name;
    $('done-badge').className = 'done-badge';
  }

  function askClaude(extraUserText, reason) {
    if (!Teacher.callCaldris || !Teacher.buildCaldrisRequest) {
      showPractice(true);
      return Promise.resolve(null);
    }
    var seq = ++claudeSeq;
    var messages = questLog.slice();
    if (extraUserText) messages.push({ role: 'user', text: extraUserText });
    var payload = Teacher.buildCaldrisRequest({
      subjectId: activeQuest && activeQuest.subjectId,
      room: activeQuest && (activeQuest.room || (activeQuest.subject && activeQuest.subject.room)),
      objective: activeQuest && activeQuest.objective,
      practiceText: activeQuest ? CaldrisQuests.firstTeacherLine(activeQuest) : '',
      childName: (progress && progress.getProfile().name) || 'Matthew',
      messages: messages
    });
    if (extraUserText && (reason === 'user-question' || reason === 'check')) {
      questLog.push({ role: 'user', text: extraUserText });
    }
    return Teacher.callCaldris(payload).then(function (result) {
      if (seq !== claudeSeq) return null;
      refreshParentApiStatus();
      if (!result || !result.ok || !result.text) {
        showPractice(true);
        if (reason === 'user-question' && extraUserText && Teacher.practiceReply) {
          setTeacherFeedback(Teacher.practiceReply(extraUserText, activeQuest), 'queue', true);
          restateCurriculumPrompt('queue');
          persistQuest();
        }
        return null;
      }
      showPractice(false);
      var speakReason = reason === 'user-question' ? 'queue' : 'claude-arrive';
      setTeacherFeedback(result.text, speakReason, true);
      if (reason === 'user-question') restateCurriculumPrompt('queue');
      persistQuest();
      return result.text;
    });
  }

  function openQuest(subj) {
    var session = progress.getSession();
    if (session.completed && session.completed[subj.id]) return;
    if (voice) voice.skip();
    invalidateClaude();
    activeQuest = CaldrisQuests.buildQuest(subj.id, TODAY, getGrade(subj.id));
    var saved = progress.getQuestState(subj.id) || {};
    beatIndex = Math.min(saved.beatIndex || 0, activeQuest.beats.length);
    attempts = saved.attempts || 0;
    usingScaffold = !!saved.usingScaffold;
    questLog = Array.isArray(saved.log) ? saved.log.slice() : [];
    hadExchange = !!saved.hadExchange;
    if (beatIndex >= activeQuest.beats.length) {
      finishQuest();
      return;
    }
    paintRoomChrome(subj);
    showView('quest-view');
    renderBeat();
    var beat = currentBeat();
    var prompt = (Ownership.promptOnReopen && Ownership.promptOnReopen(beat, saved)) || (beat && beat.prompt) || '';
    setCurriculumPrompt(prompt, 'queue');
    if (!questLog.length && prompt) questLog.push({ role: 'caldris', text: prompt });
    persistQuest();
  }

  function submitAnswer(input) {
    var beat = currentBeat();
    if (!beat || !activeQuest) return;
    hadExchange = true;
    updateNextBtn();
    var rawBeat = activeQuest.beats[beatIndex];
    var result = CaldrisQuests.checkBeat(beat, input);
    var shown = Array.isArray(input) ? input.join(', ') : String(input);
    questLog.push({ role: 'user', text: shown });
    if (result.correct) {
      attempts = 0;
      usingScaffold = false;
      var line = pick(LINES.correct) || 'Yes! That is it.';
      $('sidekick-line').textContent = 'Yes! I felt that one.';
      setGuideMood('celebrating');
      sfx('complete');
      invalidateClaude();
      beatIndex += 1;
      persistQuest();
      if (beatIndex >= activeQuest.beats.length) {
        setTeacherFeedback(line, 'queue', true);
        finishQuest();
      } else {
        renderBeat();
        setTeacherFeedback(line, 'queue', true);
        restateCurriculumPrompt('queue');
      }
      return;
    }
    attempts += 1;
    var missLine = result.almost ? (pick(LINES.almost) || 'Almost.') : (pick(LINES.wrong) || 'Not that one.');
    var hint = (rawBeat && rawBeat.hint) || beat.hint || '';
    setTeacherFeedback(missLine + (hint ? ' ' + hint : ''), 'queue', true);
    $('quest-hint').textContent = hint || missLine;
    $('sidekick-line').textContent = 'Missed. Ask why, or try again.';
    setGuideMood('concerned');
    if (attempts >= 2 && !usingScaffold && (rawBeat.type === 'type' || rawBeat.type === 'speak')) {
      invalidateClaude();
      usingScaffold = true;
      persistQuest();
      renderBeat();
      restateCurriculumPrompt('queue');
      return;
    }
    persistQuest();
    if (beat.type === 'order') {
      orderPicked = [];
      renderBeat();
    }
    if (beat.type === 'fish') armFish();
    askClaude('I tried "' + shown + '" and it was not right. Hint, then give an easier try. Stay on this objective.', 'check');
  }

  function handleKidText(text) {
    var clean = String(text || '').trim();
    if (!clean || !activeQuest) return;
    hadExchange = true;
    updateNextBtn();
    if (isListening && recognition) {
      try { recognition.stop(); } catch (e) {}
    }
    var beat = currentBeat();
    var isQuestion = Teacher.looksLikeQuestion ? Teacher.looksLikeQuestion(clean) : /\?/.test(clean);
    if (!isQuestion && beat && (beat.type === 'type' || beat.type === 'speak')) {
      submitAnswer(clean);
      return;
    }
    if (voice) voice.skip();
    $('sidekick-line').textContent = 'Good question. Caldris is on it.';
    askClaude(clean, 'user-question');
  }

  function handleTypedSend() {
    var inp = $('chat-in');
    var text = (inp && inp.value || '').trim();
    if (!text) return;
    inp.value = '';
    userEditing = false;
    handleKidText(text);
  }

  function handleNext() {
    if (!hadExchange || !activeQuest) return;
    var beat = currentBeat();
    if (!beat) return;
    if (attempts >= 1 && !usingScaffold && (beat.type === 'type' || beat.type === 'speak')) {
      invalidateClaude();
      usingScaffold = true;
      persistQuest();
      renderBeat();
      restateCurriculumPrompt('queue');
      return;
    }
    restateCurriculumPrompt('queue');
  }

  function finishQuest() {
    if (!activeQuest) return;
    invalidateClaude();
    var id = activeQuest.subjectId;
    var wasUnlocked = progress.isTvUnlocked();
    var result = progress.completeSubject(id);
    if (fishing && result.awarded) fishing.awardCast(id);
    progress.saveSummary(id, questLog);
    persistQuest();
    $('done-badge').className = 'done-badge show';
    var doneLine = LINES.complete || 'You earned the stamp. This room is done for today.';
    setCurriculumPrompt(doneLine, 'queue');
    $('quest-stage').innerHTML = '<p class="passage quest-complete-pulse">Door sticker earned! The TV gate still needs every room. Fishing is only a bonus.</p>';
    sfx('complete');
    maybeCelebrateUnlock(wasUnlocked);
    if (finishTimer) clearTimeout(finishTimer);
    finishTimer = setTimeout(function () {
      activeQuest = null;
      showHub({ keepVoice: true });
    }, 4200);
  }

  function showHub(opts) {
    opts = opts || {};
    if (!opts.keepVoice && voice) voice.skip();
    invalidateClaude();
    clearFish();
    activeQuest = null;
    showView('hub-view');
    renderHub();
    if (inParentMode) {
      inParentMode = false;
      $('mode-toggle').textContent = '⚙ Parent Mode';
    }
  }

  function closeQuest() {
    if (voice) voice.skip();
    if (isListening && recognition) try { recognition.stop(); } catch (e) {}
    invalidateClaude();
    persistQuest();
    showHub();
  }

  function formatActivity(iso) {
    if (!iso) return 'No quests yet today';
    try {
      return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch (e) { return 'Recently'; }
  }

  function refreshParentApiStatus() {
    var el = $('teacher-api-status');
    if (!el || !Teacher.statusLabel) return;
    el.textContent = Teacher.statusLabel();
  }

  function renderParent() {
    var report = progress.getDayReport(parentViewDate);
    var session = progress.getSession();
    var profile = progress.getProfile();
    var isToday = !!report.isToday;
    var who = report.name || profile.name || 'Matthew';
    var xp = report.xp || 0;
    var doneCount = report.doneCount || 0;
    var tvOn = !!report.tvUnlocked;

    $('parent-title').textContent = isToday ? "Today's Report" : 'Daily Report';
    $('parent-date').textContent = progress.formatReportDate(parentViewDate);
    $('parent-prev-day').disabled = !progress.neighborDate(parentViewDate, -1);
    $('parent-next-day').disabled = !progress.neighborDate(parentViewDate, 1);

    var banner = $('yesterday-banner');
    var yesterday = progress.yesterdayDate();
    var nudge = isToday && !progress.hasReport(TODAY) && progress.hasReport(yesterday);
    banner.hidden = !nudge;
    banner.textContent = nudge ? (who + ' has a report from yesterday. Tap to see it.') : '';

    $('p-xp').textContent = xp;
    $('p-subjects').textContent = doneCount + '/5';
    $('p-tv').textContent = tvOn ? '🟢' : '🔴';

    var remaining = SUBJECTS.filter(function (sub) { return !report.completed[sub.id]; }).map(function (sub) { return sub.room || sub.name; });
    var statusMsg;
    if (doneCount === 0) {
      statusMsg = isToday ? (who + ' hasn’t started any rooms yet today.') : ('No recorded quests for ' + who + ' on this day.');
    } else if (doneCount === 5) {
      statusMsg = who + ' completed all 5 rooms' + (isToday ? ' today' : '') + ' — ' + xp + ' XP. ' + (tvOn ? 'Screen time is unlocked.' : 'TV is re-locked by parent override.');
    } else {
      statusMsg = doneCount + ' of 5 rooms done. Still needed: ' + remaining.join(', ') + '.';
    }
    $('allen-status').textContent = statusMsg;
    refreshParentApiStatus();
    $('snapshot-grid').innerHTML =
      '<div>TV: ' + (tvOn ? 'Unlocked' : 'Locked') + '</div>' +
      '<div>Rooms: ' + doneCount + '/5</div>' +
      '<div>XP: ' + xp + ' / ' + progress.dailyXpCap() + '</div>' +
      '<div>Streak: ' + (profile.streak || 0) + '</div>' +
      '<div>Last quest: ' + formatActivity(session.lastActivity) + '</div>' +
      '<div>Mic: ' + micState + '</div>' +
      '<div>Rank: ' + progress.getRank().title + '</div>' +
      '<div>Override: ' + (session.tvForce || 'auto') + '</div>';

    $('academy-subject-list').innerHTML = SUBJECTS.map(function (sub) {
      var done = !!(report.completed && report.completed[sub.id]);
      return '<div class="acad-item"><span>' + (done ? '✅' : '⬜') + '</span><span>' + sub.icon +
        '</span><span class="acad-name">' + escapeHtml(sub.room || sub.name) + '</span><span class="acad-level">' +
        escapeHtml(sub.name) + '</span></div>';
    }).join('');

    $('transcript-section-title').textContent = isToday ? "Today's Session Transcripts" : 'Session Transcripts';
    var daySummaries = report.summaries || {};
    var completedSubs = SUBJECTS.filter(function (sub) { return daySummaries[sub.id]; });
    var list = $('transcript-list');
    if (!completedSubs.length) {
      list.innerHTML = '<p class="empty-hint">' + (isToday ? 'No sessions completed yet today.' : 'No sessions recorded on this day.') + '</p>';
    } else {
      list.innerHTML = completedSubs.map(function (sub) {
        var sum = daySummaries[sub.id];
        var msgs = (sum.messages || []).map(function (m) {
          if (!m || !m.role || m.role === 'system') return '';
          var whoName = m.role === 'caldris' ? 'Caldris' : who;
          var css = m.role === 'caldris' ? 'caldris-msg' : 'user-msg';
          return '<div class="transcript-msg ' + css + '"><div class="who">' + escapeHtml(whoName) +
            '</div><div class="what">' + escapeHtml(m.text) + '</div></div>';
        }).join('');
        return '<div class="transcript-panel"><div class="transcript-header" data-toggle="1"><div><div class="transcript-subj">' +
          sub.icon + ' ' + escapeHtml(sub.room || sub.name) + '</div><div class="transcript-time">Completed at ' +
          escapeHtml(sum.completedAt || '') + '</div></div><div>▼</div></div><div class="transcript-body">' +
          (msgs || '<p class="empty-hint">No messages recorded.</p>') + '</div></div>';
      }).join('');
    }

    $('parent-quest-section').style.display = isToday ? '' : 'none';
    if (isToday) {
      $('parent-quest-list').innerHTML = SUBJECTS.map(function (sub) {
        var done = !!(report.completed && report.completed[sub.id]);
        return '<div class="parent-quest-item"><span>' + sub.icon + '</span><span class="parent-quest-name">' +
          escapeHtml(sub.room || sub.name) + '</span><button type="button" class="parent-quest-check' + (done ? ' done' : '') +
          '" data-qid="' + sub.id + '" aria-label="Toggle ' + escapeHtml(sub.name) + '">' + (done ? '✓' : '') +
          '</button></div>';
      }).join('');
    }
    $('incident-input-row').style.display = isToday ? 'flex' : 'none';
    $('parent-note-box').style.display = isToday ? '' : 'none';
    $('parent-reset-btn').style.display = isToday ? '' : 'none';
    $('pin-change-section').style.display = isToday ? '' : 'none';
    $('tv-override-section').style.display = isToday ? '' : 'none';
    renderIncidents(report.incidents || []);
  }

  function renderIncidents(incidents) {
    var list = $('incident-list');
    if (!list) return;
    if (!incidents.length) {
      list.innerHTML = '<p class="empty-hint">' + (parentViewDate === TODAY ? 'No incidents logged today.' : 'No incidents logged on this day.') + '</p>';
      return;
    }
    list.innerHTML = incidents.map(function (inc, i) {
      return '<div class="incident-item"><span style="color:var(--text2);font-size:12px;">' + escapeHtml(inc.time) +
        '</span> — ' + escapeHtml(inc.text) +
        (parentViewDate === TODAY ? ' <button type="button" data-del="' + i + '" aria-label="Remove">✕</button>' : '') +
        '</div>';
    }).join('');
  }

  function toggleParentQuest(id) {
    var s = progress.getSession();
    var wasDone = !!(s.completed && s.completed[id]);
    if (!wasDone) {
      progress.completeSubject(id);
      if (fishing) fishing.awardCast(id);
      progress.addIncident('Parent marked ' + id + ' complete.', 'quest');
    } else {
      progress.uncompleteSubject(id);
      progress.addIncident('Parent reset ' + id + '.', 'quest');
    }
    renderParent();
  }

  function enterParentMode() {
    inParentMode = true;
    parentViewDate = TODAY;
    $('mode-toggle').textContent = '← Back to Campus';
    if (voice) voice.skip();
    renderParent();
    showView('parent-view');
  }

  function showPinModal() {
    $('pin-overlay').classList.add('show');
    $('pin-input').value = '';
    $('pin-error').style.display = 'none';
    setTimeout(function () { $('pin-input').focus(); }, 50);
  }

  function confirmPin() {
    var entered = $('pin-input').value.trim();
    if (progress.verifyPin(entered)) {
      $('pin-overlay').classList.remove('show');
      $('pin-input').value = '';
      enterParentMode();
    } else {
      $('pin-error').style.display = 'block';
      $('pin-input').value = '';
      sfx('lock');
    }
  }

  function escapeFish(s) { return escapeHtml(s); }

  function renderGearRow() {
    if (!fishing) return;
    var gear = fishing.getGear();
    var row = $('gear-row');
    if (!row) return;
    row.innerHTML = [
      { key: 'pole', label: 'Pole', tier: gear.pole },
      { key: 'reel', label: 'Reel', tier: gear.reel },
      { key: 'lure', label: 'Lure', tier: gear.lure }
    ].map(function (p) {
      return '<div class="gear-piece ' + (p.tier ? 'on' : '') + '"><div class="g-name">' + p.label +
        '</div><div class="g-' + p.key + '"></div><div class="codex-meta">' + (p.tier ? 'Tier ' + p.tier : 'Not yet') + '</div></div>';
    }).join('');
  }

  function renderDock() {
    if (!fishing) return;
    var state = fishing.getState();
    var n = state.castsRemaining;
    $('dock-cast-count').textContent = n + (n === 1 ? ' cast ready' : ' casts ready');
    $('cast-status').textContent = n ? 'Tap CAST. I already picked a lucky ripple.' : 'Finish a room today and I will hand you a cast.';
    $('cast-btn').disabled = n < 1;
    $('dupe-hint').textContent = state.duplicateBank + ' / ' + CaldrisFishing.DUPES_PER_GEAR +
      ' duplicate fish toward the next ' + fishing.getGear().nextPiece + '. Gear is just for show. Fishing never unlocks TV.';
    renderGearRow();
  }

  function showCastResult(result) {
    var box = $('cast-result');
    if (!result.ok) {
      box.innerHTML = '<div class="buddy-line">No casts left. Go finish a room. I’ll wait. Dramatically.</div>';
      return;
    }
    if (!result.caught) {
      box.className = 'cast-result';
      box.innerHTML = '<div class="fish-rarity">The water shrugged</div><div class="buddy-line">' + escapeFish(result.line) + '</div>';
      speakTeacher(result.line, 'queue');
      return;
    }
    var extra = result.newSpecies ? 'New to the Codex.' : ('Caught ×' + result.count + (result.gearGained ? ' — gear upgraded!' : ''));
    box.className = 'cast-result hit';
    box.innerHTML = '<div class="fish-rarity rarity-' + result.rarity + '">' + result.rarity + '</div>' +
      '<div class="fish-art"><img src="' + result.species.art + '" alt="' + escapeFish(result.species.name) + '"></div>' +
      '<div class="fish-name">' + escapeFish(result.species.name) + '</div>' +
      '<div class="codex-meta">' + extra + '</div>' +
      '<div class="buddy-line">' + escapeFish(result.line) + '</div>';
    speakTeacher(result.line, 'queue');
  }

  function openDock() {
    if (!fishing) return;
    if (voice) voice.skip();
    renderDock();
    showView('dock-view');
  }

  function openCodex() {
    if (!fishing) return;
    if (voice) voice.skip();
    var entries = fishing.getCodex();
    var caught = entries.filter(function (e) { return e.caught; }).length;
    $('codex-progress').textContent = caught + ' / ' + entries.length + ' species';
    $('codex-grid').innerHTML = entries.map(function (e) {
      return '<div class="codex-row ' + (e.caught ? '' : 'locked') + '">' +
        '<div class="codex-thumb">' + (e.caught ? '<img src="' + e.art + '" alt="">' : '?') + '</div>' +
        '<div><div class="codex-name">' + (e.caught ? escapeFish(e.name) : 'Unknown fish') + '</div>' +
        '<div class="codex-meta"><span class="rarity-' + e.rarity + '">' + e.rarity + '</span>' +
        (e.caught ? ' · ×' + e.count : '') + '</div></div></div>';
    }).join('');
    showView('codex-view');
  }

  function openJournal() {
    var profile = progress.getProfile();
    var session = progress.getSession();
    $('journal-meta').textContent = progress.getRank().title + (profile.streak ? ' · ' + profile.streak + ' day streak' : '');
    $('stamp-book').innerHTML = SUBJECTS.map(function (sub) {
      var today = session.completed && session.completed[sub.id];
      var n = (profile.stampCounts && profile.stampCounts[sub.id]) || 0;
      return '<span class="stamp">' + (ROOM_EMOJI[sub.id] || sub.icon) + ' ' + escapeHtml(sub.room || sub.name) + (today ? ' ✓ today' : '') + ' · ×' + n + '</span>';
    }).join('') || '<p class="empty-hint">Finish a room to earn your first stamp.</p>';
    if (fishing) {
      var entries = fishing.getCodex().filter(function (e) { return e.caught; });
      $('journal-fish').innerHTML = entries.length ? entries.map(function (e) {
        return '<div class="codex-row"><div class="codex-thumb"><img src="' + e.art + '" alt=""></div><div><div class="codex-name">' +
          escapeFish(e.name) + '</div><div class="codex-meta">×' + e.count + '</div></div></div>';
      }).join('') : '<p class="empty-hint">No fish yet. Cast at the dock after a room.</p>';
    }
    showView('journal-view');
  }

  function hotspotBoard() {
    if (teacherLine) replayTeacher();
    else if (activeQuest && activeQuest.teach) speakTeacher(activeQuest.teach, 'queue');
  }

  function hotspotBook() {
    var beat = currentBeat();
    var hint = (beat && beat.hint) || (activeQuest && activeQuest.teach) || 'Look at the board, then try one card.';
    $('quest-hint').textContent = hint;
    speakTeacher(hint, 'queue');
  }

  function hotspotStars() {
    if (!progress) return;
    var session = progress.getSession();
    var profile = progress.getProfile();
    var lines = SUBJECTS.map(function (sub) {
      var today = session.completed && session.completed[sub.id];
      return (today ? '⭐ ' : '☆ ') + (sub.room || sub.name);
    });
    var html = '<div class="star-jar-pop">' + lines.map(function (l) { return escapeHtml(l); }).join('<br>') +
      '<div class="codex-meta">Stamps never unlock TV by themselves. All 5 rooms still required.</div></div>';
    var stage = $('quest-stage');
    if (stage) {
      var pop = document.createElement('div');
      pop.innerHTML = html;
      stage.insertBefore(pop, stage.firstChild);
      setTimeout(function () { if (pop.parentNode) pop.parentNode.removeChild(pop); }, 4000);
    }
    speakTeacher('Here are your room stars. TV still needs every stamp. You have ' + (profile.streak || 0) + ' streak days.', 'queue');
  }

  function doSetup() {
    var name = $('setup-name').value.trim() || 'Matthew';
    var pin = $('setup-pin').value.trim();
    if (pin.length !== 4 || !/^\d{4}$/.test(pin)) {
      alert('PIN must be 4 digits.');
      return;
    }
    progress.saveProfile({ name: name, pin: pin, setupDone: true });
    $('setup-pin').value = '';
    $('setup-screen').hidden = true;
    showHub();
  }

  function bind() {
    $('setup-btn').addEventListener('click', doSetup);
    $('enable-sound-btn').addEventListener('click', enableSound);
    $('tap-to-hear-btn').addEventListener('click', function () {
      voiceGestureDone = true;
      if (!settings.ttsEnabled) enableSound();
      else replayTeacher();
      showTapToHear(false);
    });
    $('teacher-speaker').addEventListener('click', toggleTeacherSpeaker);
    $('replay-btn').addEventListener('click', replayTeacher);
    $('skip-talk-btn').addEventListener('click', skipTalking);
    $('next-btn').addEventListener('click', handleNext);
    $('hot-board').addEventListener('click', hotspotBoard);
    $('hot-book').addEventListener('click', hotspotBook);
    $('hot-stars').addEventListener('click', hotspotStars);
    $('quest-back').addEventListener('click', closeQuest);
    $('mic-btn').addEventListener('click', toggleMic);
    $('send-btn').addEventListener('click', handleTypedSend);
    $('chat-in').addEventListener('focus', function () {
      userEditing = true;
      if (isListening && recognition) try { recognition.stop(); } catch (e) {}
    });
    $('chat-in').addEventListener('input', function () {
      this.style.height = 'auto';
      this.style.height = Math.min(this.scrollHeight, 120) + 'px';
    });
    $('chat-in').addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleTypedSend(); }
    });
    $('tv-banner').addEventListener('click', function () {
      if (progress && !progress.isTvUnlocked()) {
        speakTeacher(LINES.skip, 'queue');
        $('hub-line').textContent = LINES.skip;
        sfx('lock');
      }
    });
    $('dock-banner').addEventListener('click', openDock);
    $('dock-banner').addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openDock(); }
    });
    $('journal-link').addEventListener('click', openJournal);
    $('open-codex-btn').addEventListener('click', openCodex);
    $('dock-back').addEventListener('click', showHub);
    $('codex-back').addEventListener('click', showHub);
    $('journal-back').addEventListener('click', showHub);
    $('cast-btn').addEventListener('click', function () {
      if (!fishing || fishing.getState().castsRemaining < 1) return;
      $('cast-btn').disabled = true;
      $('cast-status').textContent = 'Line is out…';
      setTimeout(function () {
        showCastResult(fishing.cast());
        renderDock();
      }, 900 + Math.floor(Math.random() * 700));
    });
    $('mode-toggle').addEventListener('click', function () {
      if (inParentMode) { inParentMode = false; $('mode-toggle').textContent = '⚙ Parent Mode'; showHub(); }
      else if (!progress.getProfile().pin) enterParentMode();
      else showPinModal();
    });
    $('pin-cancel').addEventListener('click', function () { $('pin-overlay').classList.remove('show'); });
    $('pin-confirm').addEventListener('click', confirmPin);
    $('pin-input').addEventListener('keydown', function (e) { if (e.key === 'Enter') confirmPin(); });
    $('parent-prev-day').addEventListener('click', function () {
      var next = progress.neighborDate(parentViewDate, -1);
      if (next) { parentViewDate = next; renderParent(); }
    });
    $('parent-next-day').addEventListener('click', function () {
      var next = progress.neighborDate(parentViewDate, 1);
      if (next) { parentViewDate = next; renderParent(); }
    });
    $('yesterday-banner').addEventListener('click', function () {
      parentViewDate = progress.yesterdayDate();
      renderParent();
    });
    $('tv-unlock-btn').addEventListener('click', function () {
      progress.setTvForce('unlock', 'Parent unlocked TV today (override).');
      renderParent();
    });
    $('tv-lock-btn').addEventListener('click', function () {
      progress.setTvForce('lock', 'Parent re-locked TV.');
      renderParent();
    });
    $('log-incident-btn').addEventListener('click', function () {
      var val = $('incident-input').value.trim();
      if (!val) return;
      progress.addIncident(val, 'note');
      $('incident-input').value = '';
      renderParent();
    });
    $('incident-list').addEventListener('click', function (e) {
      var del = e.target.getAttribute('data-del');
      if (del == null) return;
      progress.removeIncident(parseInt(del, 10));
      renderParent();
    });
    $('parent-quest-list').addEventListener('click', function (e) {
      var id = e.target.getAttribute('data-qid');
      if (id) toggleParentQuest(id);
    });
    $('transcript-list').addEventListener('click', function (e) {
      var header = e.target.closest('.transcript-header');
      if (!header) return;
      header.nextElementSibling.classList.toggle('open');
    });
    $('pin-change-btn').addEventListener('click', function () {
      var res = progress.changePin($('pin-old').value.trim(), $('pin-new').value.trim());
      var msg = $('pin-change-msg');
      if (res.ok) {
        msg.textContent = 'PIN updated.';
        $('pin-old').value = '';
        $('pin-new').value = '';
        progress.addIncident('Parent changed the PIN.', 'pin');
      } else {
        msg.textContent = res.error === 'current' ? 'Current PIN did not match.' : 'New PIN must be 4 digits.';
      }
    });
    $('parent-reset-btn').addEventListener('click', function () {
      if (!confirm('Reset today’s child progress and re-lock TV? Parent PIN, settings, and past days stay.')) return;
      progress.resetDay();
      if (fishing) fishing.resetDaily();
      inParentMode = false;
      $('mode-toggle').textContent = '⚙ Parent Mode';
      showHub();
    });
  }

  function boot() {
    if (!progress) return;
    if (window.speechSynthesis) {
      speechSynthesis.onvoiceschanged = initVoiceList;
      initVoiceList();
    }
    if (settings.ttsEnabled && voice) voice.enable();
    persistSettings();
    bind();
    var profile = progress.getProfile();
    if (!profile.setupDone) {
      $('setup-screen').hidden = false;
      $('mode-toggle').style.display = 'none';
    } else {
      showHub({ keepVoice: true });
    }
  }

  boot();
})();
