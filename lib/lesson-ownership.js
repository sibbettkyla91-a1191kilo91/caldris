(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.CaldrisLessonOwnership = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  function promptFromBeat(beat) {
    if (!beat || beat.prompt == null) return '';
    return String(beat.prompt).trim();
  }

  // Saved Claude teacherLine must never win over the live beat.
  function promptOnReopen(beat, saved) {
    return promptFromBeat(beat);
  }

  function nextSeq(seq) {
    return (Number(seq) || 0) + 1;
  }

  function isStale(requestSeq, liveSeq) {
    return requestSeq !== liveSeq;
  }

  function claudeMayWriteCurriculumPrompt() {
    return false;
  }

  function claudeMayAdvanceBeat() {
    return false;
  }

  function controlsSignature(beat) {
    if (!beat) return '';
    return [
      beat.type || '',
      JSON.stringify(beat.options || null),
      JSON.stringify(beat.items || null),
      JSON.stringify(beat.spots || null),
      JSON.stringify(beat.accepted || null),
      String(beat.correct == null ? '' : beat.correct)
    ].join('|');
  }

  function liveBeat(quest, state, scaffoldFor) {
    if (!quest || !state) return null;
    var raw = quest.beats && quest.beats[state.beatIndex];
    if (!raw) return null;
    if (state.usingScaffold && typeof scaffoldFor === 'function') {
      return scaffoldFor(raw);
    }
    return raw;
  }

  function afterCorrect(state) {
    return {
      beatIndex: (Number(state && state.beatIndex) || 0) + 1,
      claudeSeq: nextSeq(state && state.claudeSeq),
      usingScaffold: false,
      attempts: 0
    };
  }

  function afterScaffold(state) {
    return {
      beatIndex: Number(state && state.beatIndex) || 0,
      claudeSeq: nextSeq(state && state.claudeSeq),
      usingScaffold: true,
      attempts: Number(state && state.attempts) || 0
    };
  }

  function afterUserQuestion(state) {
    return {
      beatIndex: Number(state && state.beatIndex) || 0,
      usingScaffold: !!(state && state.usingScaffold),
      attempts: Number(state && state.attempts) || 0,
      claudeSeq: Number(state && state.claudeSeq) || 0
    };
  }

  // Claude text can never replace the live curriculum prompt.
  function applyClaudeToPrompt(requestSeq, liveSeq, livePrompt, claudeText) {
    if (isStale(requestSeq, liveSeq)) return livePrompt;
    if (!claudeMayWriteCurriculumPrompt()) return livePrompt;
    return claudeText;
  }

  return {
    promptFromBeat: promptFromBeat,
    promptOnReopen: promptOnReopen,
    nextSeq: nextSeq,
    isStale: isStale,
    claudeMayWriteCurriculumPrompt: claudeMayWriteCurriculumPrompt,
    claudeMayAdvanceBeat: claudeMayAdvanceBeat,
    controlsSignature: controlsSignature,
    liveBeat: liveBeat,
    afterCorrect: afterCorrect,
    afterScaffold: afterScaffold,
    afterUserQuestion: afterUserQuestion,
    applyClaudeToPrompt: applyClaudeToPrompt
  };
});
