(function () {
  'use strict';

  var TODAY = new Date().toDateString();
  var SUBJECTS = (window.CaldrisQuests && CaldrisQuests.SUBJECTS) || [];
  var progress = window.CaldrisProgress && CaldrisProgress.create({ today: TODAY, subjects: SUBJECTS });
  var fishing = window.CaldrisFishing && CaldrisFishing.create({ today: TODAY });
  var IMAGES = {
    mainRealm: 'assets/images/realm-main.jpg',
    campsite: 'assets/images/realm-campsite.jpg',
    player: 'assets/images/matthew.png',
    caldris: 'assets/images/caldris.jpg',
    sidekick: 'assets/images/sidekick.png'
  };
  var LEVELS_KEY = 'mq_levels_v1';
  var LINES = (window.CaldrisQuests && CaldrisQuests.CALDRIS) || {};

  var settings = progress ? progress.getSettings() : { soundEnabled: false, ttsEnabled: false };
  var caldrisVoice = null;
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

  function $(id) { return document.getElementById(id); }
  function escapeHtml(s) {
    return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function pick(list) {
    if (!list || !list.length) return '';
    return list[Math.floor(Math.random() * list.length)];
  }

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
    var btn = $('sound-toggle');
    if (btn) {
      btn.textContent = settings.soundEnabled ? '🔊' : '🔇';
      btn.className = 'icon-btn' + (settings.soundEnabled ? '' : ' muted');
    }
    var banner = $('sound-banner');
    if (banner) banner.hidden = settings.soundEnabled;
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

  function initVoice() {
    if (!window.speechSynthesis) return;
    var voices = speechSynthesis.getVoices() || [];
    var prefer = ['Google UK English Male', 'Daniel', 'Arthur', 'Google US English'];
    for (var i = 0; i < prefer.length; i++) {
      var hit = voices.find(function (v) { return v && v.name === prefer[i]; });
      if (hit) { caldrisVoice = hit; return; }
    }
    caldrisVoice = voices.find(function (v) { return v && /^en/i.test(v.lang || ''); }) || voices[0] || null;
  }

  function stopSpeaking() {
    if (window.speechSynthesis) speechSynthesis.cancel();
    setGuideMood('');
  }

  function speak(text) {
    if (!settings.ttsEnabled || !window.speechSynthesis) return;
    var clean = String(text || '').replace(/[#_*`]/g, '').trim();
    if (!clean) return;
    speechSynthesis.cancel();
    var u = new SpeechSynthesisUtterance(clean);
    if (caldrisVoice) u.voice = caldrisVoice;
    u.rate = 0.92; u.pitch = 1.05; u.volume = 0.85;
    u.onstart = function () { setGuideMood('talking'); };
    u.onend = u.onerror = function () { setGuideMood(''); };
    speechSynthesis.speak(u);
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
    persistSettings();
    sfx('chime');
    speak('The realm is listening. I am Caldris. Your quests still stand.');
  }

  function toggleSound() {
    settings.soundEnabled = !settings.soundEnabled;
    settings.ttsEnabled = settings.soundEnabled;
    persistSettings();
    if (!settings.soundEnabled) stopSpeaking();
    else sfx('chime');
  }

  function initSR() {
    var SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { micState = 'unsupported'; return false; }
    recognition = new SR();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = 'en-US';
    recognition.onresult = function (e) {
      if (userEditing) return;
      var transcript = e.results[0][0].transcript;
      var inp = $('chat-in');
      if (inp) {
        inp.value = transcript;
        inp.style.height = 'auto';
        inp.style.height = Math.min(inp.scrollHeight, 100) + 'px';
      }
      micState = 'granted';
    };
    recognition.onend = function () { isListening = false; updateMic(); };
    recognition.onerror = function (ev) {
      isListening = false;
      if (ev && ev.error === 'not-allowed') micState = 'denied';
      updateMic();
    };
    return true;
  }

  function toggleMic() {
    var inp = $('chat-in');
    if (!recognition && !initSR()) {
      setMicStatus('Voice isn’t available here. Type your answer — the quest still counts.');
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
      setMicStatus('Mic is busy. Type your answer instead.');
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
      btn.disabled = micState === 'unsupported' ? false : false;
    }
    if (isListening) setMicStatus('Listening… speak your answer', true);
    else if (micState === 'denied') setMicStatus('Mic blocked. Type your answer — that still counts.');
    else if (micState === 'unsupported') setMicStatus('Type your answer. Voice isn’t on this device.');
    else setMicStatus('Tap 🎤 to speak your answer, or type it.');
  }

  function showView(id) {
    document.querySelectorAll('.view').forEach(function (v) { v.classList.remove('active'); });
    var el = $(id);
    if (el) el.classList.add('active');
    window.scrollTo(0, 0);
    var toggle = $('mode-toggle');
    if (toggle) toggle.style.display = (id === 'quest-view') ? 'none' : 'block';
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
      d.style.background = i % 2 ? '#e8c86a' : '#7b5ea7';
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
    speak(LINES.unlock || 'The gateway opens. You earned this day.');
    progress.markUnlockCelebrated();
  }

  function hubLine(session, unlocked) {
    var done = progress.countDone(session.completed);
    if (unlocked) return 'The gateway is open. Rest, play, and return tomorrow with a clean slate.';
    if (done === 0) return 'Matthew, the academy lanterns are lit. Start any quest — I will walk it with you.';
    return 'The gate opens when the day’s quests are done. The path back is always open tomorrow.';
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
    $('streak-chip').textContent = (profile.streak ? '🔥 ' + profile.streak + ' day streak · ' : '✦ ') + rank.title;
    $('hub-line').textContent = hubLine(session, unlocked);

    $('xp-display').textContent = xp + ' / ' + cap + ' XP';
    var bar = $('xp-bar');
    var pct = cap ? Math.min(100, (xp / cap) * 100) : 0;
    if (xp > lastXp) bar.classList.add('burst');
    requestAnimationFrame(function () { bar.style.width = pct + '%'; });
    setTimeout(function () { bar.classList.remove('burst'); }, 700);
    lastXp = xp;
    $('threshold-text').textContent = unlocked
      ? 'All quests complete. XP was the cheer, not the key.'
      : (5 - done) + ' quest' + (done === 4 ? '' : 's') + ' still keep the gate closed.';

    var banner = $('tv-banner');
    banner.className = 'tv-banner' + (unlocked ? ' unlocked' : '');
    $('tv-icon').textContent = unlocked ? '📺✅' : '📺🔒';
    $('tv-status-main').textContent = unlocked ? 'UNLOCKED' : 'LOCKED';
    $('tv-status-main').className = 'tv-status-main' + (unlocked ? ' go' : '');
    $('tv-status-sub').textContent = unlocked
      ? 'Gateway is open — great work today!'
      : 'Complete all 5 quests to unlock';

    var box = $('subjects');
    box.innerHTML = '';
    if (!SUBJECTS.length) {
      box.innerHTML = '<p class="empty-hint">No quests are packed. Start here once subjects load.</p>';
    }
    SUBJECTS.forEach(function (subj) {
      var isDone = !!(session.completed && session.completed[subj.id]);
      var card = document.createElement('button');
      card.type = 'button';
      card.className = 'subject-card' + (isDone ? ' done' : ' ready');
      card.style.borderLeft = '3px solid ' + subj.color;
      card.setAttribute('aria-label', subj.name + (isDone ? ' complete' : ' ready'));
      card.innerHTML =
        '<div class="subj-icon" style="background:' + subj.ibg + '">' + subj.icon + '</div>' +
        '<div class="subj-info"><div class="subj-name">' + escapeHtml(subj.name) + '</div>' +
        '<div class="subj-desc">' + escapeHtml(subj.flavor || subj.desc) + '</div></div>' +
        '<div><div class="subj-xp">+' + subj.xp + ' XP</div>' +
        (isDone ? '<div class="subj-done-badge">✦ STAMPED</div>' : '') + '</div>';
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
    el.textContent = n ? (n + (n === 1 ? ' cast ready' : ' casts ready')) : 'Finish a quest to earn a cast';
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
      title: activeQuest.title
    });
  }

  function setTypeBar(on) {
    var bar = $('type-bar');
    var mic = $('mic-status-bar');
    if (bar) bar.style.display = on ? 'flex' : 'none';
    if (mic) mic.style.display = on ? 'flex' : 'none';
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
    $('sidekick-line').textContent = usingScaffold ? 'Pick the true stone. No rush.' : 'I’ve got snacks and opinions.';
    renderDots();
    if (activeQuest.passage && beatIndex === 0) {
      passage.classList.remove('hidden');
      passage.textContent = activeQuest.passage;
    } else if (activeQuest.passage && beat.type === 'tap' && beatIndex < 2) {
      passage.classList.remove('hidden');
      passage.textContent = activeQuest.passage;
    } else {
      passage.classList.add('hidden');
    }
    $('quest-prompt').textContent = beat.prompt;
    speak(beat.prompt);
    orderPicked = [];
    clearFish();
    var type = beat.type;
    setTypeBar(type === 'type' || type === 'speak');
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
      stage.innerHTML = '';
      $('chat-in').value = '';
      $('chat-in').focus();
    }
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
      $('quest-hint').textContent = 'Wait for the bobber to glow. Patience is the spell.';
      setGuideMood('concerned');
      speak('Not yet. Watch the glow.');
      attempts += 1;
      persistQuest();
    }
  }

  function openQuest(subj) {
    var session = progress.getSession();
    if (session.completed && session.completed[subj.id]) return;
    stopSpeaking();
    activeQuest = CaldrisQuests.buildQuest(subj.id, TODAY, getGrade(subj.id));
    var saved = progress.getQuestState(subj.id) || {};
    beatIndex = Math.min(saved.beatIndex || 0, activeQuest.beats.length);
    attempts = saved.attempts || 0;
    usingScaffold = !!saved.usingScaffold;
    questLog = Array.isArray(saved.log) ? saved.log.slice() : [];
    if (beatIndex >= activeQuest.beats.length) {
      finishQuest();
      return;
    }
    $('quest-title').textContent = activeQuest.title;
    $('quest-sub').textContent = subj.name + ' · ' + (subj.flavor || '');
    $('done-badge').className = 'done-badge';
    showView('quest-view');
    if (!questLog.length) {
      var hook = activeQuest.hook;
      questLog.push({ role: 'caldris', text: hook });
      $('hub-line').textContent = hook;
      speak(hook);
    }
    renderBeat();
    persistQuest();
  }

  function submitAnswer(input) {
    var beat = currentBeat();
    if (!beat || !activeQuest) return;
    var rawBeat = activeQuest.beats[beatIndex];
    var result = CaldrisQuests.checkBeat(beat, input);
    var shown = Array.isArray(input) ? input.join(', ') : String(input);
    questLog.push({ role: 'user', text: shown });
    if (result.correct) {
      attempts = 0;
      usingScaffold = false;
      var line = pick(LINES.correct) || 'True. On we go.';
      questLog.push({ role: 'caldris', text: line });
      $('sidekick-line').textContent = 'Yes! I felt that one in my fins.';
      setGuideMood('celebrating');
      sfx('complete');
      speak(line);
      beatIndex += 1;
      persistQuest();
      if (beatIndex >= activeQuest.beats.length) {
        finishQuest();
      } else {
        setTimeout(renderBeat, 450);
      }
      return;
    }
    attempts += 1;
    var missLine = result.almost ? (pick(LINES.almost) || 'Almost.') : (pick(LINES.wrong) || 'Not that one.');
    questLog.push({ role: 'caldris', text: missLine });
    $('quest-hint').textContent = (rawBeat && rawBeat.hint) || beat.hint || missLine;
    $('sidekick-line').textContent = 'Missed. Not a failure — a scout.';
    setGuideMood('concerned');
    speak(missLine + ' ' + (rawBeat && rawBeat.hint ? rawBeat.hint : ''));
    if (attempts >= 2 && !usingScaffold && (rawBeat.type === 'type' || rawBeat.type === 'speak')) {
      usingScaffold = true;
      persistQuest();
      renderBeat();
      return;
    }
    persistQuest();
    if (beat.type === 'order') {
      orderPicked = [];
      renderBeat();
    }
    if (beat.type === 'fish') armFish();
  }

  function handleTypedSend() {
    var inp = $('chat-in');
    var text = (inp && inp.value || '').trim();
    if (!text) return;
    inp.value = '';
    userEditing = false;
    submitAnswer(text);
  }

  function finishQuest() {
    if (!activeQuest) return;
    var id = activeQuest.subjectId;
    var wasUnlocked = progress.isTvUnlocked();
    var result = progress.completeSubject(id);
    if (fishing && result.awarded) fishing.awardCast(id);
    progress.saveSummary(id, questLog);
    persistQuest();
    $('done-badge').className = 'done-badge show';
    $('quest-prompt').textContent = LINES.complete || 'Stamp earned.';
    $('quest-stage').innerHTML = '<p class="passage quest-complete-pulse">The banner checks off on the map. The gate still needs every quest — fishing is only a bonus.</p>';
    setTypeBar(false);
    sfx('complete');
    speak(LINES.complete || 'Stamp earned.');
    maybeCelebrateUnlock(wasUnlocked);
    setTimeout(function () {
      activeQuest = null;
      showHub();
    }, 1600);
  }

  function showHub() {
    stopSpeaking();
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
    stopSpeaking();
    if (isListening && recognition) try { recognition.stop(); } catch (e) {}
    persistQuest();
    showHub();
  }

  function formatActivity(iso) {
    if (!iso) return 'No quests yet today';
    try {
      return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch (e) { return 'Recently'; }
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

    var remaining = SUBJECTS.filter(function (sub) { return !report.completed[sub.id]; }).map(function (sub) { return sub.name; });
    var statusMsg;
    if (doneCount === 0) {
      statusMsg = isToday ? (who + ' hasn’t started any quests yet today.') : ('No recorded quests for ' + who + ' on this day.');
    } else if (doneCount === 5) {
      statusMsg = who + ' completed all 5 quests' + (isToday ? ' today' : '') + ' — ' + xp + ' XP. ' + (tvOn ? 'Screen time is unlocked.' : 'TV is re-locked by parent override.');
    } else {
      statusMsg = doneCount + ' of 5 quests done. Still needed: ' + remaining.join(', ') + '.';
    }
    $('allen-status').textContent = statusMsg;
    $('snapshot-grid').innerHTML =
      '<div>TV: ' + (tvOn ? 'Unlocked' : 'Locked') + '</div>' +
      '<div>Quests: ' + doneCount + '/5</div>' +
      '<div>XP: ' + xp + ' / ' + progress.dailyXpCap() + '</div>' +
      '<div>Streak: ' + (profile.streak || 0) + '</div>' +
      '<div>Last quest: ' + formatActivity(session.lastActivity) + '</div>' +
      '<div>Mic: ' + micState + '</div>' +
      '<div>Rank: ' + progress.getRank().title + '</div>' +
      '<div>Override: ' + (session.tvForce || 'auto') + '</div>';

    $('academy-subject-list').innerHTML = SUBJECTS.map(function (sub) {
      var done = !!(report.completed && report.completed[sub.id]);
      return '<div class="acad-item"><span>' + (done ? '✅' : '⬜') + '</span><span>' + sub.icon +
        '</span><span class="acad-name">' + escapeHtml(sub.name) + '</span><span class="acad-level">' +
        escapeHtml(sub.flavor) + '</span></div>';
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
          sub.icon + ' ' + escapeHtml(sub.name) + '</div><div class="transcript-time">Completed at ' +
          escapeHtml(sum.completedAt || '') + '</div></div><div>▼</div></div><div class="transcript-body">' +
          (msgs || '<p class="empty-hint">No messages recorded.</p>') + '</div></div>';
      }).join('');
    }

    $('parent-quest-section').style.display = isToday ? '' : 'none';
    if (isToday) {
      $('parent-quest-list').innerHTML = SUBJECTS.map(function (sub) {
        var done = !!(report.completed && report.completed[sub.id]);
        return '<div class="parent-quest-item"><span>' + sub.icon + '</span><span class="parent-quest-name">' +
          escapeHtml(sub.name) + '</span><button type="button" class="parent-quest-check' + (done ? ' done' : '') +
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
    $('mode-toggle').textContent = '← Back to Quest Hub';
    stopSpeaking();
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
    $('cast-status').textContent = n ? 'Tap CAST. I already picked a lucky ripple.' : 'Finish a quest today and I will hand you a cast.';
    $('cast-btn').disabled = n < 1;
    $('dupe-hint').textContent = state.duplicateBank + ' / ' + CaldrisFishing.DUPES_PER_GEAR +
      ' duplicate fish toward the next ' + fishing.getGear().nextPiece + '. Gear is just for show. Fishing never unlocks TV.';
    renderGearRow();
  }

  function showCastResult(result) {
    var box = $('cast-result');
    if (!result.ok) {
      box.innerHTML = '<div class="buddy-line">No casts left. Go finish a quest. I’ll wait. Dramatically.</div>';
      return;
    }
    if (!result.caught) {
      box.className = 'cast-result';
      box.innerHTML = '<div class="fish-rarity">The water shrugged</div><div class="buddy-line">' + escapeFish(result.line) + '</div>';
      speak(result.line);
      return;
    }
    var extra = result.newSpecies ? 'New to the Codex.' : ('Caught ×' + result.count + (result.gearGained ? ' — gear upgraded!' : ''));
    box.className = 'cast-result hit';
    box.innerHTML = '<div class="fish-rarity rarity-' + result.rarity + '">' + result.rarity + '</div>' +
      '<div class="fish-art"><img src="' + result.species.art + '" alt="' + escapeFish(result.species.name) + '"></div>' +
      '<div class="fish-name">' + escapeFish(result.species.name) + '</div>' +
      '<div class="codex-meta">' + extra + '</div>' +
      '<div class="buddy-line">' + escapeFish(result.line) + '</div>';
    speak(result.line);
  }

  function openDock() {
    if (!fishing) return;
    stopSpeaking();
    renderDock();
    showView('dock-view');
  }

  function openCodex() {
    if (!fishing) return;
    stopSpeaking();
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
      return '<span class="stamp">' + sub.icon + ' ' + escapeHtml(sub.name) + (today ? ' ✓ today' : '') + ' · ×' + n + '</span>';
    }).join('') || '<p class="empty-hint">Finish a quest to earn your first stamp.</p>';
    if (fishing) {
      var entries = fishing.getCodex().filter(function (e) { return e.caught; });
      $('journal-fish').innerHTML = entries.length ? entries.map(function (e) {
        return '<div class="codex-row"><div class="codex-thumb"><img src="' + e.art + '" alt=""></div><div><div class="codex-name">' +
          escapeFish(e.name) + '</div><div class="codex-meta">×' + e.count + '</div></div></div>';
      }).join('') : '<p class="empty-hint">No fish yet. Cast at the dock after a quest.</p>';
    }
    showView('journal-view');
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
    $('sound-toggle').addEventListener('click', toggleSound);
    $('quest-back').addEventListener('click', closeQuest);
    $('mic-btn').addEventListener('click', toggleMic);
    $('send-btn').addEventListener('click', handleTypedSend);
    $('chat-in').addEventListener('focus', function () {
      userEditing = true;
      if (isListening && recognition) try { recognition.stop(); } catch (e) {}
    });
    $('chat-in').addEventListener('input', function () {
      this.style.height = 'auto';
      this.style.height = Math.min(this.scrollHeight, 100) + 'px';
    });
    $('chat-in').addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleTypedSend(); }
    });
    $('tv-banner').addEventListener('click', function () {
      if (progress && !progress.isTvUnlocked()) {
        speak(LINES.skip);
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
      speechSynthesis.onvoiceschanged = initVoice;
      initVoice();
    }
    persistSettings();
    bind();
    var profile = progress.getProfile();
    if (!profile.setupDone) {
      $('setup-screen').hidden = false;
      $('mode-toggle').style.display = 'none';
    } else {
      showHub();
    }
  }

  boot();
})();
