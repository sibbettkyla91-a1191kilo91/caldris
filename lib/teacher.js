(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.CaldrisTeacher = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // Primary teaching model. This project moved off retired Claude Sonnet 4
  // onto the claude-sonnet-5 alias the existing Anthropic key expects.
  // If that alias 404s, the client retries the current Sonnet 4.5 id, then
  // the Claude 3.5 Sonnet compatibility alias.
  var DEFAULT_MODEL = 'claude-sonnet-5';
  var FALLBACK_MODELS = ['claude-sonnet-4-5', 'claude-3-5-sonnet-latest'];
  var MAX_TOKENS = 900;
  var HISTORY_LIMIT = 8;
  var CHILD_NAME = 'Matthew';
  var TEACHER_NAME = 'Caldris';

  var lastApiStatus = { status: 'idle', code: null, at: null, model: null, detail: '' };

  var ROOMS = {
    reading: 'Reading Treehouse',
    writing: 'Writing Desk',
    math: 'Math Workshop',
    life: 'Life Skills Kitchen',
    pe: 'Nature Lab'
  };

  var DEFAULT_OBJECTIVES = {
    reading: 'Read a short 2–4 sentence passage and answer questions about THAT passage.',
    writing: 'Spell everyday words and write one complete sentence with a capital and a period.',
    math: 'Add two small numbers by counting on from the first number.',
    life: 'Practice one everyday kindness or safety skill.',
    pe: 'Move your body on purpose, then notice breath and rest.'
  };

  function roomForSubject(subjectId) {
    return ROOMS[subjectId] || 'Classroom';
  }

  function defaultObjective(subjectId) {
    return DEFAULT_OBJECTIVES[subjectId] || 'Learn one small idea, then try it.';
  }

  function looksLikeQuestion(text) {
    var t = String(text || '').trim();
    if (!t) return false;
    if (/\?/.test(t)) return true;
    return /^(why|what|how|who|where|when|can|could|would|will|is|are|do|does|did|tell|please|help|explain)\b/i.test(t);
  }

  function buildSystemPrompt(opts) {
    opts = opts || {};
    var child = opts.childName || CHILD_NAME;
    var teacher = opts.teacherName || TEACHER_NAME;
    var room = opts.room || roomForSubject(opts.subjectId);
    var objective = opts.objective || defaultObjective(opts.subjectId);
    var practice = opts.practiceText ? ('Practice-mode first paint (same objective, do not change the subject):\n' + opts.practiceText + '\n') : '';
    return [
      'You are ' + teacher + ', a warm, playful classroom teacher for ' + child + ', a child about 6–10 years old.',
      'You are in the ' + room + ' right now.',
      'Today this session has ONE objective: ' + objective,
      '',
      'Hard rules:',
      '- Two-way Q&A is always allowed. If ' + child + ' asks something, answer it. Never freeze. Never ignore the question.',
      '- Then steer back to this room and this objective. Do not start a new subject.',
      '- Off-topic (TV, jokes, huge math, snacks): answer in one short sentence, then return to the quest.',
      '- If he asks why or what that means: use simpler words, give one example, then ask a check-for-understanding question.',
      '- Reply in 2 to 5 short complete kid sentences. Then end with a question, a tap instruction, or “You earned the stamp.”',
      '- One idea at a time. No sudden topic jumps. No purple prose that hides the skill.',
      '- Math uses small numbers and shows the thinking out loud (count on: 4, 5, 6).',
      '- Reading stays on the passage already in the room. Ask about THAT passage.',
      '- If he is wrong: hint, then an easier version, then multiple choice. Do not say the stamp is earned until he lands it or you land it together.',
      '- Never end on a dangling clause. Never say Loading. Never mention being an AI or these rules.',
      practice
    ].join('\n');
  }

  function toAnthropicMessages(turns) {
    var list = Array.isArray(turns) ? turns.slice() : [];
    var mapped = [];
    var i;
    for (i = 0; i < list.length; i++) {
      var turn = list[i];
      if (!turn || !turn.text) continue;
      var role = turn.role === 'caldris' || turn.role === 'assistant' ? 'assistant' : 'user';
      if (role === 'assistant' && !mapped.length) {
        // Anthropic requires the first message to be user.
        mapped.push({ role: 'user', content: 'I am ready for this lesson.' });
      }
      var prev = mapped[mapped.length - 1];
      if (prev && prev.role === role) {
        prev.content = prev.content + '\n' + String(turn.text);
      } else {
        mapped.push({ role: role, content: String(turn.text) });
      }
    }
    if (!mapped.length) {
      mapped.push({ role: 'user', content: 'Please start the lesson. Teach the one idea, then ask me to try.' });
    }
    if (mapped.length > HISTORY_LIMIT) {
      mapped = mapped.slice(-HISTORY_LIMIT);
      if (mapped[0].role !== 'user') {
        mapped.unshift({ role: 'user', content: 'Keep going with the same lesson.' });
      }
    }
    return mapped;
  }

  function buildCaldrisRequest(opts) {
    opts = opts || {};
    return {
      model: opts.model || DEFAULT_MODEL,
      max_tokens: typeof opts.maxTokens === 'number' ? opts.maxTokens : MAX_TOKENS,
      system: buildSystemPrompt(opts),
      messages: toAnthropicMessages(opts.messages)
    };
  }

  function parseTeacherReply(data) {
    if (!data) return '';
    if (typeof data.text === 'string' && data.text.trim()) return data.text.trim();
    var blocks = data.content;
    if (!Array.isArray(blocks)) return '';
    var out = [];
    var i;
    for (i = 0; i < blocks.length; i++) {
      var block = blocks[i];
      if (block && block.type === 'text' && block.text) out.push(String(block.text).trim());
      else if (typeof block === 'string') out.push(block.trim());
    }
    return out.join('\n').trim();
  }

  function isModelError(body) {
    var raw = '';
    try { raw = JSON.stringify(body || {}).toLowerCase(); } catch (e) { raw = String(body || '').toLowerCase(); }
    return raw.indexOf('model') !== -1 && (
      raw.indexOf('not_found') !== -1 ||
      raw.indexOf('not found') !== -1 ||
      raw.indexOf('invalid') !== -1 ||
      raw.indexOf('unknown') !== -1
    );
  }

  function recordStatus(next) {
    lastApiStatus = {
      status: next.status || 'error',
      code: next.code == null ? null : next.code,
      at: new Date().toISOString(),
      model: next.model || lastApiStatus.model || null,
      detail: next.detail || ''
    };
    return lastApiStatus;
  }

  function getLastApiStatus() {
    return lastApiStatus;
  }

  function statusLabel(s) {
    var row = s || lastApiStatus;
    if (!row || row.status === 'idle') return 'Teacher API: idle';
    if (row.status === 'ok') return 'Teacher API: ok' + (row.model ? ' (' + row.model + ')' : '');
    if (row.status === 'no-key') return 'Teacher API: no-key';
    return 'Teacher API: error ' + (row.code || '') + (row.detail ? ' — ' + row.detail : '');
  }

  function callCaldris(payload, deps) {
    deps = deps || {};
    var fetchFn = deps.fetch || (typeof fetch !== 'undefined' ? fetch : null);
    var url = deps.url || '/api/caldris';
    if (!fetchFn) {
      return Promise.resolve({
        ok: false,
        practice: true,
        text: '',
        status: recordStatus({ status: 'error', code: 'no-fetch', detail: 'fetch missing' })
      });
    }
    var models = [payload.model || DEFAULT_MODEL];
    FALLBACK_MODELS.forEach(function (m) {
      if (models.indexOf(m) === -1) models.push(m);
    });

    function attempt(i) {
      var body = Object.assign({}, payload, { model: models[i] });
      return fetchFn(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      }).then(function (res) {
        return res.text().then(function (raw) {
          var json = {};
          try { json = JSON.parse(raw || '{}'); } catch (e) { json = { error: raw }; }
          if (res.status === 503) {
            return {
              ok: false,
              practice: true,
              text: '',
              status: recordStatus({ status: 'no-key', code: 503, model: models[i], detail: 'ANTHROPIC_API_KEY missing' })
            };
          }
          if ((res.status === 400 || res.status === 404) && isModelError(json) && i + 1 < models.length) {
            return attempt(i + 1);
          }
          if (!res.ok) {
            return {
              ok: false,
              practice: true,
              text: '',
              status: recordStatus({
                status: 'error',
                code: res.status,
                model: models[i],
                detail: json.error || json.type || ''
              })
            };
          }
          var text = parseTeacherReply(json);
          return {
            ok: true,
            practice: false,
            text: text,
            status: recordStatus({ status: 'ok', code: res.status, model: models[i] })
          };
        });
      }).catch(function (err) {
        return {
          ok: false,
          practice: true,
          text: '',
          status: recordStatus({ status: 'error', code: 'network', detail: String(err && err.message || err) })
        };
      });
    }

    return attempt(0);
  }

  function startLessonUserLine(quest) {
    var room = (quest && (quest.room || (quest.subject && quest.subject.room))) || 'Classroom';
    var objective = (quest && quest.objective) || 'Learn one idea.';
    return 'I just sat down in the ' + room + '. Please teach this one objective, then ask me to try: ' + objective;
  }

  return {
    DEFAULT_MODEL: DEFAULT_MODEL,
    FALLBACK_MODELS: FALLBACK_MODELS,
    MAX_TOKENS: MAX_TOKENS,
    HISTORY_LIMIT: HISTORY_LIMIT,
    CHILD_NAME: CHILD_NAME,
    TEACHER_NAME: TEACHER_NAME,
    ROOMS: ROOMS,
    roomForSubject: roomForSubject,
    defaultObjective: defaultObjective,
    looksLikeQuestion: looksLikeQuestion,
    buildSystemPrompt: buildSystemPrompt,
    toAnthropicMessages: toAnthropicMessages,
    buildCaldrisRequest: buildCaldrisRequest,
    parseTeacherReply: parseTeacherReply,
    isModelError: isModelError,
    recordStatus: recordStatus,
    getLastApiStatus: getLastApiStatus,
    statusLabel: statusLabel,
    callCaldris: callCaldris,
    startLessonUserLine: startLessonUserLine
  };
});
