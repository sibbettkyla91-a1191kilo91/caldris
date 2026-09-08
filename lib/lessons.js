(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.CaldrisLessons = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  function hashString(value) {
    var h = 0;
    var text = String(value || '');
    for (var i = 0; i < text.length; i++) {
      h = ((h << 5) - h) + text.charCodeAt(i);
      h |= 0;
    }
    return Math.abs(h);
  }

  function pick(variants, seed) {
    return variants[hashString(seed) % variants.length];
  }

  function normalize(text) {
    return String(text || '')
      .toLowerCase()
      .replace(/[“”]/g, '"')
      .replace(/[‘’]/g, "'")
      .replace(/[^a-z0-9.\s$/-]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function hasAny(text, needles) {
    var n = normalize(text);
    return needles.some(function (needle) {
      return n.indexOf(normalize(needle)) !== -1;
    });
  }

  function wordCount(text) {
    var parts = normalize(text).split(' ').filter(Boolean);
    return parts.length;
  }

  function sentenceCount(text) {
    var parts = String(text || '').split(/[.!?]+/).map(function (s) { return s.trim(); }).filter(Boolean);
    return parts.length;
  }

  function moneyValue(text) {
    var n = normalize(text).replace(/\$/g, '').replace(/,/g, '');
    var match = n.match(/-?\d+(?:\.\d+)?/);
    return match ? Number(match[0]) : NaN;
  }

  function numberValue(text) {
    var n = normalize(text).replace(/,/g, '');
    var match = n.match(/-?\d+(?:\.\d+)?/);
    return match ? Number(match[0]) : NaN;
  }

  function closeNumber(actual, expected, tol) {
    if (!isFinite(actual)) return false;
    return Math.abs(actual - expected) <= (tol == null ? 0.011 : tol);
  }

  function readingVariants() {
    return [
      {
        id: 'banana-slug',
        passage: 'In the damp forests of western Oregon, a bright yellow creature slides over fallen leaves. It is a banana slug, one of the largest land slugs in the world. Banana slugs eat rotting plants and mushrooms. As they eat, they break food into smaller pieces that mix back into the soil. That helps new plants grow. Hikers sometimes spot them after rain, moving so slowly that a person could count to twenty before the slug travels a few inches.',
        questions: [
          {
            prompt: 'Where do banana slugs live, according to the passage?',
            accept: ['forest', 'oregon', 'western', 'woods'],
            explain: 'They live in the damp forests of western Oregon.'
          },
          {
            prompt: 'What do banana slugs eat?',
            accept: ['plant', 'mushroom', 'rotting', 'leaves'],
            explain: 'They eat rotting plants and mushrooms.'
          },
          {
            prompt: 'How do banana slugs help the forest?',
            accept: ['soil', 'plants grow', 'break', 'mix'],
            explain: 'They break food into pieces that mix into the soil and help new plants grow.'
          }
        ]
      },
      {
        id: 'library-key',
        passage: 'Maya found a small brass key under a library shelf. A faded tag on the key said "Map Drawer 3." She asked the librarian, Mr. Cole, if anyone had lost it. He smiled and unlocked a wide wooden drawer. Inside was a hand-drawn map of their town from 1912, showing the old river path and a school that no longer stands. Maya traced the river with her finger and noticed her street was once an orchard. "History hides in quiet places," Mr. Cole said.',
        questions: [
          {
            prompt: 'What did Maya find under the shelf?',
            accept: ['key', 'brass'],
            explain: 'She found a small brass key.'
          },
          {
            prompt: 'What was inside Map Drawer 3?',
            accept: ['map', '1912', 'town'],
            explain: 'A hand-drawn map of the town from 1912.'
          },
          {
            prompt: 'What did Maya notice about her street?',
            accept: ['orchard', 'once', 'used to'],
            explain: 'Her street was once an orchard.'
          }
        ]
      }
    ];
  }

  function writingVariants() {
    return [
      {
        id: 'set-a',
        words: [
          { word: 'because', hint: 'I stayed inside _____ it was raining.' },
          { word: 'thought', hint: 'I _____ the answer was 12, then I checked.' },
          { word: 'enough', hint: 'We had _____ snacks for everyone.' },
          { word: 'different', hint: 'Each planet has a _____ size.' },
          { word: 'probably', hint: 'If the sky is dark, it will _____ rain.' }
        ],
        prompt: 'Write at least 3 real sentences about a place you like to go after school. Tell what you do there and why you like it.'
      },
      {
        id: 'set-b',
        words: [
          { word: 'through', hint: 'We walked _____ the hallway to the gym.' },
          { word: 'believe', hint: 'I _____ you can finish this.' },
          { word: 'special', hint: 'Today feels _____ because it is the first day.' },
          { word: 'important', hint: 'Washing your hands is _____ before you eat.' },
          { word: 'together', hint: 'We solved the puzzle _____.' }
        ],
        prompt: 'Write at least 3 real sentences about something you want to learn this year. Be specific.'
      }
    ];
  }

  function mathVariants() {
    return [
      {
        id: 'set-a',
        problems: [
          { prompt: 'What is 7 × 8?', check: function (t) { return closeNumber(numberValue(t), 56); }, answer: '56' },
          { prompt: 'You buy a notebook for $3.50 and a pencil for $2.25. How much do you spend in all?', check: function (t) { return closeNumber(moneyValue(t), 5.75); }, answer: '$5.75' },
          { prompt: 'A pack has 6 pencils. You buy 3 packs. How many pencils do you have?', check: function (t) { return closeNumber(numberValue(t), 18); }, answer: '18' },
          { prompt: 'What is 1/2 of 12?', check: function (t) { return closeNumber(numberValue(t), 6); }, answer: '6' }
        ]
      },
      {
        id: 'set-b',
        problems: [
          { prompt: 'What is 9 × 6?', check: function (t) { return closeNumber(numberValue(t), 54); }, answer: '54' },
          { prompt: 'You have $10.00. You spend $4.35. How much money is left?', check: function (t) { return closeNumber(moneyValue(t), 5.65); }, answer: '$5.65' },
          { prompt: 'A pizza is cut into 8 slices. You eat 3 slices. How many slices are left?', check: function (t) { return closeNumber(numberValue(t), 5); }, answer: '5' },
          { prompt: 'What is 1/4 of 20?', check: function (t) { return closeNumber(numberValue(t), 5); }, answer: '5' }
        ]
      }
    ];
  }

  function lifeVariants() {
    return [
      {
        id: 'hands',
        intro: 'Today we are practicing a real-life skill: keeping your hands clean so you stay healthier at school and at home.',
        questions: [
          {
            prompt: 'Name two times you should wash your hands.',
            accept: ['eat', 'food', 'bathroom', 'restroom', 'nose', 'cough', 'outside', 'dirt', 'pets', 'animals', 'before', 'after'],
            need: 2,
            explain: 'Good times include before eating, after the bathroom, after coughing or sneezing, and after playing outside.'
          },
          {
            prompt: 'About how long should you wash with soap and water?',
            accept: ['20', 'twenty', '2 song', 'happy birthday', 'two verse'],
            need: 1,
            explain: 'About 20 seconds — long enough to sing the Happy Birthday song twice.'
          },
          {
            prompt: 'If you cut your finger while making a snack, what should you do first?',
            accept: ['adult', 'grown', 'parent', 'tell', 'help', 'wash', 'clean', 'bandage', 'band-aid', 'bandaid'],
            need: 1,
            explain: 'Tell an adult, then wash the cut and cover it if you can.'
          }
        ]
      },
      {
        id: 'money',
        intro: 'Today we are practicing a real-life skill: making a smart choice with money.',
        questions: [
          {
            prompt: 'You have $8. A snack is $3 and a drink is $4. Do you have enough for both? Say yes or no, and why.',
            accept: ['yes', 'enough', '7', 'left'],
            need: 1,
            explain: 'Yes. $3 + $4 = $7, and $8 is more than $7.'
          },
          {
            prompt: 'If you buy both, how much money will you have left?',
            accept: ['1', 'one dollar', '$1'],
            need: 1,
            explain: 'You will have $1 left.'
          },
          {
            prompt: 'Name one reason it can be smart to save that last dollar instead of spending it.',
            accept: ['later', 'save', 'need', 'tomorrow', 'emergency', 'want', 'more', 'another day'],
            need: 1,
            explain: 'Saving leaves money for something you need later, or for another day.'
          }
        ]
      }
    ];
  }

  function peVariants() {
    return [
      {
        id: 'indoor',
        assignment: 'Do this movement quest, then come back:\n1) 15 jumping jacks\n2) 10 slow toe touches\n3) Walk around the room once and notice one thing you see.\nTake your time. Form matters more than speed.',
        checkPrompt: 'Welcome back. Tell me what you did, and name one thing you noticed while you walked.'
      },
      {
        id: 'outdoor',
        assignment: 'If you can go outside safely, walk to a door, porch, or yard and back. If you need to stay inside, march in place for 45 seconds and stretch your arms to the sky 5 times. Then come back.',
        checkPrompt: 'Welcome back. Tell me what movement you did and how your body feels now.'
      }
    ];
  }

  function gradeKeywords(answer, accept, need) {
    var hits = 0;
    var used = {};
    accept.forEach(function (needle) {
      if (hasAny(answer, [needle]) && !used[needle]) {
        used[needle] = true;
        hits += 1;
      }
    });
    return hits >= (need || 1);
  }

  function buildPack(subjectId, seed) {
    if (subjectId === 'reading') {
      var reading = pick(readingVariants(), seed + ':reading');
      return { kind: 'reading', data: reading };
    }
    if (subjectId === 'writing') {
      return { kind: 'writing', data: pick(writingVariants(), seed + ':writing') };
    }
    if (subjectId === 'math') {
      return { kind: 'math', data: pick(mathVariants(), seed + ':math') };
    }
    if (subjectId === 'life') {
      return { kind: 'life', data: pick(lifeVariants(), seed + ':life') };
    }
    if (subjectId === 'pe') {
      return { kind: 'pe', data: pick(peVariants(), seed + ':pe') };
    }
    return null;
  }

  function openingText(name, pack) {
    var hello = name ? name : 'adventurer';
    if (pack.kind === 'reading') {
      return 'Hello, ' + hello + '. I am Caldris, and I will sit with you for reading.\n\nRead this passage carefully. You can ask me to repeat it.\n\n' + pack.data.passage + '\n\n' + pack.data.questions[0].prompt;
    }
    if (pack.kind === 'writing') {
      var first = pack.data.words[0];
      return 'Hello, ' + hello + '. Writing and spelling today — we will go one word at a time, then a short piece of writing.\n\nWord 1 of 5. Spell this word: **' + first.word + '**\nHint: ' + first.hint;
    }
    if (pack.kind === 'math') {
      return 'Hello, ' + hello + '. Four math problems today, one at a time. Show your thinking if you want.\n\nProblem 1: ' + pack.data.problems[0].prompt;
    }
    if (pack.kind === 'life') {
      return 'Hello, ' + hello + '. ' + pack.data.intro + '\n\n' + pack.data.questions[0].prompt;
    }
    if (pack.kind === 'pe') {
      return 'Hello, ' + hello + '. Physical education is a real quest — your body counts.\n\n' + pack.data.assignment + '\n\nWhen you finish, type "done" and tell me you are back.';
    }
    return 'Hello, ' + hello + '. Let us begin.';
  }

  function startLesson(subjectId, options) {
    options = options || {};
    var name = options.name || 'Matthew';
    var level = Math.min(Math.max(options.level || 1, 1), 5);
    var seed = options.seed || (options.today || new Date().toDateString()) + ':' + subjectId;
    var pack = buildPack(subjectId, seed);
    if (!pack) {
      throw new Error('Unknown subject: ' + subjectId);
    }
    return {
      subjectId: subjectId,
      name: name,
      level: level,
      seed: seed,
      step: 0,
      attempts: 0,
      complete: false,
      pack: pack,
      lastText: openingText(name, pack)
    };
  }

  function finish(state, text) {
    return {
      state: Object.assign({}, state, { complete: true, lastText: text, attempts: 0 }),
      text: text,
      complete: true
    };
  }

  function stay(state, text, attempts) {
    return {
      state: Object.assign({}, state, { lastText: text, attempts: attempts }),
      text: text,
      complete: false
    };
  }

  function advance(state, text, nextStep) {
    return {
      state: Object.assign({}, state, { step: nextStep, attempts: 0, lastText: text }),
      text: text,
      complete: false
    };
  }

  function tooThin(text) {
    return wordCount(text) < 1;
  }

  function nextTurn(state, userText) {
    if (!state || state.complete) {
      return { state: state, text: 'This quest is already complete.', complete: true };
    }
    var answer = String(userText || '').trim();
    if (tooThin(answer)) {
      return stay(state, 'I did not catch that. Please type your answer in your own words.', state.attempts);
    }

    var pack = state.pack;
    var attempts = state.attempts + 1;

    if (pack.kind === 'reading') {
      var q = pack.data.questions[state.step];
      var correct = gradeKeywords(answer, q.accept, 1);
      if (correct || attempts >= 2) {
        var note = correct
          ? 'That is right. ' + q.explain
          : 'Not quite. ' + q.explain;
        if (state.step + 1 >= pack.data.questions.length) {
          return finish(state, note + '\n\nYou finished the reading questions. I am proud of the careful work. [QUEST_COMPLETE]');
        }
        var nextQ = pack.data.questions[state.step + 1];
        return advance(state, note + '\n\n' + nextQ.prompt, state.step + 1);
      }
      return stay(state, 'Not quite. Read the passage once more and try again.\n\n' + q.prompt, attempts);
    }

    if (pack.kind === 'writing') {
      if (state.step < pack.data.words.length) {
        var item = pack.data.words[state.step];
        var spelled = normalize(answer) === item.word;
        if (spelled || attempts >= 2) {
          var spellNote = spelled
            ? 'Yes — **' + item.word + '** is correct.'
            : 'The correct spelling is **' + item.word + '**. You will see it again.';
          if (state.step + 1 < pack.data.words.length) {
            var nxt = pack.data.words[state.step + 1];
            return advance(state, spellNote + '\n\nWord ' + (state.step + 2) + ' of 5. Spell this word: **' + nxt.word + '**\nHint: ' + nxt.hint, state.step + 1);
          }
          return advance(state, spellNote + '\n\nNow writing. ' + pack.data.prompt, state.step + 1);
        }
        return stay(state, 'Not quite. Listen to the hint and try the spelling again.\nHint: ' + item.hint, attempts);
      }
      if (sentenceCount(answer) >= 3 && wordCount(answer) >= 12) {
        return finish(state, 'That is a real piece of writing — thank you for three full sentences. [QUEST_COMPLETE]');
      }
      if (attempts >= 2 && wordCount(answer) >= 8) {
        return finish(state, 'I can see your ideas. Next time, try to land three complete sentences with end marks. This counts. [QUEST_COMPLETE]');
      }
      return stay(state, 'Please write at least 3 complete sentences. Add a little more detail, then send it again.', attempts);
    }

    if (pack.kind === 'math') {
      var problem = pack.data.problems[state.step];
      var ok = problem.check(answer);
      if (ok || attempts >= 2) {
        var mathNote = ok
          ? 'Exactly. The answer is ' + problem.answer + '.'
          : 'Not quite. The answer is ' + problem.answer + '.';
        if (state.step + 1 >= pack.data.problems.length) {
          return finish(state, mathNote + '\n\nAll four problems are done. Solid work. [QUEST_COMPLETE]');
        }
        var nextP = pack.data.problems[state.step + 1];
        return advance(state, mathNote + '\n\nProblem ' + (state.step + 2) + ': ' + nextP.prompt, state.step + 1);
      }
      return stay(state, 'Not quite. Try one more time. You can write the number only.\n\n' + problem.prompt, attempts);
    }

    if (pack.kind === 'life') {
      var lq = pack.data.questions[state.step];
      var lifeOk = gradeKeywords(answer, lq.accept, lq.need || 1);
      if (lifeOk || attempts >= 2) {
        var lifeNote = lifeOk ? 'Yes. ' + lq.explain : 'Here is the idea: ' + lq.explain;
        if (state.step + 1 >= pack.data.questions.length) {
          return finish(state, lifeNote + '\n\nYou finished life skills for today. [QUEST_COMPLETE]');
        }
        var nextL = pack.data.questions[state.step + 1];
        return advance(state, lifeNote + '\n\n' + nextL.prompt, state.step + 1);
      }
      return stay(state, 'Add a bit more detail so I can see your thinking.\n\n' + lq.prompt, attempts);
    }

    if (pack.kind === 'pe') {
      if (state.step === 0) {
        if (hasAny(answer, ['done', 'finished', 'back', 'did it', 'complete', 'ready'])) {
          return advance(state, pack.data.checkPrompt, 1);
        }
        return stay(state, 'Go do the movement first. When you are back, type "done."\n\n' + pack.data.assignment, attempts);
      }
      var moved = hasAny(answer, ['jack', 'touch', 'walk', 'march', 'stretch', 'outside', 'jump', 'arm', 'room', 'yard', 'door', 'feel', 'tired', 'good', 'sweat', 'breath']);
      if ((moved && wordCount(answer) >= 4) || (attempts >= 2 && wordCount(answer) >= 4)) {
        return finish(state, 'That is a real effort. Rest a sip of water if you need it. [QUEST_COMPLETE]');
      }
      return stay(state, 'Tell me in a full sentence what you did and how you feel.', attempts);
    }

    return stay(state, 'Please try that answer again.', attempts);
  }

  return {
    startLesson: startLesson,
    nextTurn: nextTurn,
    normalize: normalize,
    hasAny: hasAny,
    wordCount: wordCount,
    sentenceCount: sentenceCount
  };
});
