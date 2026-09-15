(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.CaldrisQuests = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var SUBJECTS = [
    { id: 'reading', name: 'Reading', room: 'Reading Treehouse', desc: 'Stories in the treehouse', icon: '📖', xp: 25, color: '#3d8a5c', ibg: 'rgba(61,138,92,.18)', flavor: 'Reading Treehouse' },
    { id: 'writing', name: 'Writing & Spelling', room: 'Writing Desk', desc: 'Letters at the big desk', icon: '✍️', xp: 25, color: '#7b5ea7', ibg: 'rgba(123,94,167,.18)', flavor: 'Writing Desk' },
    { id: 'math', name: 'Math', room: 'Math Workshop', desc: 'Blocks, numbers, and counting on', icon: '🔢', xp: 25, color: '#2a7de1', ibg: 'rgba(42,125,225,.16)', flavor: 'Math Workshop' },
    { id: 'life', name: 'Life Skills', room: 'Life Skills Kitchen', desc: 'Kind hands in the kitchen', icon: '🍳', xp: 20, color: '#e85d4c', ibg: 'rgba(232,93,76,.16)', flavor: 'Life Skills Kitchen' },
    { id: 'pe', name: 'Physical Ed', room: 'Nature Lab', desc: 'Move, breathe, notice', icon: '🏃', xp: 15, color: '#4caf50', ibg: 'rgba(76,175,80,.16)', flavor: 'Nature Lab' }
  ];

  function subjectById(id) {
    for (var i = 0; i < SUBJECTS.length; i++) {
      if (SUBJECTS[i].id === id) return SUBJECTS[i];
    }
    return null;
  }

  function daySeed(today, extra) {
    var s = String(today || '') + '|' + String(extra || '');
    var h = 2166136261;
    for (var i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }

  function pick(seed, list) {
    if (!list.length) return null;
    return list[seed % list.length];
  }

  function normalize(text) {
    return String(text || '')
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function arraysEqual(a, b) {
    if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false;
    for (var i = 0; i < a.length; i++) {
      if (String(a[i]) !== String(b[i])) return false;
    }
    return true;
  }

  function readingPacks() {
    return [
      {
        title: 'The River Stones Forgot Their Names',
        objective: 'Read a 4-sentence fox story and answer questions about that story.',
        teach: 'We read the whole story first. Then we answer only from those sentences — not from a guess.',
        hook: 'Climb into the Reading Treehouse. A short fox story is on the board.',
        passage: 'A small fox hid under a fern. Rain tapped the leaves. The fox was not lost — it was waiting for the sun. When the clouds opened, the fox ran to the river and drank.',
        beats: [
          {
            id: 'r1', type: 'tap', prompt: 'Where did the fox hide?',
            options: [{ id: 'a', label: 'Under a fern' }, { id: 'b', label: 'In a cave' }, { id: 'c', label: 'On a roof' }],
            correct: 'a', hint: 'Look at the very first sentence.'
          },
          {
            id: 'r2', type: 'type', prompt: 'What was the fox waiting for? Type or speak one word.',
            accepted: ['sun', 'the sun', 'sunshine', 'light', 'the light'],
            hint: 'The clouds opened, and then the fox ran.'
          },
          {
            id: 'r3', type: 'tap', prompt: 'Why did the fox run to the river?',
            options: [{ id: 'a', label: 'To hide from rain' }, { id: 'b', label: 'To drink' }, { id: 'c', label: 'To find a boat' }],
            correct: 'b', hint: 'The last sentence tells you what it did there.'
          },
          {
            id: 'r4', type: 'order', prompt: 'Tap the story in the true order.',
            items: [{ id: 'wait', label: 'The fox waited' }, { id: 'hide', label: 'The fox hid' }, { id: 'drink', label: 'The fox drank' }],
            correct: ['hide', 'wait', 'drink'], hint: 'Start with hiding, then waiting, then drinking.'
          }
        ]
      },
      {
        title: 'Lanterns Over the Academy',
        objective: 'Read a 4-sentence lantern story and answer questions about that story.',
        teach: 'Each color means one thing. We will keep those meanings and not invent new ones.',
        hook: 'The treehouse board has a lantern note. Read it with me.',
        passage: 'Three lanterns hung by the bridge. The gold one meant welcome. The green one meant wait. The blue one meant the library was open. Maya saw gold and blue, so she crossed and went to read.',
        beats: [
          {
            id: 'r1', type: 'tap', prompt: 'How many lanterns hung by the bridge?',
            options: [{ id: 'a', label: 'Two' }, { id: 'b', label: 'Three' }, { id: 'c', label: 'Five' }],
            correct: 'b', hint: 'Count them in the first sentence.'
          },
          {
            id: 'r2', type: 'type', prompt: 'Which color meant the library was open?',
            accepted: ['blue', 'the blue', 'blue lantern', 'the blue one'],
            hint: 'Gold is welcome. Green is wait.'
          },
          {
            id: 'r3', type: 'map', prompt: 'Maya saw gold and blue. Tap where she went.',
            spots: [
              { id: 'bridge', label: 'Bridge', x: 22, y: 58 },
              { id: 'library', label: 'Library', x: 68, y: 32 },
              { id: 'woods', label: 'Woods', x: 80, y: 72 }
            ],
            correct: 'library', hint: 'Gold let her cross. Blue called her to books.'
          },
          {
            id: 'r4', type: 'tap', prompt: 'What is this story mostly about?',
            options: [{ id: 'a', label: 'Lanterns that give simple signals' }, { id: 'b', label: 'A dragon in the kitchen' }, { id: 'c', label: 'How to bake bread' }],
            correct: 'a', hint: 'Every color meant something.'
          }
        ]
      },
      {
        title: 'Bass Buddy’s Quiet Morning',
        objective: 'Read a 4-sentence dock story and answer questions about that story.',
        teach: 'The story tells what really happened. We will stick to those words.',
        hook: 'A dock story is pinned in the treehouse. Let’s read what really happened.',
        passage: 'At dawn, Bass Buddy sat on the dock. He packed a sandwich and a joke. A ripple came. It was only a leaf. He laughed anyway, because waiting is part of fishing, and laughing is part of waiting.',
        beats: [
          {
            id: 'r1', type: 'tap', prompt: 'Where did Bass Buddy sit?',
            options: [{ id: 'a', label: 'In a tower' }, { id: 'b', label: 'On the dock' }, { id: 'c', label: 'Under the bed' }],
            correct: 'b', hint: 'The first sentence names the place.'
          },
          {
            id: 'r2', type: 'type', prompt: 'What made the ripple?',
            accepted: ['leaf', 'a leaf', 'the leaf', 'only a leaf'],
            hint: 'It was not a fish this time.'
          },
          {
            id: 'r3', type: 'tap', prompt: 'Why did Bass Buddy laugh?',
            options: [{ id: 'a', label: 'Because waiting and laughing go together' }, { id: 'b', label: 'Because he fell in' }, { id: 'c', label: 'Because the sandwich was gone' }],
            correct: 'a', hint: 'Read the last sentence slowly.'
          },
          {
            id: 'r4', type: 'order', prompt: 'Tap what happened first to last.',
            items: [{ id: 'sit', label: 'Sat on the dock' }, { id: 'ripple', label: 'Saw a ripple' }, { id: 'laugh', label: 'Laughed anyway' }],
            correct: ['sit', 'ripple', 'laugh'], hint: 'Dawn, then ripple, then laugh.'
          }
        ]
      }
    ];
  }

  function writingPacks() {
    return [
      {
        title: 'True Names of the Grove',
        objective: 'Choose the true spelling and write one short correct sentence.',
        teach: 'A true spelling uses the letters people agree on. Names get a capital. Sentences get a stop sign.',
        hook: 'Sit at the Writing Desk. Today we pin the right letters.',
        beats: [
          {
            id: 'w1', type: 'tap', prompt: 'Which spelling is true?',
            options: [{ id: 'a', label: 'frend' }, { id: 'b', label: 'friend' }, { id: 'c', label: 'freind' }],
            correct: 'b', hint: 'I before E, except after C — and this word is a classic friend.'
          },
          {
            id: 'w2', type: 'type', prompt: 'Spell the word for a place with many trees. Speak it letter by letter or type it.',
            accepted: ['forest', 'the forest'],
            hint: 'F-O-R-E-S-T. It hides foxes and ferns.'
          },
          {
            id: 'w3', type: 'order', prompt: 'Tap these words into a real sentence.',
            items: [{ id: 'the', label: 'The' }, { id: 'fox', label: 'fox' }, { id: 'hid', label: 'hid.' }],
            correct: ['the', 'fox', 'hid'], hint: 'Start with The.'
          },
          {
            id: 'w4', type: 'tap', prompt: 'Which sentence is written best?',
            options: [
              { id: 'a', label: 'matthew ran to the dock' },
              { id: 'b', label: 'Matthew ran to the dock.' },
              { id: 'c', label: 'Matthew ran to the dock' }
            ],
            correct: 'b', hint: 'Names get a capital. Sentences get a period.'
          }
        ]
      },
      {
        title: 'Camp Journal',
        objective: 'Spell camp words and write one sentence with at least three words.',
        teach: 'We look, say, and write. A sentence needs a capital, a complete thought, and an end mark.',
        hook: 'The Writing Desk journal is open. Three true words, then one brave sentence.',
        beats: [
          {
            id: 'w1', type: 'tap', prompt: 'Pick the correctly spelled camp word.',
            options: [{ id: 'a', label: 'lantern' }, { id: 'b', label: 'lantren' }, { id: 'c', label: 'lanturn' }],
            correct: 'a', hint: 'It ends like modern — lantern.'
          },
          {
            id: 'w2', type: 'type', prompt: 'Spell river.',
            accepted: ['river'],
            hint: 'R-I-V-E-R. Water that moves.'
          },
          {
            id: 'w3', type: 'tap', prompt: 'Which word needs a capital because it is a name?',
            options: [{ id: 'a', label: 'tent' }, { id: 'b', label: 'Matthew' }, { id: 'c', label: 'trail' }],
            correct: 'b', hint: 'People’s names are proper names.'
          },
          {
            id: 'w4', type: 'type', prompt: 'Type one short sentence about the campsite. At least three words.',
            minWords: 3,
            accepted: ['*minwords*'],
            hint: 'Example: The tent glows warm.'
          }
        ]
      },
      {
        title: 'Spellgate',
        objective: 'Spell common words and build one complete sentence in order.',
        teach: 'If a password is spelled true, the gate swings. We check every letter.',
        hook: 'The Writing Desk has a wooden spellgate. Let’s give it true words.',
        beats: [
          {
            id: 'w1', type: 'tap', prompt: 'Which is the true password?',
            options: [{ id: 'a', label: 'becaus' }, { id: 'b', label: 'because' }, { id: 'c', label: 'becuase' }],
            correct: 'b', hint: 'Big Elephants Can Always Understand Small Elephants.'
          },
          {
            id: 'w2', type: 'type', prompt: 'Spell the opposite of night.',
            accepted: ['day'],
            hint: 'Three letters. The sun’s shift.'
          },
          {
            id: 'w3', type: 'order', prompt: 'Build: We can try again.',
            items: [{ id: 'we', label: 'We' }, { id: 'can', label: 'can' }, { id: 'try', label: 'try' }, { id: 'again', label: 'again.' }],
            correct: ['we', 'can', 'try', 'again'], hint: 'Start with We.'
          },
          {
            id: 'w4', type: 'tap', prompt: 'A sentence should end with…',
            options: [{ id: 'a', label: 'a period, question mark, or exclamation' }, { id: 'b', label: 'a comma only' }, { id: 'c', label: 'nothing' }],
            correct: 'a', hint: 'Every complete thought needs a stop sign.'
          }
        ]
      }
    ];
  }

  function mathPacks(grade) {
    var g = Math.max(1, Math.min(12, grade || 1));
    var a = g <= 2 ? 3 : (g <= 4 ? 6 : 12);
    var b = g <= 2 ? 4 : (g <= 4 ? 7 : 8);
    var sum = a + b;
    var product = g >= 3 ? a * 2 : sum;
    return [
      {
        title: 'Counting Stones by the River',
        objective: 'Add two small numbers by counting on from the first number.',
        teach: 'When we add, we start at the first number and count on. 2 + 3 is 3, then 4, then 5.',
        hook: 'Welcome to the Math Workshop. Today we add by counting on.',
        beats: [
          {
            id: 'm1', type: 'tap', prompt: 'A lantern holds 2 flames. Another holds 3. How many flames in all?',
            options: [{ id: 'a', label: '4' }, { id: 'b', label: '5' }, { id: 'c', label: '6' }],
            correct: 'b', hint: '2 and then 3 more. Count up: 3, 4, 5.'
          },
          {
            id: 'm2', type: 'type', prompt: 'There are ' + a + ' fish on the left and ' + b + ' on the right. How many fish altogether? Type the number.',
            accepted: [String(sum)],
            hint: a + ' + ' + b + ' = ? Count on from ' + a + '.'
          },
          {
            id: 'm3', type: 'order', prompt: 'Tap the steps to add ' + a + ' + ' + b + '.',
            items: [
              { id: 'start', label: 'Start at ' + a },
              { id: 'count', label: 'Count on ' + b },
              { id: 'total', label: 'Write ' + sum }
            ],
            correct: ['start', 'count', 'total'], hint: 'Start, count on, then write the total.'
          },
          {
            id: 'm4', type: 'tap', prompt: g >= 3 ? ('What is ' + a + ' × 2?') : ('Which is more, ' + sum + ' or ' + (sum - 2) + '?'),
            options: g >= 3
              ? [{ id: 'a', label: String(product) }, { id: 'b', label: String(product + 2) }, { id: 'c', label: String(a) }]
              : [{ id: 'a', label: String(sum) }, { id: 'b', label: String(sum - 2) }, { id: 'c', label: 'They are the same' }],
            correct: 'a', hint: g >= 3 ? 'Twice means add the number to itself.' : 'Bigger pile wins.'
          }
        ]
      },
      {
        title: 'Market Day in Caldris',
        objective: 'Use doubles and take-away to solve small coin problems.',
        teach: 'Two apples at 2 coins each is 2 + 2. That is a double. Doubles are two of the same number.',
        hook: 'The Math Workshop market table is open. We will count fair coins.',
        beats: [
          {
            id: 'm1', type: 'tap', prompt: 'An apple costs 2 coins. Two apples cost…',
            options: [{ id: 'a', label: '2 coins' }, { id: 'b', label: '3 coins' }, { id: 'c', label: '4 coins' }],
            correct: 'c', hint: '2 + 2, or 2 twice.'
          },
          {
            id: 'm2', type: 'type', prompt: 'You have 10 coins and spend 4. How many are left?',
            accepted: ['6', 'six'],
            hint: 'Count back from 10: 9, 8, 7, 6.'
          },
          {
            id: 'm3', type: 'map', prompt: 'The stall with 8 apples is the fullest. Tap it.',
            spots: [
              { id: 'three', label: '3 apples', x: 20, y: 40 },
              { id: 'eight', label: '8 apples', x: 52, y: 36 },
              { id: 'five', label: '5 apples', x: 78, y: 60 }
            ],
            correct: 'eight', hint: '8 is the largest of 3, 8, and 5.'
          },
          {
            id: 'm4', type: 'tap', prompt: 'Half of 8 lanterns is…',
            options: [{ id: 'a', label: '2' }, { id: 'b', label: '4' }, { id: 'c', label: '6' }],
            correct: 'b', hint: 'Split 8 into two equal teams.'
          }
        ]
      },
      {
        title: 'Bridge Builders',
        objective: 'Find pairs that make 10 and skip-count by 2s.',
        teach: 'A ten-pair is two numbers that add to 10. 7 and 3 make 10 because 7, then 8, 9, 10.',
        hook: 'Workshop planks must make 10. If the numbers lie, the bridge wobbles.',
        beats: [
          {
            id: 'm1', type: 'tap', prompt: 'Which pair makes 10?',
            options: [{ id: 'a', label: '6 and 3' }, { id: 'b', label: '7 and 3' }, { id: 'c', label: '2 and 6' }],
            correct: 'b', hint: '7, then 8, 9, 10.'
          },
          {
            id: 'm2', type: 'type', prompt: 'A ranger walks 5 steps, then 5 more. How many steps?',
            accepted: ['10', 'ten'],
            hint: 'Two hands of five.'
          },
          {
            id: 'm3', type: 'order', prompt: 'Order these from smallest to biggest.',
            items: [{ id: '2', label: '2' }, { id: '9', label: '9' }, { id: '5', label: '5' }],
            correct: ['2', '5', '9'], hint: 'Tiny, middle, largest.'
          },
          {
            id: 'm4', type: 'tap', prompt: 'Skip-count by 2s. What comes after 2, 4, 6, …',
            options: [{ id: 'a', label: '7' }, { id: 'b', label: '8' }, { id: 'c', label: '9' }],
            correct: 'b', hint: 'Each jump adds two.'
          }
        ]
      }
    ];
  }

  function lifePacks() {
    return [
      {
        title: 'Kindling the Hearth',
        objective: 'Choose the safe next step for food, morning, and a hot stove.',
        teach: 'In the kitchen we wash food, ask for help with heat, and do one next right thing.',
        hook: 'Welcome to the Life Skills Kitchen. Today we practice safe, kind hands.',
        beats: [
          {
            id: 'l1', type: 'tap', prompt: 'Before you eat fruit from the grove, you should…',
            options: [{ id: 'a', label: 'Wash it' }, { id: 'b', label: 'Hide it' }, { id: 'c', label: 'Throw it' }],
            correct: 'a', hint: 'Clean hands and clean food keep adventurers well.'
          },
          {
            id: 'l2', type: 'order', prompt: 'Tap the morning path in order.',
            items: [
              { id: 'wake', label: 'Wake up' },
              { id: 'wash', label: 'Wash up' },
              { id: 'eat', label: 'Eat breakfast' }
            ],
            correct: ['wake', 'wash', 'eat'], hint: 'Body first, then food.'
          },
          {
            id: 'l3', type: 'tap', prompt: 'If a pan on the stove is hot, you…',
            options: [{ id: 'a', label: 'Grab it with a bare hand' }, { id: 'b', label: 'Use a mitt or ask an adult' }, { id: 'c', label: 'Pour water on the fire for fun' }],
            correct: 'b', hint: 'Heat needs respect and help.'
          },
          {
            id: 'l4', type: 'map', prompt: 'Smoke is in the kitchen. Tap the safest first move: get to the door and an adult.',
            spots: [
              { id: 'door', label: 'Door + adult', x: 24, y: 48 },
              { id: 'pan', label: 'The hot pan', x: 70, y: 30 },
              { id: 'closet', label: 'Hide in a closet', x: 78, y: 74 }
            ],
            correct: 'door', hint: 'People first. Get out, get help.'
          }
        ]
      },
      {
        title: 'Fair Coins, Fair Words',
        objective: 'Use kind words and a calm path when feelings get big.',
        teach: 'Clear words beat rough hands. Stop, name the feeling, then ask for help.',
        hook: 'The kitchen table is also a talking table. Money and feelings need careful hands.',
        beats: [
          {
            id: 'l1', type: 'tap', prompt: 'You have 5 coins. A snack is 3. Can you buy it and have coins left?',
            options: [{ id: 'a', label: 'Yes — 2 left' }, { id: 'b', label: 'No — none left' }, { id: 'c', label: 'Yes — 8 left' }],
            correct: 'a', hint: '5 take away 3.'
          },
          {
            id: 'l2', type: 'tap', prompt: 'A friend takes your turn. A strong, kind first word is…',
            options: [{ id: 'a', label: 'Hit them' }, { id: 'b', label: 'Please stop. It is my turn.' }, { id: 'c', label: 'Never speak again' }],
            correct: 'b', hint: 'Clear words beat rough hands.'
          },
          {
            id: 'l3', type: 'order', prompt: 'If you feel too big-mad, tap this calm path.',
            items: [
              { id: 'stop', label: 'Stop and breathe' },
              { id: 'name', label: 'Name the feeling' },
              { id: 'ask', label: 'Ask for help' }
            ],
            correct: ['stop', 'name', 'ask'], hint: 'Body, then words, then help.'
          },
          {
            id: 'l4', type: 'type', prompt: 'Type one kind word you can say to a friend.',
            minWords: 1,
            accepted: ['*minwords*'],
            hint: 'Sorry, please, and thank you are always in season. Any kind word works.'
          }
        ]
      },
      {
        title: 'Trail First Aid',
        objective: 'Care for a small scrape: wash, pat dry, bandage, get help if needed.',
        teach: 'Clean before cover. Wash, pat dry, then bandage. Big hurts need a grown-up.',
        hook: 'The kitchen first-aid tin is open. A scrape is not a dragon, but it matters.',
        beats: [
          {
            id: 'l1', type: 'tap', prompt: 'Small scrape on a knee. First move?',
            options: [{ id: 'a', label: 'Wash with clean water' }, { id: 'b', label: 'Rub dirt in' }, { id: 'c', label: 'Ignore it forever' }],
            correct: 'a', hint: 'Clean before cover.'
          },
          {
            id: 'l2', type: 'order', prompt: 'Tap scrape care in order.',
            items: [
              { id: 'wash', label: 'Wash' },
              { id: 'dry', label: 'Pat dry' },
              { id: 'band', label: 'Bandage' }
            ],
            correct: ['wash', 'dry', 'band'], hint: 'Water, dry, then cover.'
          },
          {
            id: 'l3', type: 'tap', prompt: 'A grown-up should be called when…',
            options: [{ id: 'a', label: 'Bleeding will not slow, or someone feels faint' }, { id: 'b', label: 'You feel a little bored' }, { id: 'c', label: 'The snack is apple' }],
            correct: 'a', hint: 'Big hurts need bigger help.'
          },
          {
            id: 'l4', type: 'map', prompt: 'Tap the water for washing the scrape.',
            spots: [
              { id: 'water', label: 'Clean water', x: 30, y: 62 },
              { id: 'thorns', label: 'Thorn bush', x: 74, y: 28 },
              { id: 'cliff', label: 'Cliff edge', x: 78, y: 70 }
            ],
            correct: 'water', hint: 'Look for the river, not the thorns.'
          }
        ]
      }
    ];
  }

  function pePacks() {
    return [
      {
        title: 'Ranger Circuit',
        objective: 'Do jumping jacks, then name what the heart and rest need.',
        teach: 'Big body moves wake the heart. After hard moves we drink water and breathe.',
        hook: 'Nature Lab is open. Move like a ranger, then rest like a ranger.',
        beats: [
          {
            id: 'p1', type: 'move', prompt: 'Do 10 jumping jacks. Count out loud. Then tap I Did It.',
            doneLabel: 'I Did It', hint: 'Arms and legs jump together. Ten is plenty.'
          },
          {
            id: 'p2', type: 'tap', prompt: 'Which move gets your heart going fastest?',
            options: [{ id: 'a', label: 'Sitting still' }, { id: 'b', label: 'Jumping jacks' }, { id: 'c', label: 'Holding your breath' }],
            correct: 'b', hint: 'Big body moves wake the heart.'
          },
          {
            id: 'p3', type: 'type', prompt: 'How many jumping jacks did you do? Type the number.',
            accepted: ['10', 'ten', '11', '9', '12'],
            hint: 'We asked for ten. Close counts if you truly moved.'
          },
          {
            id: 'p4', type: 'tap', prompt: 'After hard moves, a ranger should…',
            options: [{ id: 'a', label: 'Drink water and breathe' }, { id: 'b', label: 'Never rest' }, { id: 'c', label: 'Skip dinner forever' }],
            correct: 'a', hint: 'Water and breath are part of the quest.'
          }
        ]
      },
      {
        title: 'Dock Balance',
        objective: 'Balance on one foot, then choose a wise move if you wobble.',
        teach: 'Balance is practice. If you wobble, put the other foot down and try again.',
        hook: 'The Nature Lab dock is for still feet. Prove you can pause, then spring.',
        beats: [
          {
            id: 'p1', type: 'move', prompt: 'Stand on one foot and count to 8. Then tap I Did It.',
            doneLabel: 'I Did It', hint: 'Arms out like a bird. Switch feet if you wobble.'
          },
          {
            id: 'p2', type: 'map', prompt: 'Tap the dock — that is where we practice balance.',
            spots: [
              { id: 'tent', label: 'Tent', x: 22, y: 28 },
              { id: 'dock', label: 'Dock', x: 58, y: 62 },
              { id: 'peak', label: 'Mountain', x: 80, y: 18 }
            ],
            correct: 'dock', hint: 'Wooden path over water.'
          },
          {
            id: 'p3', type: 'tap', prompt: 'If you wobble, a wise move is…',
            options: [{ id: 'a', label: 'Get angry at your foot' }, { id: 'b', label: 'Put the other foot down and try again' }, { id: 'c', label: 'Quit the realm' }],
            correct: 'b', hint: 'Trying again is the ranger way.'
          },
          {
            id: 'p4', type: 'fish', prompt: 'Patience trial: tap CAST when the bobber glows. Catch is cosmetic — the gate still needs every quest.',
            hint: 'Wait for the glow. Early taps miss.'
          }
        ]
      },
      {
        title: 'Outside Eyes',
        objective: 'Walk with purpose, notice one real thing, then cool down.',
        teach: 'Moving most days helps mood, sleep, and strength. Notice one real thing around you.',
        hook: 'Nature Lab says: step outside or to a window. Ordinary air counts.',
        beats: [
          {
            id: 'p1', type: 'move', prompt: 'Walk in place for 20 strong steps, or walk a hallway. Then tap I Did It.',
            doneLabel: 'I Did It', hint: 'Heel to toe. Count each step.'
          },
          {
            id: 'p2', type: 'type', prompt: 'Name one thing you noticed (tree, cloud, sound, color).',
            minWords: 1,
            accepted: ['*minwords*'],
            hint: 'Any real noticing counts. Sky, floor, bird, lamp.'
          },
          {
            id: 'p3', type: 'tap', prompt: 'Moving your body most days helps…',
            options: [{ id: 'a', label: 'Mood, sleep, and strength' }, { id: 'b', label: 'Only video games' }, { id: 'c', label: 'Nothing at all' }],
            correct: 'a', hint: 'Bodies like a job.'
          },
          {
            id: 'p4', type: 'order', prompt: 'Tap a kind cool-down.',
            items: [
              { id: 'slow', label: 'Slow the walk' },
              { id: 'stretch', label: 'Stretch gently' },
              { id: 'water', label: 'Sip water' }
            ],
            correct: ['slow', 'stretch', 'water'], hint: 'Slow, stretch, sip.'
          }
        ]
      }
    ];
  }

  function packsFor(subjectId, grade) {
    if (subjectId === 'reading') return readingPacks();
    if (subjectId === 'writing') return writingPacks();
    if (subjectId === 'math') return mathPacks(grade);
    if (subjectId === 'life') return lifePacks();
    if (subjectId === 'pe') return pePacks();
    return readingPacks();
  }

  function clone(obj) {
    return JSON.parse(JSON.stringify(obj));
  }

  function buildQuest(subjectId, today, grade) {
    var subject = subjectById(subjectId);
    var packs = packsFor(subjectId, grade);
    var seed = daySeed(today, subjectId + '|' + (grade || 1));
    var pack = clone(pick(seed, packs));
    pack.subjectId = subjectId;
    pack.subject = subject;
    pack.room = pack.room || (subject && subject.room) || subjectId;
    pack.objective = pack.objective || (subject && subject.desc) || '';
    pack.teach = pack.teach || '';
    pack.variant = seed % packs.length;
    pack.beats = pack.beats || [];
    return pack;
  }

  function firstTeacherLine(quest) {
    if (!quest) return '';
    var parts = [];
    if (quest.hook) parts.push(String(quest.hook).trim());
    if (quest.teach) parts.push(String(quest.teach).trim());
    return parts.join(' ');
  }

  function wordCount(text) {
    var n = normalize(text);
    if (!n) return 0;
    return n.split(' ').length;
  }

  function checkBeat(beat, input) {
    if (!beat) return { correct: false, almost: false };
    var type = beat.type;

    if (type === 'move') {
      return { correct: input === true || input === 'done' || input === beat.doneLabel, almost: false };
    }
    if (type === 'fish') {
      return { correct: input === true || input === 'caught' || input === 'tried', almost: false };
    }
    if (type === 'tap' || type === 'map') {
      var ok = String(input) === String(beat.correct);
      return { correct: ok, almost: false };
    }
    if (type === 'order') {
      var okOrder = arraysEqual(input, beat.correct);
      var almostOrder = Array.isArray(input) && input.length === (beat.correct || []).length && !okOrder;
      return { correct: okOrder, almost: almostOrder };
    }

    var typed = normalize(input);
    if (beat.minWords && (beat.accepted || []).indexOf('*minwords*') !== -1) {
      var words = wordCount(input);
      if (words >= beat.minWords) return { correct: true, almost: false };
      if (words > 0) return { correct: false, almost: true };
      return { correct: false, almost: false };
    }

    var accepted = beat.accepted || [];
    var i;
    for (i = 0; i < accepted.length; i++) {
      if (accepted[i] === '*minwords*') continue;
      var a = normalize(accepted[i]);
      if (!a) continue;
      if (typed === a) return { correct: true, almost: false };
      if (typed.indexOf(a) !== -1 || a.indexOf(typed) !== -1 && typed.length >= Math.max(2, a.length - 1)) {
        if (typed.indexOf(a) !== -1) return { correct: true, almost: false };
      }
    }
    for (i = 0; i < accepted.length; i++) {
      var b = normalize(accepted[i]);
      if (!b || b === '*minwords*') continue;
      if (typed && b[0] === typed[0] && Math.abs(b.length - typed.length) <= 2) {
        return { correct: false, almost: true };
      }
    }
    if (typed) return { correct: false, almost: true };
    return { correct: false, almost: false };
  }

  function scaffoldFor(beat) {
    if (!beat) return null;
    if (beat.type === 'tap' || beat.type === 'map' || beat.type === 'order' || beat.type === 'move' || beat.type === 'fish') {
      return beat;
    }
    var accepted = (beat.accepted || []).filter(function (a) { return a !== '*minwords*'; });
    if (!accepted.length) return beat;
    var right = accepted[0];
    var distractors = ['moon', 'castle', 'banana'];
    if (beat.id && beat.id[0] === 'm') distractors = ['1', '100', '0'];
    var options = [
      { id: 'right', label: right },
      { id: 'x', label: distractors[0] },
      { id: 'y', label: distractors[1] }
    ];
    return {
      id: beat.id + '-scaffold',
      type: 'tap',
      prompt: 'Choose the true answer.',
      options: options,
      correct: 'right',
      hint: beat.hint
    };
  }

  var CALDRIS = {
    correct: [
      'Yes! That is it. You earned this step.',
      'You got it, Matthew. Let’s try the next one.',
      'Great thinking. On we go.'
    ],
    almost: [
      'Almost. I will hint, then you try again.',
      'So close. Listen to the hint, then have another go.'
    ],
    wrong: [
      'Not that one. No worry — try again with a hint.',
      'A miss. Breathe. The room is still here for you.'
    ],
    skip: 'TV stays locked until all 5 rooms are stamped. You can come back anytime.',
    complete: 'You earned the stamp. This room is done for today.',
    unlock: 'All 5 rooms are stamped. Screen time is unlocked. Tomorrow is a brand new campus.'
  };

  return {
    SUBJECTS: SUBJECTS,
    subjectById: subjectById,
    daySeed: daySeed,
    normalize: normalize,
    buildQuest: buildQuest,
    firstTeacherLine: firstTeacherLine,
    checkBeat: checkBeat,
    scaffoldFor: scaffoldFor,
    CALDRIS: CALDRIS
  };
});
