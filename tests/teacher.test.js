'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const teacher = require('../lib/teacher');
const quests = require('../lib/quests');

test('system prompt is one shared teacher script with Matthew, Caldris, room, and Q&A', function () {
  const prompt = teacher.buildSystemPrompt({
    subjectId: 'math',
    room: 'Math Workshop',
    objective: 'Add two small numbers by counting on from the first number.',
    practiceText: 'Welcome to the Math Workshop. Today we add by counting on.'
  });
  assert.match(prompt, /Matthew/);
  assert.match(prompt, /Caldris/);
  assert.match(prompt, /Math Workshop/);
  assert.match(prompt, /counting on/);
  assert.match(prompt, /Two-way Q&A/i);
  assert.match(prompt, /2 to 5 short complete/);
  assert.match(prompt, /You earned the stamp/);
});

test('Claude request payload uses full max_tokens and last turns', function () {
  const payload = teacher.buildCaldrisRequest({
    subjectId: 'math',
    room: 'Math Workshop',
    objective: 'Add two small numbers by counting on.',
    messages: [
      { role: 'caldris', text: 'Start at 3 and count on.' },
      { role: 'user', text: 'Why do we count on?' },
      { role: 'caldris', text: 'So we do not lose the first number.' },
      { role: 'user', text: 'Can I watch TV?' }
    ]
  });
  assert.equal(payload.model, teacher.DEFAULT_MODEL);
  assert.equal(payload.max_tokens, 900);
  assert.ok(payload.system.indexOf('Matthew') !== -1);
  assert.ok(Array.isArray(payload.messages));
  assert.equal(payload.messages[0].role, 'user');
  assert.equal(payload.messages[payload.messages.length - 1].content, 'Can I watch TV?');
  assert.ok(payload.messages.length <= teacher.HISTORY_LIMIT);
});

test('parseTeacherReply waits for the full text blocks, no stream slice', function () {
  const text = teacher.parseTeacherReply({
    content: [
      { type: 'text', text: 'Start at 3. Count 4, 5, 6, 7. ' },
      { type: 'text', text: 'How many fish altogether?' }
    ]
  });
  assert.equal(text, 'Start at 3. Count 4, 5, 6, 7.\nHow many fish altogether?');
});

test('callCaldris POSTs /api/caldris and maps 503 to no-key practice mode', async function () {
  const payload = teacher.buildCaldrisRequest({
    subjectId: 'reading',
    messages: [{ role: 'user', text: 'Start the lesson.' }]
  });
  let posted = null;
  const result = await teacher.callCaldris(payload, {
    fetch: function (url, opts) {
      posted = { url: url, opts: opts };
      return Promise.resolve({
        status: 503,
        ok: false,
        text: function () {
          return Promise.resolve(JSON.stringify({ error: 'ANTHROPIC_API_KEY is not configured on the server.' }));
        }
      });
    }
  });
  assert.equal(posted.url, '/api/caldris');
  assert.equal(posted.opts.method, 'POST');
  const body = JSON.parse(posted.opts.body);
  assert.equal(body.max_tokens, 900);
  assert.ok(body.system);
  assert.ok(Array.isArray(body.messages));
  assert.equal(result.ok, false);
  assert.equal(result.practice, true);
  assert.equal(result.status.status, 'no-key');
  assert.equal(teacher.getLastApiStatus().status, 'no-key');
  assert.match(teacher.statusLabel(), /no-key/);
});

test('callCaldris records ok and returns the full teacher text', async function () {
  const payload = teacher.buildCaldrisRequest({
    subjectId: 'math',
    messages: [{ role: 'user', text: 'What is 2 + 3?' }]
  });
  const result = await teacher.callCaldris(payload, {
    fetch: function () {
      return Promise.resolve({
        status: 200,
        ok: true,
        text: function () {
          return Promise.resolve(JSON.stringify({
            content: [{ type: 'text', text: 'Start at 2. Count 3, 4, 5. How many is 2 + 3?' }]
          }));
        }
      });
    }
  });
  assert.equal(result.ok, true);
  assert.equal(result.practice, false);
  assert.equal(result.text, 'Start at 2. Count 3, 4, 5. How many is 2 + 3?');
  assert.equal(teacher.getLastApiStatus().status, 'ok');
});

test('practice reply answers why and off-topic then steers back', function () {
  const quest = {
    teach: 'When we add, we start at the first number and count on.',
    objective: 'Add two small numbers by counting on.'
  };
  const why = teacher.practiceReply('why do we count on?', quest);
  assert.match(why, /count on/i);
  assert.match(why, /try/i);
  const tv = teacher.practiceReply('can I watch TV', quest);
  assert.match(tv, /stamp/i);
  assert.match(tv, /count on/i);
});

test('looksLikeQuestion lets Matthew talk without a quiz answer', function () {
  assert.equal(teacher.looksLikeQuestion('why did the fox hide?'), true);
  assert.equal(teacher.looksLikeQuestion('Can I watch TV'), true);
  assert.equal(teacher.looksLikeQuestion('what does that mean'), true);
  assert.equal(teacher.looksLikeQuestion('5'), false);
  assert.equal(teacher.looksLikeQuestion('under a fern'), false);
});

test('local packs expose one room, one objective, and a complete first teacher line', function () {
  const math = quests.buildQuest('math', 'Tue Sep 15 2026', 1);
  assert.equal(math.room, 'Math Workshop');
  assert.ok(math.objective);
  assert.match(math.objective, /count/i);
  const line = quests.firstTeacherLine(math);
  assert.ok(line.length > 40);
  assert.ok(/[.!?]/.test(line));
  assert.ok(line.indexOf(math.hook) === 0);
  const rooms = quests.SUBJECTS.map((s) => s.room);
  assert.deepEqual(rooms, [
    'Reading Treehouse',
    'Writing Desk',
    'Math Workshop',
    'Life Skills Kitchen',
    'Nature Lab'
  ]);
});
