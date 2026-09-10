(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.CaldrisLessons = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var LAST_SCORE_KEY = 'mq_last_lesson_score_v1';
  var lastScore = null;

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

  function clampLevel(level) {
    var n = parseInt(level, 10);
    if (!isFinite(n) || n < 1) return 1;
    if (n > 5) return 5;
    return n;
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

  function mathItem(prompt, expected, opts) {
    opts = opts || {};
    return {
      prompt: prompt,
      answer: opts.answer != null ? opts.answer : String(expected),
      check: function (t) {
        var actual = opts.money ? moneyValue(t) : numberValue(t);
        return closeNumber(actual, expected, opts.tol);
      }
    };
  }

  function readingByLevel() {
    return {
      1: [
        {
          id: 'l1-banana-slug',
          passage: 'In the damp forests of western Oregon, a bright yellow creature slides over fallen leaves. It is a banana slug, one of the largest land slugs in the world. Banana slugs eat rotting plants and mushrooms. As they eat, they break food into smaller pieces that mix back into the soil. That helps new plants grow. Hikers sometimes spot them after rain, moving so slowly that a person could count to twenty before the slug travels a few inches.',
          questions: [
            { prompt: 'Where do banana slugs live, according to the passage?', accept: ['western oregon', 'oregon forest', 'damp forest', 'forests of western'], explain: 'They live in the damp forests of western Oregon.', minWords: 3 },
            { prompt: 'What do banana slugs eat?', accept: ['rotting plants', 'plants and mushrooms', 'rotting plant', 'mushrooms'], explain: 'They eat rotting plants and mushrooms.', minWords: 2 },
            { prompt: 'How do banana slugs help the forest?', accept: ['mix into the soil', 'help new plants', 'help the soil', 'new plants grow', 'into the soil', 'pieces that mix'], explain: 'They break food into pieces that mix into the soil and help new plants grow.', minWords: 4 }
          ]
        },
        {
          id: 'l1-library-key',
          passage: 'Maya found a small brass key under a library shelf. A faded tag on the key said "Map Drawer 3." She asked the librarian, Mr. Cole, if anyone had lost it. He smiled and unlocked a wide wooden drawer. Inside was a hand-drawn map of their town from 1912, showing the old river path and a school that no longer stands. Maya traced the river with her finger and noticed her street was once an orchard. "History hides in quiet places," Mr. Cole said.',
          questions: [
            { prompt: 'What did Maya find under the shelf?', accept: ['brass key', 'small brass', 'a key'], explain: 'She found a small brass key.', minWords: 2 },
            { prompt: 'What was inside Map Drawer 3?', accept: ['hand-drawn map', 'map of their town', 'map from 1912', 'town from 1912'], explain: 'A hand-drawn map of the town from 1912.', minWords: 3 },
            { prompt: 'What did Maya notice about her street?', accept: ['once an orchard', 'was an orchard', 'used to be an orchard'], explain: 'Her street was once an orchard.', minWords: 3 }
          ]
        },
        {
          id: 'l1-rain-boots',
          passage: 'Leo pulled on his yellow rain boots before the walk to school. The sidewalk held silver puddles from last night’s storm. He hopped over the first puddle, then stopped. A tiny paper boat was spinning near the curb. Leo nudged it with a stick so it would not wash into the drain. At the corner he waved to Ms. Patel, who was walking her spotted dog. The sky was still gray, but Leo felt ready for the day.',
          questions: [
            { prompt: 'What did Leo put on before walking to school?', accept: ['rain boots', 'yellow boots', 'yellow rain'], explain: 'He pulled on his yellow rain boots.', minWords: 2 },
            { prompt: 'What did Leo find spinning near the curb?', accept: ['paper boat', 'tiny boat', 'paper ship'], explain: 'A tiny paper boat was spinning near the curb.', minWords: 2 },
            { prompt: 'Who did Leo see at the corner?', accept: ['ms. patel', 'ms patel', 'spotted dog', 'walking her'], explain: 'He waved to Ms. Patel, who was walking her spotted dog.', minWords: 3 }
          ]
        },
        {
          id: 'l1-lunchbox',
          passage: 'On Monday, Priya could not find her lunchbox. She checked the kitchen counter, then the backpack hook by the door. Her little brother pointed under the bench. The blue lunchbox was there, still closed, with a note from Dad on top: "Apple slices are in the small box." Priya laughed, packed the lunchbox, and caught the bus with two minutes to spare.',
          questions: [
            { prompt: 'What was Priya looking for?', accept: ['lunchbox', 'blue lunch', 'her lunch'], explain: 'She could not find her lunchbox.', minWords: 2 },
            { prompt: 'Who pointed under the bench?', accept: ['little brother', 'her brother', 'brother pointed'], explain: 'Her little brother pointed under the bench.', minWords: 2 },
            { prompt: 'What did Dad’s note say was in the small box?', accept: ['apple slices', 'apple slice', 'apples'], explain: 'Apple slices were in the small box.', minWords: 2 }
          ]
        },
        {
          id: 'l1-robin',
          passage: 'A robin hopped across the backyard after the sprinkler shut off. It tipped its head, then tugged a worm from the wet grass. The bird flew to the fence and sang three bright notes. Jamal watched from the porch steps and counted how long the robin stayed. When a car door slammed on the street, the robin lifted off toward the maple tree.',
          questions: [
            { prompt: 'What did the robin pull from the grass?', accept: ['a worm', 'the worm', 'tugged a worm'], explain: 'It tugged a worm from the wet grass.', minWords: 2 },
            { prompt: 'Where did the robin fly after it got the worm?', accept: ['to the fence', 'the fence', 'flew to the fence'], explain: 'The bird flew to the fence.', minWords: 2 },
            { prompt: 'What made the robin leave at the end?', accept: ['car door', 'door slammed', 'slammed on the street'], explain: 'A car door slammed on the street.', minWords: 2 }
          ]
        }
      ],
      2: [
        {
          id: 'l2-willamette-salmon',
          passage: 'Each fall, chinook salmon leave the Pacific and swim up the Willamette River toward the streams where they hatched. The trip is hard. They must leap fish ladders, avoid predators, and keep swimming even when the current is strong. Scientists count the fish at dams to learn whether the run is healthy. If too few salmon return, towns work to keep the water cooler and cleaner so the next generation can survive.',
          questions: [
            { prompt: 'Where do the chinook salmon swim after leaving the Pacific?', accept: ['willamette river', 'up the willamette', 'streams where they hatched'], explain: 'They swim up the Willamette River toward the streams where they hatched.', minWords: 3 },
            { prompt: 'Name one hardship the passage says the salmon face.', accept: ['fish ladders', 'predators', 'strong current', 'current is strong'], explain: 'They leap fish ladders, avoid predators, and swim against a strong current.', minWords: 2 },
            { prompt: 'Why do scientists count the fish at dams?', accept: ['run is healthy', 'whether the run', 'learn whether'], explain: 'They count fish to learn whether the run is healthy.', minWords: 3 }
          ]
        },
        {
          id: 'l2-garden-worms',
          passage: 'The school garden club turned the compost bin on Friday. Under the peelings they found red wriggler worms working through apple cores and torn leaves. Ms. Chen explained that the worms’ castings add nutrients the tomatoes need. The students measured the bin’s temperature and wrote 68 degrees in the log. Next week they will plant kale along the south fence, where the soil stays warmer in spring.',
          questions: [
            { prompt: 'What did the club find in the compost bin?', accept: ['red wriggler', 'wriggler worms', 'worms working'], explain: 'They found red wriggler worms.', minWords: 2 },
            { prompt: 'What do worm castings add, according to Ms. Chen?', accept: ['nutrients', 'tomatoes need', 'add nutrients'], explain: 'Castings add nutrients the tomatoes need.', minWords: 2 },
            { prompt: 'Where will they plant kale next week?', accept: ['south fence', 'along the south', 'warmer in spring'], explain: 'Along the south fence, where the soil stays warmer.', minWords: 3 }
          ]
        },
        {
          id: 'l2-crater-lake',
          passage: 'Crater Lake fills the caldera of an ancient volcano in southern Oregon. The water is famous for its deep blue color because it is so clear and deep. No rivers flow into the lake. Rain and snowmelt keep it full. In winter, snow can bury the rim roads. Rangers close some trails until spring, when visitors can hike down to the shore and see Wizard Island rising from the water.',
          questions: [
            { prompt: 'What formed the bowl that Crater Lake fills?', accept: ['ancient volcano', 'caldera', 'volcano in southern'], explain: 'It fills the caldera of an ancient volcano.', minWords: 2 },
            { prompt: 'Why is the lake’s water a deep blue, according to the passage?', accept: ['clear and deep', 'so clear', 'so deep'], explain: 'The water is clear and deep.', minWords: 3 },
            { prompt: 'What is Wizard Island?', accept: ['rising from the water', 'from the water', 'island rising'], explain: 'It rises from the water in the lake.', minWords: 3 }
          ]
        },
        {
          id: 'l2-wagon',
          passage: 'In 1845, the Hale family loaded a wagon in Missouri and joined a line of travelers heading west. They packed flour, tools, and a wooden crate of apple cuttings. Near the Snake River the oxen slowed in the heat. Twelve-year-old Ruth walked beside the wheels so the wagon would be lighter. At night the families circled the wagons and shared stew. Ruth wrote in a small book so she would remember the river crossings.',
          questions: [
            { prompt: 'What living plants did the Hales pack besides food and tools?', accept: ['apple cuttings', 'crate of apple', 'apple cutting'], explain: 'A wooden crate of apple cuttings.', minWords: 2 },
            { prompt: 'Why did Ruth walk beside the wagon?', accept: ['wagon would be lighter', 'be lighter', 'oxen slowed'], explain: 'She walked so the wagon would be lighter.', minWords: 3 },
            { prompt: 'What did Ruth write in her small book?', accept: ['river crossings', 'remember the river', 'the river crossing'], explain: 'She wanted to remember the river crossings.', minWords: 2 }
          ]
        },
        {
          id: 'l2-big-dipper',
          passage: 'After dinner, Noor and her dad lay on the driveway and looked north. Dad pointed to seven bright stars that formed a ladle: the Big Dipper. He showed her how the two stars at the end of the cup point toward Polaris, the North Star. Noor practiced until she could find it without help. A plane crossed the sky, but the Dipper stayed in place, like a map that does not move when you walk.',
          questions: [
            { prompt: 'How many bright stars make the Big Dipper in this passage?', accept: ['seven', '7 stars', 'seven bright'], explain: 'Seven bright stars formed a ladle.', minWords: 1, need: 1 },
            { prompt: 'Which star do the cup stars point toward?', accept: ['polaris', 'north star'], explain: 'They point toward Polaris, the North Star.', minWords: 2 },
            { prompt: 'What did Noor practice until she could do it without help?', accept: ['find it', 'find polaris', 'find the north', 'find the dipper'], explain: 'She practiced until she could find Polaris without help.', minWords: 3 }
          ]
        }
      ],
      3: [
        {
          id: 'l3-photosynthesis',
          passage: 'Green plants make their own food through photosynthesis. Chlorophyll in the leaves captures energy from sunlight. The plant takes in carbon dioxide from the air and water from the roots. Those ingredients become sugar, and oxygen is released as a leftover. If a plant sits in a dark closet for days, it cannot keep making sugar and the leaves may yellow. Farmers use this science when they space crops so each plant gets enough light.',
          questions: [
            { prompt: 'What does chlorophyll capture?', accept: ['energy from sunlight', 'sunlight', 'energy from the sun'], explain: 'It captures energy from sunlight.', minWords: 2 },
            { prompt: 'What two ingredients does the plant combine with sunlight’s energy?', accept: ['carbon dioxide', 'water from the roots', 'co2'], explain: 'Carbon dioxide from the air and water from the roots.', minWords: 3, need: 2 },
            { prompt: 'What leftover gas is released?', accept: ['oxygen'], explain: 'Oxygen is released as a leftover.', minWords: 1 }
          ]
        },
        {
          id: 'l3-floodplain',
          passage: 'In 1996, heavy rain and melting snow pushed the Willamette over its banks in several towns. Floodplains exist to hold extra water, but houses built on them can be damaged. After the flood, some families raised their homes on stilts and the city bought low land to leave as park. Engineers also studied levees. The lesson was not that rivers are enemies. It was that people have to plan for years when the river remembers its old path.',
          questions: [
            { prompt: 'What two things pushed the Willamette over its banks in 1996?', accept: ['heavy rain', 'melting snow', 'rain and melting'], explain: 'Heavy rain and melting snow.', minWords: 3, need: 2 },
            { prompt: 'Name one change people made after the flood.', accept: ['raised their homes', 'homes on stilts', 'bought low land', 'leave as park', 'studied levees'], explain: 'They raised homes, bought low land for parks, or studied levees.', minWords: 3 },
            { prompt: 'What lesson does the last sentence give?', accept: ['plan for years', 'river remembers', 'old path', 'have to plan'], explain: 'People have to plan for years when the river remembers its old path.', minWords: 4 }
          ]
        },
        {
          id: 'l3-telegraph',
          passage: 'Before phones, news crossed the country on telegraph wires. An operator tapped Morse code — short and long signals that stood for letters. In 1861 the first transcontinental line linked California to the east. A message that once took weeks by stagecoach could arrive in minutes. The system still needed people. If a wire snapped in a storm, a rider had to find the break. Speed depended on both electricity and careful human work.',
          questions: [
            { prompt: 'What did Morse code use to stand for letters?', accept: ['short and long', 'long signals', 'short and long signals'], explain: 'Short and long signals stood for letters.', minWords: 3 },
            { prompt: 'How fast could a telegraph message arrive compared with a stagecoach?', accept: ['minutes', 'weeks by stagecoach', 'in minutes'], explain: 'A message that took weeks by stagecoach could arrive in minutes.', minWords: 2 },
            { prompt: 'What happened if a wire snapped in a storm?', accept: ['find the break', 'rider had to', 'rider to find'], explain: 'A rider had to find the break.', minWords: 3 }
          ]
        },
        {
          id: 'l3-bees',
          passage: 'A honeybee does not visit a flower only for itself. While it drinks nectar, pollen grains stick to its body and ride to the next blossom. That transfer lets plants make seeds and fruit. Almond orchards in the west rent hives each spring because the trees cannot pollinate well without bees. When habitat shrinks or pesticides drift, bee numbers fall, and farmers notice it in smaller harvests. Protecting hedgerows and wildflowers is one quiet way to help.',
          questions: [
            { prompt: 'What sticks to a bee and rides to the next blossom?', accept: ['pollen grains', 'pollen'], explain: 'Pollen grains stick to its body.', minWords: 1 },
            { prompt: 'Why do almond orchards rent hives in spring?', accept: ['cannot pollinate', 'without bees', 'pollinate well without'], explain: 'The trees cannot pollinate well without bees.', minWords: 3 },
            { prompt: 'Name one reason bee numbers fall, according to the passage.', accept: ['habitat shrinks', 'pesticides drift', 'pesticides', 'habitat'], explain: 'Habitat shrinks or pesticides drift.', minWords: 2 }
          ]
        },
        {
          id: 'l3-oregon-trail-fort',
          passage: 'Fort Vancouver, on the Columbia River, was a supply hub for the Hudson’s Bay Company in the 1830s. Trappers brought furs. Farmers traded grain. Travelers on the Oregon Trail stopped for tools and news before the last push west. Journals from the fort describe gardens, a school, and ships unloading tea. The place was not a quiet museum. It was a busy workplace where many languages were spoken and every crate had a price.',
          questions: [
            { prompt: 'What company ran Fort Vancouver in the 1830s?', accept: ['hudson s bay', 'hudson bay', 'hudson\'s bay'], explain: 'The Hudson’s Bay Company.', minWords: 2 },
            { prompt: 'Why did Oregon Trail travelers stop there?', accept: ['tools and news', 'tools and', 'last push west'], explain: 'They stopped for tools and news before the last push west.', minWords: 3 },
            { prompt: 'What detail shows the fort was a busy workplace, not a museum?', accept: ['many languages', 'every crate', 'crate had a price', 'ships unloading'], explain: 'Many languages were spoken and every crate had a price.', minWords: 3 }
          ]
        }
      ],
      4: [
        {
          id: 'l4-cascades',
          passage: 'The Cascade Range exists because the Juan de Fuca plate slides beneath North America. As the ocean plate sinks, it heats and sends magma upward. Some of that magma built volcanoes such as Mount Hood and Mount St. Helens. In 1980, St. Helens erupted sideways, flattening forests and sending ash across several states. Geologists monitor earthquakes and gas around these peaks because a quiet mountain can still be an active system, not a finished sculpture.',
          questions: [
            { prompt: 'What is sliding beneath North America in this passage?', accept: ['juan de fuca', 'ocean plate', 'fuca plate'], explain: 'The Juan de Fuca plate slides beneath North America.', minWords: 3 },
            { prompt: 'What did Mount St. Helens do in 1980?', accept: ['erupted sideways', 'flattening forests', 'sending ash', 'erupted'], explain: 'It erupted sideways, flattening forests and sending ash across several states.', minWords: 2 },
            { prompt: 'Why do geologists monitor earthquakes and gas around these peaks?', accept: ['active system', 'quiet mountain', 'still be an active', 'not a finished'], explain: 'A quiet mountain can still be an active system.', minWords: 4 }
          ]
        },
        {
          id: 'l4-watershed',
          passage: 'A watershed is all the land that drains to one river or lake. If oil washes off a parking lot in Eugene, it can travel through storm drains toward the Willamette, then the Columbia, then the Pacific. That is why a town far from the ocean still belongs to an ocean story. Restoration crews plant willows along creeks because roots hold soil and shade cools the water that salmon need. A map of a watershed looks less like a state line and more like a tree lying on its side.',
          questions: [
            { prompt: 'What is a watershed, in one sentence from the passage’s idea?', accept: ['land that drains', 'drains to one', 'all the land'], explain: 'All the land that drains to one river or lake.', minWords: 4 },
            { prompt: 'Where can oil from a Eugene parking lot eventually travel?', accept: ['willamette', 'columbia', 'pacific'], explain: 'Toward the Willamette, then the Columbia, then the Pacific.', minWords: 2 },
            { prompt: 'Why do crews plant willows along creeks?', accept: ['roots hold soil', 'shade cools', 'salmon need', 'hold soil and shade'], explain: 'Roots hold soil and shade cools the water salmon need.', minWords: 3 }
          ]
        },
        {
          id: 'l4-lewis-clark',
          passage: 'Meriwether Lewis and William Clark did not “discover” the West for the people already living there. Their 1804–1806 expedition, ordered by President Jefferson, mapped rivers, collected plants, and asked nations for permission to pass. Sacagawea, a Shoshone woman, and York, an enslaved man on the journey, appear in the journals as essential workers, not side notes. The maps they sent east later helped the United States claim land. Reading those journals today means noticing both the science and the power behind the trip.',
          questions: [
            { prompt: 'Who ordered the expedition?', accept: ['president jefferson', 'jefferson'], explain: 'President Jefferson ordered it.', minWords: 1 },
            { prompt: 'Name one person the passage says was essential, not a side note.', accept: ['sacagawea', 'york'], explain: 'Sacagawea and York appear as essential workers.', minWords: 1 },
            { prompt: 'What does the last sentence say we should notice when reading the journals?', accept: ['science and the power', 'both the science', 'power behind'], explain: 'Both the science and the power behind the trip.', minWords: 4 }
          ]
        },
        {
          id: 'l4-circuits',
          passage: 'A simple circuit needs a power source, a path, and a load — a bulb, a motor, or a buzzer. If the path is broken, current stops. Copper is used in wires because it lets electrons move with little resistance. A switch is just a gap you can close on purpose. In 1879, better filaments made household bulbs last long enough to be useful. Understanding a circuit helps you see why a loose battery clip can “break” a whole toy even when the battery is new.',
          questions: [
            { prompt: 'Name the three parts of a simple circuit listed here.', accept: ['power source', 'a path', 'a load'], explain: 'A power source, a path, and a load.', minWords: 3, need: 2 },
            { prompt: 'Why is copper used in wires?', accept: ['little resistance', 'electrons move', 'lets electrons'], explain: 'It lets electrons move with little resistance.', minWords: 3 },
            { prompt: 'What can a loose battery clip do to a toy?', accept: ['break a whole', 'break the toy', 'even when the battery'], explain: 'It can break the whole toy even when the battery is new.', minWords: 4 }
          ]
        },
        {
          id: 'l4-hidden-computers',
          passage: 'In the 1940s and 1950s, “computer” often meant a person, usually a woman, who computed by hand or with a desktop machine. Katherine Johnson’s calculations at NASA helped send astronauts safely around Earth. The work looked quiet: rows of numbers, checked twice. It was not quiet in importance. When machines later took the name “computer,” the human skill underneath — careful math, catching errors — did not become less necessary. It moved into how we write programs and test them.',
          questions: [
            { prompt: 'What did the word “computer” often mean in the 1940s and 1950s?', accept: ['a person', 'usually a woman', 'who computed'], explain: 'A person, usually a woman, who computed by hand or machine.', minWords: 2 },
            { prompt: 'Whose NASA calculations are mentioned by name?', accept: ['katherine johnson', 'johnson'], explain: 'Katherine Johnson’s calculations.', minWords: 2 },
            { prompt: 'What human skill does the passage say did not become less necessary?', accept: ['careful math', 'catching errors', 'write programs'], explain: 'Careful math and catching errors.', minWords: 2 }
          ]
        }
      ],
      5: [
        {
          id: 'l5-climate-forests',
          passage: 'Oregon’s forests are not a single mood. West of the Cascades, wet winters grow dense Douglas fir. East of the mountains, ponderosa pine stands in drier air. As summers lengthen and snowpack melts earlier, fire seasons grow. That does not mean every fire is a disaster. Some ecosystems need occasional fire. The hard problem is when fires become larger and hotter than towns and habitats can absorb. Scientists compare tree rings, satellite heat maps, and local burn records before they recommend thinning, controlled burns, or leaving a stand alone.',
          questions: [
            { prompt: 'Name one difference between west-side and east-side forests in the passage.', accept: ['douglas fir', 'ponderosa pine', 'wet winters', 'drier air'], explain: 'West: wet Douglas fir; east: drier ponderosa pine.', minWords: 2 },
            { prompt: 'Why are fire seasons growing, according to the passage?', accept: ['summers lengthen', 'snowpack melts earlier', 'melts earlier'], explain: 'Summers lengthen and snowpack melts earlier.', minWords: 3 },
            { prompt: 'What do scientists compare before recommending a treatment?', accept: ['tree rings', 'satellite heat', 'burn records'], explain: 'Tree rings, satellite heat maps, and local burn records.', minWords: 2, need: 2 }
          ]
        },
        {
          id: 'l5-bill-of-rights',
          passage: 'The Bill of Rights is the first ten amendments to the U.S. Constitution. It limits what the federal government may do to people. The First Amendment protects speech, press, religion, assembly, and petition — not because those things are always comfortable, but because a free country needs argument. The Fourth Amendment requires a good reason before most searches. Rights are not unlimited. You cannot shout false fire in a crowded theater as a trick, and courts spend years drawing those lines. Knowing the amendments helps a citizen notice when power is stretching.',
          questions: [
            { prompt: 'What is the Bill of Rights?', accept: ['first ten amendments', 'ten amendments', 'first 10'], explain: 'The first ten amendments to the U.S. Constitution.', minWords: 3 },
            { prompt: 'Name two freedoms listed with the First Amendment.', accept: ['speech', 'press', 'religion', 'assembly', 'petition'], explain: 'Speech, press, religion, assembly, and petition.', minWords: 2, need: 2 },
            { prompt: 'What does the Fourth Amendment require before most searches?', accept: ['good reason', 'a good reason'], explain: 'A good reason before most searches.', minWords: 2 }
          ]
        },
        {
          id: 'l5-scientific-method',
          passage: 'A sixth-grade class wondered whether salted ice melts faster than plain ice. They wrote a hypothesis: salt lowers the freezing point, so the salted cubes should shrink first. They kept the room temperature the same, used the same starting size, and timed both trays. After four trials the salted ice melted faster each time, but one tray sat nearer a heater. They threw that trial out and ran it again. The method is not a magic checklist. It is a habit of changing one variable, measuring, and admitting when the setup was unfair.',
          questions: [
            { prompt: 'What was the class’s hypothesis?', accept: ['salt lowers', 'freezing point', 'salted cubes should', 'melted faster', 'shrink first'], explain: 'Salt lowers the freezing point, so salted cubes should shrink first.', minWords: 3 },
            { prompt: 'Why did they throw one trial out?', accept: ['nearer a heater', 'near a heater', 'setup was unfair', 'heater'], explain: 'One tray sat nearer a heater.', minWords: 3 },
            { prompt: 'What habit does the last sentence say the method is?', accept: ['one variable', 'admitting when', 'setup was unfair', 'measuring'], explain: 'Changing one variable, measuring, and admitting when the setup was unfair.', minWords: 3 }
          ]
        },
        {
          id: 'l5-news-bias',
          passage: 'Two headlines described the same city council vote. One said, “Council rescues park with late-night deal.” The other said, “Council rushes park vote after closed meeting.” Both can include true facts and still steer a reader. The first praises; the second warns. A careful reader asks: Who met? What was closed? How late is late? Primary documents — the recorded vote, the agenda — settle more than adjectives. Bias is not always a lie. Sometimes it is a spotlight that leaves the rest of the stage dark.',
          questions: [
            { prompt: 'What do both headlines describe?', accept: ['same city council', 'council vote', 'same city'], explain: 'The same city council vote.', minWords: 3 },
            { prompt: 'What does a careful reader ask, according to the passage?', accept: ['who met', 'what was closed', 'how late'], explain: 'Who met? What was closed? How late is late?', minWords: 2, need: 2 },
            { prompt: 'What does the passage say bias sometimes is, if not a lie?', accept: ['spotlight', 'rest of the stage', 'leaves the rest'], explain: 'A spotlight that leaves the rest of the stage dark.', minWords: 3 }
          ]
        },
        {
          id: 'l5-coast-range',
          passage: 'The Oregon Coast Range is older and wetter in habit than the volcanic Cascades to the east. Storms off the Pacific drop rain on these ridges first. That pattern creates a rain shadow: the Willamette Valley is wet, but not as soaked as the coast range peaks. Logging, landslides, and salmon streams share the same steep slopes. A road cut that looks small on a map can send sediment into a spawning creek after one November storm. Geography here is not background. It is the reason towns plan for rain the way desert towns plan for drought.',
          questions: [
            { prompt: 'What creates the rain shadow described here?', accept: ['storms off the pacific', 'rain on these ridges', 'ridges first'], explain: 'Storms drop rain on the Coast Range ridges first.', minWords: 4 },
            { prompt: 'What can a road cut send into a spawning creek?', accept: ['sediment'], explain: 'Sediment after a November storm.', minWords: 1 },
            { prompt: 'How does the last sentence say towns here plan?', accept: ['plan for rain', 'desert towns plan', 'way desert towns'], explain: 'They plan for rain the way desert towns plan for drought.', minWords: 4 }
          ]
        }
      ]
    };
  }

  function writingByLevel() {
    return {
      1: [
        { id: 'l1-a', words: [
          { word: 'because', hint: 'I stayed inside _____ it was raining.' },
          { word: 'thought', hint: 'I _____ the answer was 12, then I checked.' },
          { word: 'enough', hint: 'We had _____ snacks for everyone.' },
          { word: 'different', hint: 'Each planet has a _____ size.' },
          { word: 'probably', hint: 'If the sky is dark, it will _____ rain.' }
        ], prompt: 'Write at least 3 real sentences about a place you like to go after school. Tell what you do there and why you like it.' },
        { id: 'l1-b', words: [
          { word: 'friend', hint: 'I sat with my best _____ at lunch.' },
          { word: 'school', hint: 'The bus stops in front of the _____.' },
          { word: 'family', hint: 'We cooked dinner with my _____.' },
          { word: 'outside', hint: 'Put on a coat before you go _____.' },
          { word: 'morning', hint: 'The _____ sun came through the window.' }
        ], prompt: 'Write at least 3 real sentences about a chore you do at home and how you do it.' },
        { id: 'l1-c', words: [
          { word: 'yellow', hint: 'The school bus is bright _____.' },
          { word: 'number', hint: 'Seven is my favorite _____.' },
          { word: 'animal', hint: 'A robin is a kind of _____.' },
          { word: 'water', hint: 'Fill the glass with cold _____.' },
          { word: 'people', hint: 'Many _____ waited at the crosswalk.' }
        ], prompt: 'Write at least 3 real sentences about an animal you have watched. Use specific details.' },
        { id: 'l1-d', words: [
          { word: 'little', hint: 'The _____ key was under the mat.' },
          { word: 'first', hint: 'She was _____ in line for the slide.' },
          { word: 'house', hint: 'Their _____ has a red door.' },
          { word: 'again', hint: 'Please read the sentence _____.' },
          { word: 'after', hint: 'Wash your hands _____ you eat.' }
        ], prompt: 'Write at least 3 real sentences about a time you helped someone. Say what you did.' },
        { id: 'l1-e', words: [
          { word: 'green', hint: 'New leaves look bright _____ in April.' },
          { word: 'under', hint: 'The cat slept _____ the chair.' },
          { word: 'something', hint: 'I heard _____ tap on the window.' },
          { word: 'always', hint: 'He _____ hangs his backpack on the hook.' },
          { word: 'before', hint: 'Stretch _____ you run.' }
        ], prompt: 'Write at least 3 real sentences about your favorite season and what you do in it.' }
      ],
      2: [
        { id: 'l2-a', words: [
          { word: 'through', hint: 'We walked _____ the hallway to the gym.' },
          { word: 'believe', hint: 'I _____ you can finish this.' },
          { word: 'special', hint: 'Today feels _____ because it is the first day.' },
          { word: 'important', hint: 'Washing your hands is _____ before you eat.' },
          { word: 'together', hint: 'We solved the puzzle _____.' }
        ], prompt: 'Write at least 3 real sentences about something you want to learn this year. Be specific.' },
        { id: 'l2-b', words: [
          { word: 'caught', hint: 'She _____ the ball with two hands.' },
          { word: 'bought', hint: 'He _____ apples with his own money.' },
          { word: 'taught', hint: 'Mom _____ me to tie a square knot.' },
          { word: 'brought', hint: 'I _____ my library book back on time.' },
          { word: 'thought', hint: 'We _____ the trail was shorter than it was.' }
        ], prompt: 'Write at least 3 real sentences about a time a plan changed and what you did next.' },
        { id: 'l2-c', words: [
          { word: 'measure', hint: '_____ the table before you buy a cloth.' },
          { word: 'question', hint: 'Ask a _____ if the map is unclear.' },
          { word: 'remember', hint: 'I _____ the locker combination now.' },
          { word: 'complete', hint: 'Please _____ the last two problems.' },
          { word: 'describe', hint: '_____ the character using evidence from the page.' }
        ], prompt: 'Write at least 3 real sentences describing a tool or object in your house without naming it until the last sentence.' },
        { id: 'l2-d', words: [
          { word: 'island', hint: 'Wizard _____ sits in Crater Lake.' },
          { word: 'bridge', hint: 'The _____ crosses the wide river.' },
          { word: 'village', hint: 'A small _____ sat at the end of the road.' },
          { word: 'journey', hint: 'Their _____ west took five months.' },
          { word: 'weather', hint: 'The _____ turned cold after sunset.' }
        ], prompt: 'Write at least 3 real sentences about a trip you have taken, even a short one. Include where and why.' },
        { id: 'l2-e', words: [
          { word: 'science', hint: 'In _____ we tested which ice melted first.' },
          { word: 'history', hint: 'The map from 1912 is a piece of _____.' },
          { word: 'library', hint: 'Return the book to the _____ desk.' },
          { word: 'problem', hint: 'Show your work on each math _____.' },
          { word: 'answer', hint: 'Check your _____ before you turn it in.' }
        ], prompt: 'Write at least 3 real sentences about a book or article you read recently and one fact you remember.' }
      ],
      3: [
        { id: 'l3-a', words: [
          { word: 'although', hint: '_____ it was raining, we still walked.' },
          { word: 'necessary', hint: 'A helmet is _____ on that trail.' },
          { word: 'knowledge', hint: 'Her _____ of rivers came from maps and hikes.' },
          { word: 'experience', hint: 'The flood was a hard _____ for the town.' },
          { word: 'immediately', hint: 'Tell an adult _____ if the glass breaks.' }
        ], prompt: 'Write at least 3 real sentences explaining a rule you follow and why the rule exists.' },
        { id: 'l3-b', words: [
          { word: 'analyze', hint: '_____ the graph before you write a claim.' },
          { word: 'evidence', hint: 'Use _____ from the passage, not a guess.' },
          { word: 'conclude', hint: 'We can _____ that the salted ice melted faster.' },
          { word: 'variable', hint: 'Change only one _____ in a fair test.' },
          { word: 'accurate', hint: 'An _____ measurement uses the same starting size.' }
        ], prompt: 'Write at least 3 real sentences about an experiment or test you could run at home. Name what you would measure.' },
        { id: 'l3-c', words: [
          { word: 'citizen', hint: 'A _____ can write to the city council.' },
          { word: 'community', hint: 'The garden club serves the whole _____.' },
          { word: 'decision', hint: 'The council vote was a close _____.' },
          { word: 'argument', hint: 'A fair _____ uses facts, not insults.' },
          { word: 'responsibility', hint: 'Feeding the dog is his daily _____.' }
        ], prompt: 'Write at least 3 real sentences about a problem in your community and one thing a kid your age could do about it.' },
        { id: 'l3-d', words: [
          { word: 'oxygen', hint: 'Plants release _____ during photosynthesis.' },
          { word: 'nutrient', hint: 'Worm castings add a _____ the tomatoes need.' },
          { word: 'predator', hint: 'Salmon must avoid a _____ on the way upstream.' },
          { word: 'habitat', hint: 'Bees decline when _____ shrinks.' },
          { word: 'current', hint: 'The river _____ was strong at the bend.' }
        ], prompt: 'Write at least 3 real sentences teaching someone younger how a plant or animal in Oregon survives.' },
        { id: 'l3-e', words: [
          { word: 'journal', hint: 'Ruth wrote the crossing in her _____.' },
          { word: 'primary', hint: 'A letter from 1845 is a _____ source.' },
          { word: 'timeline', hint: 'Put the events on a _____ in order.' },
          { word: 'compare', hint: '_____ the two headlines before you choose a side.' },
          { word: 'context', hint: 'The date gives _____ for why they stopped at the fort.' }
        ], prompt: 'Write at least 3 real sentences comparing two things you have learned in history or science this year.' }
      ],
      4: [
        { id: 'l4-a', words: [
          { word: 'conscience', hint: 'His _____ told him to return the wallet.' },
          { word: 'occurrence', hint: 'The flood was a rare _____ in that decade.' },
          { word: 'rhythm', hint: 'The poem’s _____ made it easy to memorize.' },
          { word: 'foreign', hint: 'Tea arrived on ships from _____ ports.' },
          { word: 'embarrass', hint: 'A kind friend will not _____ you for a wrong answer.' }
        ], prompt: 'Write at least 3 real sentences about a time you changed your mind after new information. Say what the information was.' },
        { id: 'l4-b', words: [
          { word: 'magma', hint: '_____ rises as the ocean plate sinks.' },
          { word: 'volcano', hint: 'Mount Hood is a _____ in the Cascades.' },
          { word: 'monitor', hint: 'Geologists _____ earthquakes around the peak.' },
          { word: 'sediment', hint: 'A road cut can send _____ into a creek.' },
          { word: 'watershed', hint: 'A _____ is all the land that drains to one river.' }
        ], prompt: 'Write at least 3 real sentences explaining how a mountain, river, or forest near you was shaped. Use at least one science word.' },
        { id: 'l4-c', words: [
          { word: 'circuit', hint: 'A broken _____ stops the current.' },
          { word: 'resistance', hint: 'Copper has little _____ so electrons move easily.' },
          { word: 'filament', hint: 'A better _____ made household bulbs last longer.' },
          { word: 'electron', hint: 'An _____ is a tiny charged particle in the wire.' },
          { word: 'switch', hint: 'A _____ is a gap you can close on purpose.' }
        ], prompt: 'Write at least 3 real sentences explaining how a flashlight or other simple device in your house works.' },
        { id: 'l4-d', words: [
          { word: 'amendment', hint: 'The First _____ protects speech and religion.' },
          { word: 'federal', hint: 'The Bill of Rights limits _____ power.' },
          { word: 'petition', hint: 'People may _____ the government for a change.' },
          { word: 'assembly', hint: 'Peaceful _____ is listed with the First Amendment.' },
          { word: 'constitution', hint: 'The _____ is the highest law of the United States.' }
        ], prompt: 'Write at least 3 real sentences about one right in the Bill of Rights and a real-life example of using it respectfully.' },
        { id: 'l4-e', words: [
          { word: 'hypothesis', hint: 'Their _____ was that salt would melt ice faster.' },
          { word: 'procedure', hint: 'Write the _____ so someone else can repeat the test.' },
          { word: 'data', hint: 'The _____ showed a faster melt in every fair trial.' },
          { word: 'control', hint: 'Room temperature was the _____ they kept the same.' },
          { word: 'conclusion', hint: 'A _____ should match the measurements, not a wish.' }
        ], prompt: 'Write at least 3 real sentences that state a hypothesis, how you would test it, and what would count as disproving it.' }
      ],
      5: [
        { id: 'l5-a', words: [
          { word: 'accommodate', hint: 'The schedule will _____ a later start on Wednesday.' },
          { word: 'definitely', hint: 'We can _____ finish if we start now.' },
          { word: 'separate', hint: '_____ the recyclables from the trash.' },
          { word: 'privilege', hint: 'Screen time is a _____ you earn, not a right.' },
          { word: 'necessary', hint: 'Show your work; it is _____ for partial credit.' }
        ], prompt: 'Write at least 3 real sentences arguing for or against a household rule. Use reasons, not just “because I want to.”' },
        { id: 'l5-b', words: [
          { word: 'perspective', hint: 'The second headline shows a different _____ on the same vote.' },
          { word: 'credible', hint: 'A _____ source names who measured the data.' },
          { word: 'omission', hint: 'Leaving out the closed meeting is an _____ that steers readers.' },
          { word: 'evaluate', hint: '_____ both articles before you share one.' },
          { word: 'citation', hint: 'Add a _____ so a reader can find the recorded vote.' }
        ], prompt: 'Write at least 3 real sentences about how you can tell a careful news story from a story that is mostly steering you.' },
        { id: 'l5-c', words: [
          { word: 'ecosystem', hint: 'Some _____ need occasional fire.' },
          { word: 'snowpack', hint: 'Earlier _____ melt stretches the fire season.' },
          { word: 'recommend', hint: 'Scientists _____ thinning only after they compare records.' },
          { word: 'satellite', hint: 'A _____ heat map shows where a fire is growing.' },
          { word: 'absorb', hint: 'Towns cannot _____ every larger, hotter fire.' }
        ], prompt: 'Write at least 3 real sentences explaining a local weather or nature pattern and one way people respond to it.' },
        { id: 'l5-d', words: [
          { word: 'interest', hint: 'The bank pays _____ on money you leave in savings.' },
          { word: 'percent', hint: 'A 20 _____ discount is one fifth off.' },
          { word: 'budget', hint: 'A _____ lists income before it lists wants.' },
          { word: 'expense', hint: 'Bus fare is a weekly _____.' },
          { word: 'balance', hint: 'Check the _____ before you spend the last twenty dollars.' }
        ], prompt: 'Write at least 3 real sentences about a purchase you would plan for and how you would save toward it.' },
        { id: 'l5-e', words: [
          { word: 'algorithm', hint: 'A recipe is an _____ for cooking, step by step.' },
          { word: 'debug', hint: '_____ the program by reading the error line first.' },
          { word: 'sequence', hint: 'Put the instructions in the right _____.' },
          { word: 'condition', hint: 'The loop stops when a _____ becomes false.' },
          { word: 'variable', hint: 'Store the score in a _____ so it can change.' }
        ], prompt: 'Write at least 3 real sentences explaining a process you know (a game rule, a recipe, or a chore) as numbered steps someone else could follow.' }
      ]
    };
  }

  function mathByLevel() {
    return {
      1: [
        { id: 'l1-a', problems: [
          mathItem('What is 7 × 8?', 56),
          mathItem('You buy a notebook for $3.50 and a pencil for $2.25. How much do you spend in all?', 5.75, { money: true, answer: '$5.75' }),
          mathItem('A pack has 6 pencils. You buy 3 packs. How many pencils do you have?', 18),
          mathItem('What is 1/2 of 12?', 6)
        ] },
        { id: 'l1-b', problems: [
          mathItem('What is 9 × 6?', 54),
          mathItem('You have $10.00. You spend $4.35. How much money is left?', 5.65, { money: true, answer: '$5.65' }),
          mathItem('A pizza is cut into 8 slices. You eat 3 slices. How many slices are left?', 5),
          mathItem('What is 1/4 of 20?', 5)
        ] },
        { id: 'l1-c', problems: [
          mathItem('What is 12 + 19?', 31),
          mathItem('A sandwich is $4.00 and milk is $1.50. What is the total?', 5.5, { money: true, answer: '$5.50' }),
          mathItem('There are 4 rows of 5 chairs. How many chairs is that?', 20),
          mathItem('What is 1/2 of 18?', 9)
        ] },
        { id: 'l1-d', problems: [
          mathItem('What is 15 − 7?', 8),
          mathItem('You save $2 a week for 4 weeks. How much have you saved?', 8, { money: true, answer: '$8' }),
          mathItem('A box holds 8 crayons. You have 2 boxes. How many crayons?', 16),
          mathItem('What is 3 + 3 + 3 + 3?', 12)
        ] },
        { id: 'l1-e', problems: [
          mathItem('What is 5 × 7?', 35),
          mathItem('A book is $6.00. You pay with $10.00. How much change do you get?', 4, { money: true, answer: '$4.00' }),
          mathItem('The bus has 12 seats. 5 are empty. How many seats are filled?', 7),
          mathItem('What is 1/2 of 10?', 5)
        ] }
      ],
      2: [
        { id: 'l2-a', problems: [
          mathItem('What is 8 × 9?', 72),
          mathItem('Three notebooks cost $2.40 each. What is the total?', 7.2, { money: true, answer: '$7.20' }),
          mathItem('A recipe needs 3/4 cup of oats. You make 2 batches. How many cups of oats?', 1.5, { answer: '1.5' }),
          mathItem('What is 36 ÷ 6?', 6)
        ] },
        { id: 'l2-b', problems: [
          mathItem('What is 7 × 12?', 84),
          mathItem('You have $20. You spend $8.75. How much is left?', 11.25, { money: true, answer: '$11.25' }),
          mathItem('A trail is 2.5 miles out and the same back. How many miles in all?', 5),
          mathItem('What is 1/3 of 24?', 8)
        ] },
        { id: 'l2-c', problems: [
          mathItem('What is 11 × 6?', 66),
          mathItem('Four friends split a $18 pizza evenly. How much does each pay?', 4.5, { money: true, answer: '$4.50' }),
          mathItem('A rectangle is 8 cm by 3 cm. What is the area in square cm?', 24),
          mathItem('What is 45 ÷ 5?', 9)
        ] },
        { id: 'l2-d', problems: [
          mathItem('What is 9 × 8?', 72),
          mathItem('A shirt is $15.00 with a $3.00 coupon. What do you pay?', 12, { money: true, answer: '$12.00' }),
          mathItem('You read 12 pages a day for 5 days. How many pages?', 60),
          mathItem('What is 2/5 of 20?', 8)
        ] },
        { id: 'l2-e', problems: [
          mathItem('What is 13 + 28?', 41),
          mathItem('Two bus tickets are $1.75 each. What is the total?', 3.5, { money: true, answer: '$3.50' }),
          mathItem('A pack of 24 pencils is shared equally among 6 students. How many each?', 4),
          mathItem('What is 3/4 of 16?', 12)
        ] }
      ],
      3: [
        { id: 'l3-a', problems: [
          mathItem('What is 14 × 6?', 84),
          mathItem('A game is $24.99. Tax is $2.00. What is the total?', 26.99, { money: true, answer: '$26.99' }),
          mathItem('A garden bed is 6 ft by 4 ft. What is the area in square feet?', 24),
          mathItem('What is 3/8 of 32?', 12)
        ] },
        { id: 'l3-b', problems: [
          mathItem('What is 15 × 8?', 120),
          mathItem('You earn $9 an hour for 3.5 hours. How much do you earn?', 31.5, { money: true, answer: '$31.50' }),
          mathItem('A pizza has 12 slices. You and 2 friends share them equally. How many slices each?', 4),
          mathItem('What is 25% of 80?', 20)
        ] },
        { id: 'l3-c', problems: [
          mathItem('What is 144 ÷ 12?', 12),
          mathItem('Milk is $3.49 and bread is $2.89. What is the total?', 6.38, { money: true, answer: '$6.38' }),
          mathItem('A square has a side of 9 cm. What is the perimeter?', 36),
          mathItem('What is 5/6 of 18?', 15)
        ] },
        { id: 'l3-d', problems: [
          mathItem('What is 16 × 7?', 112),
          mathItem('You have $50. You spend $18.40 and $9.25. How much is left?', 22.35, { money: true, answer: '$22.35' }),
          mathItem('A movie is 135 minutes. How many hours and minutes is that? Give hours only if you write a decimal; otherwise give total minutes. How many hours is 135 minutes?', 2.25, { answer: '2.25' }),
          mathItem('What is 40% of 35?', 14)
        ] },
        { id: 'l3-e', problems: [
          mathItem('What is 18 × 4?', 72),
          mathItem('Three books cost $7.15, $8.00, and $6.35. What is the total?', 21.5, { money: true, answer: '$21.50' }),
          mathItem('A triangle has a base of 10 cm and height of 6 cm. Area = (base × height) / 2. What is the area?', 30),
          mathItem('What is 7/10 of 50?', 35)
        ] }
      ],
      4: [
        { id: 'l4-a', problems: [
          mathItem('What is 23 × 7?', 161),
          mathItem('A jacket is $48.00. It is 25% off. What is the sale price before tax?', 36, { money: true, answer: '$36.00' }),
          mathItem('A tank holds 12.5 gallons. You add 3.75 gallons. How many gallons now?', 16.25),
          mathItem('What is 3/5 of 45?', 27)
        ] },
        { id: 'l4-b', problems: [
          mathItem('What is 0.6 × 15?', 9),
          mathItem('You buy 2.5 pounds of apples at $1.80 per pound. What is the cost?', 4.5, { money: true, answer: '$4.50' }),
          mathItem('A rectangle is 12.4 cm by 5 cm. What is the area?', 62),
          mathItem('A ratio of 3:5 red to blue marbles. If there are 15 red, how many blue?', 25)
        ] },
        { id: 'l4-c', problems: [
          mathItem('What is 125% of 40?', 50),
          mathItem('A phone plan is $22.50 a month for 4 months. What is the total?', 90, { money: true, answer: '$90.00' }),
          mathItem('Convert 3.5 hours to minutes.', 210),
          mathItem('What is 7/8 of 56?', 49)
        ] },
        { id: 'l4-d', problems: [
          mathItem('What is 19 × 14?', 266),
          mathItem('A $60 game is marked 15% off. How much do you save?', 9, { money: true, answer: '$9.00' }),
          mathItem('The mean of 8, 10, 12, and 14 is what?', 11),
          mathItem('A map scale is 1 inch = 8 miles. A road is 3.5 inches on the map. How many miles?', 28)
        ] },
        { id: 'l4-e', problems: [
          mathItem('What is 2.4 × 3.5?', 8.4),
          mathItem('You split a $47.60 bill evenly among 4 people. How much each?', 11.9, { money: true, answer: '$11.90' }),
          mathItem('A prism’s volume is length × width × height. 5 cm × 3 cm × 4 cm = ?', 60),
          mathItem('What is 12.5% of 80?', 10)
        ] }
      ],
      5: [
        { id: 'l5-a', problems: [
          mathItem('A bike is $240. It is 30% off, then you pay 5% tax on the sale price. What do you pay in all? (sale $168, tax $8.40)', 176.4, { money: true, answer: '$176.40' }),
          mathItem('A recipe for 8 servings uses 3 cups of flour. How many cups for 6 servings?', 2.25),
          mathItem('The probability of rain is 2/5. What is that as a percent?', 40, { answer: '40' }),
          mathItem('A store marks a $80 item up 25%, then discounts the new price by 25%. What is the final price?', 75, { money: true, answer: '$75.00' })
        ] },
        { id: 'l5-b', problems: [
          mathItem('You walk 3.2 miles in 0.8 hours. What is your average speed in mph?', 4),
          mathItem('Simple interest: $200 at 4% per year for 3 years. Interest = P × r × t. How much interest?', 24, { money: true, answer: '$24.00' }),
          mathItem('A triangle has angles 47° and 62°. What is the third angle? (angles sum to 180°)', 71),
          mathItem('Scale: 1 cm = 2.5 km. A trail is 6.4 cm on the map. How many km?', 16)
        ] },
        { id: 'l5-c', problems: [
          mathItem('What is 3² + 4²?', 25),
          mathItem('A tank is 2/3 full. You drain 1/6 of the whole tank. What fraction remains?', 0.5, { answer: '1/2' }),
          mathItem('Unit rate: 15 ounces for $3.75. Price per ounce?', 0.25, { money: true, answer: '$0.25' }),
          mathItem('A club has a 3:2 ratio of 6th to 5th graders. If there are 20 students, how many are 6th graders?', 12)
        ] },
        { id: 'l5-d', problems: [
          mathItem('Convert 5/8 to a decimal.', 0.625),
          mathItem('You save 15% of a $60 gift. How much do you save?', 9, { money: true, answer: '$9.00' }),
          mathItem('A rectangle’s length is 3 times its width. Perimeter is 48. What is the width?', 6),
          mathItem('The median of 4, 9, 11, 18, 20 is what?', 11)
        ] },
        { id: 'l5-e', problems: [
          mathItem('A car travels 165 miles on 5.5 gallons. Miles per gallon?', 30),
          mathItem('Two items are $13.40 and $8.85. You pay with $30. How much change?', 7.75, { money: true, answer: '$7.75' }),
          mathItem('What is the volume of a cube with edge 5 cm?', 125),
          mathItem('A population grows from 80 to 100. What is the percent increase?', 25, { answer: '25' })
        ] }
      ]
    };
  }

  function lifeByLevel() {
    return {
      1: [
        {
          id: 'l1-hands',
          intro: 'Today we are practicing a real-life skill: keeping your hands clean so you stay healthier at school and at home.',
          questions: [
            { prompt: 'Name two times you should wash your hands. Use full phrases, not just “before” or “after.”', accept: ['eat', 'food', 'bathroom', 'restroom', 'cough', 'sneeze', 'outside', 'pets', 'animals'], need: 2, minWords: 5, explain: 'Good times include before eating, after the bathroom, after coughing or sneezing, and after playing outside.' },
            { prompt: 'About how long should you wash with soap and water?', accept: ['20 seconds', 'twenty seconds', 'happy birthday twice', 'birthday song twice'], need: 1, minWords: 2, explain: 'About 20 seconds — long enough to sing the Happy Birthday song twice.' },
            { prompt: 'If you cut your finger while making a snack, what should you do first?', accept: ['tell an adult', 'tell a parent', 'get an adult', 'call an adult'], need: 1, minWords: 3, explain: 'Tell an adult, then wash the cut and cover it if you can.' }
          ]
        },
        {
          id: 'l1-money-snack',
          intro: 'Today we are practicing a real-life skill: making a smart choice with money.',
          questions: [
            { prompt: 'You have $8. A snack is $3 and a drink is $4. Do you have enough for both? Say yes or no, and show the addition.', accept: ['yes', '3 + 4', 'equals 7', '= 7', 'more than 7'], need: 2, minWords: 4, explain: 'Yes. $3 + $4 = $7, and $8 is more than $7.' },
            { prompt: 'If you buy both, how much money will you have left? Write the amount.', accept: ['$1', '1 dollar', 'one dollar', '8 - 7'], need: 1, minWords: 2, explain: 'You will have $1 left.' },
            { prompt: 'Name one specific reason it can be smart to save that last dollar instead of spending it.', accept: ['need later', 'another day', 'emergency', 'something you need', 'save for'], need: 1, minWords: 4, explain: 'Saving leaves money for something you need later, or for another day.' }
          ]
        },
        {
          id: 'l1-stranger',
          intro: 'Today we are practicing a safety skill: what to do if someone you do not know asks you to go with them or help with a “secret.”',
          questions: [
            { prompt: 'If an adult you do not know asks you to get in a car, what should you do?', accept: ['say no', 'do not go', 'find a trusted', 'tell a parent', 'tell a teacher', 'do not get in'], need: 1, minWords: 4, explain: 'Say no, do not get in, and find a trusted adult.' },
            { prompt: 'Name one trusted adult you could tell.', accept: ['parent', 'mom', 'dad', 'teacher', 'guardian', 'grandparent', 'coach'], need: 1, minWords: 2, explain: 'A parent, teacher, or another adult your family has named as safe.' },
            { prompt: 'Why is a stranger’s “keep this a secret” request a warning sign?', accept: ['secrets from parents', 'trusted adult', 'not a safe', 'warning', 'should not hide'], need: 1, minWords: 5, explain: 'Safe adults do not ask kids to hide things from the people who take care of them.' }
          ]
        },
        {
          id: 'l1-fire',
          intro: 'Today we are practicing what to do if a smoke alarm goes off at home.',
          questions: [
            { prompt: 'What should you do first if the smoke alarm is loud and you smell smoke?', accept: ['get out', 'leave the house', 'go outside', 'exit'], need: 1, minWords: 3, explain: 'Get out of the house and go to your meeting place.' },
            { prompt: 'Should you hide in a closet or go to the family’s outside meeting place? Say which and why.', accept: ['meeting place', 'outside', 'do not hide', 'not the closet'], need: 1, minWords: 5, explain: 'Go to the outside meeting place. Hiding makes it harder for firefighters to find you.' },
            { prompt: 'Once you are outside, whom do you call or tell?', accept: ['911', 'adult', 'parent', 'neighbor', 'firefighter'], need: 1, minWords: 2, explain: 'Tell an adult or call 911 from a safe place. Do not go back in.' }
          ]
        },
        {
          id: 'l1-bus',
          intro: 'Today we are practicing street and bus safety.',
          questions: [
            { prompt: 'Before you cross a street, what should you do with your eyes and body?', accept: ['look both ways', 'left and right', 'both ways', 'wait for the walk'], need: 1, minWords: 3, explain: 'Stop, look both ways, and wait until it is clear or the walk signal is on.' },
            { prompt: 'If you drop something near a bus, should you dart under the bus to grab it? What should you do instead?', accept: ['tell the driver', 'do not dart', 'do not go under', 'ask the driver'], need: 1, minWords: 4, explain: 'Never go under the bus. Tell the driver and wait for help.' },
            { prompt: 'Name one way to be a safe passenger on a bus.', accept: ['sit down', 'stay seated', 'quiet voice', 'aisle clear', 'listen to the driver'], need: 1, minWords: 3, explain: 'Stay seated, keep the aisle clear, and listen to the driver.' }
          ]
        }
      ],
      2: [
        {
          id: 'l2-911',
          intro: 'Today we are practicing when and how to call 911.',
          questions: [
            { prompt: 'Name a situation that is a real emergency for 911, not a spilled juice.', accept: ['fire', 'not breathing', 'unconscious', 'bleeding badly', 'break-in', 'someone collapsing', 'chest pain'], need: 1, minWords: 3, explain: 'Fire, a person who is not breathing, heavy bleeding, or a crime in progress are 911 reasons.' },
            { prompt: 'What three things should you try to tell the dispatcher?', accept: ['address', 'where', 'what happened', 'who needs', 'your name'], need: 2, minWords: 5, explain: 'Where you are, what happened, and who needs help.' },
            { prompt: 'Should you hang up as soon as you say “help”? Why or why not?', accept: ['stay on', 'do not hang', 'until they say', 'dispatcher'], need: 1, minWords: 5, explain: 'Stay on the line until the dispatcher says you can hang up.' }
          ]
        },
        {
          id: 'l2-kitchen',
          intro: 'Today we are practicing kitchen safety while helping cook.',
          questions: [
            { prompt: 'Name two kitchen hazards you should treat carefully.', accept: ['hot stove', 'knife', 'steam', 'grease', 'oven', 'sharp'], need: 2, minWords: 4, explain: 'Hot burners, ovens, steam, grease, and sharp knives.' },
            { prompt: 'If a pan is smoking, what is a safer first move than throwing water on grease?', accept: ['lid', 'adult', 'turn off', 'not water', 'do not throw water'], need: 1, minWords: 4, explain: 'Turn off the heat if you can, slide a lid on, and get an adult. Do not throw water on grease.' },
            { prompt: 'Where should a knife rest when you are not using it?', accept: ['away from the edge', 'flat on the board', 'not in the sink', 'handle back'], need: 1, minWords: 4, explain: 'On the board, away from the counter edge — not loose in a soapy sink.' }
          ]
        },
        {
          id: 'l2-password',
          intro: 'Today we are practicing a basic digital habit: passwords and sharing accounts.',
          questions: [
            { prompt: 'Why is “matthew123” a weak password?', accept: ['easy to guess', 'your name', 'too simple', 'numbers in order'], need: 1, minWords: 4, explain: 'It uses a name and a simple number pattern that other people can guess.' },
            { prompt: 'Who is it usually safe to share a password with?', accept: ['parent', 'guardian', 'not friends', 'not classmates'], need: 1, minWords: 3, explain: 'A parent or guardian — not friends or classmates.' },
            { prompt: 'What should you do if a game chat asks for your address?', accept: ['do not give', 'tell a parent', 'do not share', 'never send'], need: 1, minWords: 4, explain: 'Do not give it. Tell a parent and leave the chat if needed.' }
          ]
        },
        {
          id: 'l2-conflict',
          intro: 'Today we are practicing what to do when a disagreement starts to get hot.',
          questions: [
            { prompt: 'Name one thing you can do with your body before you speak so you do not shove or yell.', accept: ['step back', 'take a breath', 'count to', 'hands down', 'space'], need: 1, minWords: 3, explain: 'Step back, breathe, or put space between you.' },
            { prompt: 'Give an example of an “I” sentence instead of a name-calling sentence.', accept: ['i feel', 'i need', 'i want you to', 'when you'], need: 1, minWords: 5, explain: '“I feel left out when the game starts without me” instead of “You’re a jerk.”' },
            { prompt: 'When is it time to get an adult instead of solving it yourselves?', accept: ['hitting', 'unsafe', 'won t stop', 'threat', 'someone is hurt'], need: 1, minWords: 3, explain: 'If someone is hurt, threatened, or it will not stop, get an adult.' }
          ]
        },
        {
          id: 'l2-time',
          intro: 'Today we are practicing a simple time plan for a school morning.',
          questions: [
            { prompt: 'If the bus comes at 8:10 and you need 20 minutes to eat and pack, what is the latest you should sit down to eat?', accept: ['7:50', '7 50', 'ten to 8'], need: 1, minWords: 1, explain: '7:50 — twenty minutes before 8:10.' },
            { prompt: 'Name two things you can pack the night before to make morning easier.', accept: ['backpack', 'lunch', 'clothes', 'shoes', 'homework', 'permission'], need: 2, minWords: 4, explain: 'Backpack, lunch, clothes, or homework.' },
            { prompt: 'What is one way a timer or checklist helps besides “going faster”?', accept: ['not forget', 'see what is left', 'less arguing', 'know the next'], need: 1, minWords: 4, explain: 'You can see what is left so fewer things get forgotten or argued about.' }
          ]
        }
      ],
      3: [
        {
          id: 'l3-budget',
          intro: 'Today we are practicing a small budget: money in, money out, money saved.',
          questions: [
            { prompt: 'You must keep $8 for a field-trip lunch. You have $20 and want a $15 game. Do you have enough for both? Show the addition.', accept: ['no', '8 + 15', '23', 'more than 20', 'not enough'], need: 2, minWords: 4, explain: 'No. $8 + $15 = $23, which is more than $20.' },
            { prompt: 'If you buy only the lunch, how much could you put in savings from the $20?', accept: ['12', '$12', '20 - 8'], need: 1, minWords: 1, explain: '$20 − $8 = $12 left to save or spend later.' },
            { prompt: 'Name one “need” and one “want” from a normal week. Label which is which.', accept: ['need', 'want', 'lunch', 'bus', 'shoes', 'game', 'skin'], need: 2, minWords: 6, explain: 'Needs keep you safe and able to learn (lunch, shoes). Wants are extras (a new game).' }
          ]
        },
        {
          id: 'l3-ads',
          intro: 'Today we are practicing how ads try to get you to click “buy.”',
          questions: [
            { prompt: 'Name two tricks an ad might use besides listing the real price.', accept: ['limited time', 'everyone has', 'celebrity', 'free', 'only three left', 'before and after'], need: 2, minWords: 5, explain: 'Fake urgency, “everyone has it,” celebrity faces, or hiding the real total.' },
            { prompt: 'What question should you ask before you spend your own money on a game skin?', accept: ['do i still want', 'after a day', 'how many hours', 'what else could', 'parent'], need: 1, minWords: 5, explain: 'Will I still want this tomorrow, and what else could that money do?' },
            { prompt: 'Why might a “free” app not be free?', accept: ['in-app', 'purchases', 'ads', 'data', 'pay later'], need: 1, minWords: 4, explain: 'In-app purchases, ads, or it uses your data.' }
          ]
        },
        {
          id: 'l3-first-aid',
          intro: 'Today we are practicing basic first aid judgment — not replacing a grown-up or 911.',
          questions: [
            { prompt: 'For a small scrape, what are the first two steps after you tell an adult?', accept: ['wash', 'water', 'bandage', 'clean', 'soap'], need: 2, minWords: 4, explain: 'Wash with clean water (and soap if appropriate), then cover if needed.' },
            { prompt: 'When should you call 911 instead of just washing a cut?', accept: ['will not stop bleeding', 'bone', 'head', 'unconscious', 'can t breathe', 'deep'], need: 1, minWords: 4, explain: 'Bleeding that will not stop, a head or bone injury, or someone who cannot breathe.' },
            { prompt: 'Why do you not put butter or toothpaste on a burn?', accept: ['traps heat', 'makes it worse', 'not first aid', 'use cool water'], need: 1, minWords: 4, explain: 'Those can trap heat or irritate skin. Cool water and an adult are the start.' }
          ]
        },
        {
          id: 'l3-online',
          intro: 'Today we are practicing what to do with unkind or creepy messages online.',
          questions: [
            { prompt: 'What should you do with a message that asks you to keep talking in secret from your parents?', accept: ['do not keep secret', 'tell a parent', 'stop chatting', 'screenshot', 'block'], need: 1, minWords: 5, explain: 'Do not keep it secret. Stop, save evidence if you can, and tell a parent.' },
            { prompt: 'Name two pieces of information you should not type into a public chat.', accept: ['address', 'school name', 'password', 'phone', 'full name', 'where i am alone'], need: 2, minWords: 4, explain: 'Address, phone, passwords, and details about being home alone.' },
            { prompt: 'If a classmate is being piled on in a group chat, what is one useful move?', accept: ['do not pile on', 'tell an adult', 'private kind', 'leave the chat', 'screenshot for an adult'], need: 1, minWords: 5, explain: 'Do not join the pile-on. Message the person privately or get an adult.' }
          ]
        },
        {
          id: 'l3-repair',
          intro: 'Today we are practicing a home skill: noticing a problem before it becomes a mess.',
          questions: [
            { prompt: 'You see a drip under the bathroom sink. What should you do besides ignore it?', accept: ['tell an adult', 'put a pan', 'do not use', 'show someone'], need: 1, minWords: 4, explain: 'Tell an adult and catch the water if you can. Do not pretend it is fine.' },
            { prompt: 'Why is it smarter to unplug a toaster before you fish out stuck bread?', accept: ['shock', 'electric', 'unplug', 'power'], need: 1, minWords: 4, explain: 'So you do not get shocked. Unplug first, then get an adult if it is jammed.' },
            { prompt: 'Name one household tool you should not use without permission.', accept: ['knife', 'saw', 'drill', 'cleaner', 'chemical', 'ladder', 'medicine'], need: 1, minWords: 2, explain: 'Power tools, strong cleaners, medicines, and tall ladders need an adult.' }
          ]
        }
      ],
      4: [
        {
          id: 'l4-interest',
          intro: 'Today we are practicing why saving early matters: interest is rent paid on money.',
          questions: [
            { prompt: 'If a bank pays 4% interest per year on $100, about how much interest is that after one year (simple interest)?', accept: ['4 dollar', '$4', 'four dollar', '4% of 100'], need: 1, minWords: 1, explain: 'About $4 on $100 at 4% for one year.' },
            { prompt: 'Why might a high-interest “buy now, pay later” loan be a bad deal for a game console?', accept: ['pay more', 'interest adds', 'costs more than', 'debt'], need: 1, minWords: 5, explain: 'You can pay much more than the sticker price if interest piles up.' },
            { prompt: 'Name one reason to keep an emergency amount instead of spending every dollar.', accept: ['break', 'sick', 'replace', 'unexpected', 'field trip', 'need later'], need: 1, minWords: 4, explain: 'Things break, plans change, and needs show up without a sale banner.' }
          ]
        },
        {
          id: 'l4-media',
          intro: 'Today we are practicing reading a headline with a skeptic’s pencil.',
          questions: [
            { prompt: 'Two headlines use “rescues” vs “rushes” for the same vote. What is each word doing?', accept: ['praise', 'warn', 'steer', 'emotion', 'bias'], need: 1, minWords: 5, explain: 'They steer emotion — praise vs warning — before you see the facts.' },
            { prompt: 'Name two primary things you could check besides the headline.', accept: ['vote record', 'agenda', 'who met', 'video', 'minutes', 'recorded vote'], need: 2, minWords: 4, explain: 'The recorded vote, agenda, minutes, or who was in the room.' },
            { prompt: 'What is an omission?', accept: ['left out', 'not mentioning', 'leaves out', 'did not include'], need: 1, minWords: 3, explain: 'Leaving out a fact that would change how the story feels.' }
          ]
        },
        {
          id: 'l4-civic',
          intro: 'Today we are practicing how a kid can speak up without being a city council member.',
          questions: [
            { prompt: 'Name two peaceful ways to be heard in a town.', accept: ['write', 'petition', 'public comment', 'email', 'meeting', 'letter'], need: 2, minWords: 4, explain: 'Letters, emails, petitions, or speaking at a public comment time — with a parent.' },
            { prompt: 'Why does the First Amendment list assembly and petition, not just speech?', accept: ['together', 'ask the government', 'group', 'not only talking'], need: 1, minWords: 5, explain: 'A free country needs people who can gather and ask the government for change, not only talk in a bedroom.' },
            { prompt: 'What should you still do even when you strongly disagree with a rule?', accept: ['stay respectful', 'no threats', 'facts', 'listen', 'not vandal'], need: 1, minWords: 4, explain: 'Stay safe and respectful. Disagreeing is not a license to threaten or break things.' }
          ]
        },
        {
          id: 'l4-work',
          intro: 'Today we are practicing being someone people can count on — at home and in a club.',
          questions: [
            { prompt: 'You said you would feed the dog at 5. You want to keep playing. What is the honest move?', accept: ['stop and feed', 'do it now', 'set a timer', 'keep the promise', 'feed the dog first'], need: 1, minWords: 5, explain: 'Keep the promise: pause the game, feed the dog, then return.' },
            { prompt: 'Why does “I forgot” wear people out if it happens every week?', accept: ['cannot count', 'unreliable', 'have to nag', 'do not trust', 'extra work'], need: 1, minWords: 5, explain: 'People stop trusting you and have to nag or do the job themselves.' },
            { prompt: 'Name one tool that helps you remember a repeating job.', accept: ['alarm', 'checklist', 'calendar', 'note on the door', 'phone reminder'], need: 1, minWords: 2, explain: 'An alarm, checklist, or calendar reminder.' }
          ]
        },
        {
          id: 'l4-food',
          intro: 'Today we are practicing reading a simple food label before you snack.',
          questions: [
            { prompt: 'Why might two granola bars with the same front picture have different sugar amounts?', accept: ['different recipe', 'serving size', 'brand', 'label', 'not the picture'], need: 1, minWords: 4, explain: 'The picture is marketing. The Nutrition Facts serving size and sugar line tell the truth.' },
            { prompt: 'What should you check if you have a food allergy?', accept: ['ingredient', 'contains', 'allergy', 'may contain'], need: 1, minWords: 3, explain: 'The ingredient list and “contains / may contain” allergy line.' },
            { prompt: 'Name one reason a huge serving on the label matters.', accept: ['more than you eat', 'multiply', 'two servings', 'you might eat two'], need: 1, minWords: 4, explain: 'If you eat two servings, you get twice the sugar, salt, and calories.' }
          ]
        }
      ],
      5: [
        {
          id: 'l5-credit',
          intro: 'Today we are practicing what credit actually costs.',
          questions: [
            { prompt: 'If you put a $300 bike on a card and only pay interest for a year, are you owning the bike or renting the debt? Explain.', accept: ['renting the debt', 'still owe', 'interest only', 'not paying the bike', 'still in debt'], need: 1, minWords: 6, explain: 'Interest-only payments mean you still owe the $300. You are renting the debt.' },
            { prompt: 'Why do lenders check whether someone pays bills on time?', accept: ['risk', 'get paid back', 'trust', 'credit history', 'likely to repay'], need: 1, minWords: 5, explain: 'They want evidence you are likely to pay them back.' },
            { prompt: 'Name one purchase that is a poor fit for borrowed money for an 11-year-old.', accept: ['game skin', 'cosmetic', 'snack', 'want not need', 'something that loses'], need: 1, minWords: 3, explain: 'Short-lived wants (skins, snacks, fads) are a poor reason to owe money.' }
          ]
        },
        {
          id: 'l5-job',
          intro: 'Today we are practicing what makes a first job or volunteer role go well.',
          questions: [
            { prompt: 'Name two things a supervisor remembers besides being “nice.”', accept: ['on time', 'follow directions', 'ask when stuck', 'finish', 'honest', 'no phone'], need: 2, minWords: 5, explain: 'Showing up on time, following directions, asking when stuck, and finishing the job.' },
            { prompt: 'What should you do if you will be late?', accept: ['tell them before', 'call', 'message before', 'do not ghost'], need: 1, minWords: 4, explain: 'Tell the adult in charge before the start time — do not just not show up.' },
            { prompt: 'Why is it smart to write down how you were trained?', accept: ['repeat it', 'not ask the same', 'remember the steps', 'do it right next'], need: 1, minWords: 5, explain: 'So you can repeat the steps correctly without asking the same question every shift.' }
          ]
        },
        {
          id: 'l5-health',
          intro: 'Today we are practicing reading your own body’s signals without drama or ignoring them.',
          questions: [
            { prompt: 'Name two signs you should tell an adult about, not just “push through.”', accept: ['chest pain', 'cannot breathe', 'fainted', 'allergic', 'head after a fall', 'will not stop bleeding', 'fever'], need: 2, minWords: 5, explain: 'Trouble breathing, fainting, a bad head hit, an allergic reaction, or bleeding that will not stop.' },
            { prompt: 'Why does sleep count as training for school, not just “being lazy”?', accept: ['memory', 'mood', 'focus', 'brain', 'attention'], need: 1, minWords: 5, explain: 'Sleep is when the brain stores memories and resets attention and mood.' },
            { prompt: 'What is one honest sentence you can use when you need a break before you explode?', accept: ['i need a break', 'i am overloaded', 'can we pause', 'i need space'], need: 1, minWords: 4, explain: '“I need a five-minute break” is clearer than slamming a door.' }
          ]
        },
        {
          id: 'l5-map',
          intro: 'Today we are practicing using a map or written directions instead of only “I will remember.”',
          questions: [
            { prompt: 'You are meeting a parent at a new library. What two details should you have besides “the library”?', accept: ['address', 'street', 'which entrance', 'phone', 'time', 'cross street'], need: 2, minWords: 4, explain: 'Address or cross street, which door, and a time plus a phone number.' },
            { prompt: 'If you are lost, whom do you ask for help first?', accept: ['staff', 'librarian', 'store employee', 'police', 'parent on the phone', 'uniform'], need: 1, minWords: 3, explain: 'A worker in uniform or your parent by phone — not a random stranger in a car.' },
            { prompt: 'Why write a backup plan (“If I miss you, wait at the front desk”)?', accept: ['phones die', 'late', 'crowd', 'do not wander', 'same place'], need: 1, minWords: 5, explain: 'Phones die and crowds confuse people. A fixed meeting spot stops wandering.' }
          ]
        },
        {
          id: 'l5-repair2',
          intro: 'Today we are practicing judging when a problem is yours to try and when it is an adult’s.',
          questions: [
            { prompt: 'Which of these is reasonable for you to try first: tying a loose backpack strap, or opening the electrical panel?', accept: ['backpack', 'strap', 'not the panel', 'not electrical'], need: 1, minWords: 3, explain: 'The strap. The electrical panel is an adult job.' },
            { prompt: 'What should you do if a bottle of cleaner has no label?', accept: ['do not use', 'tell an adult', 'do not guess', 'not mix'], need: 1, minWords: 4, explain: 'Do not use it or mix it. Give it to an adult.' },
            { prompt: 'Name one reason to take a photo of a problem (a leak, a warning light) before you forget the details.', accept: ['show an adult', 'remember', 'proof', 'details', 'when it started'], need: 1, minWords: 4, explain: 'So an adult can see what you saw, including when it started.' }
          ]
        }
      ]
    };
  }

  function peByLevel() {
    return {
      1: [
        { id: 'l1-indoor', assignment: 'Do this movement quest, then come back:\n1) 15 jumping jacks\n2) 10 slow toe touches\n3) Walk around the room once and notice one thing you see.\nTake your time. Form matters more than speed.', checkPrompt: 'Welcome back. In a few full sentences, name the movements you did and one thing you noticed while you walked.' },
        { id: 'l1-march', assignment: 'March in place for 45 seconds, stretch your arms to the sky 5 times, then do 8 slow squats to a chair (sit and stand). Come back when finished.', checkPrompt: 'Welcome back. Tell me which movements you finished and how your legs feel, using real sentences.' },
        { id: 'l1-outdoor-short', assignment: 'If you can go outside safely, walk to a door, porch, or yard and back. If you must stay inside, march in place for 45 seconds and stretch your arms to the sky 5 times.', checkPrompt: 'Welcome back. Say whether you went outside or stayed in, what movement you did, and one thing your body noticed.' },
        { id: 'l1-wall', assignment: 'Do 10 wall push-ups (hands on a wall, body straight), then 15 seconds of arm circles each direction. Rest, then repeat the wall push-ups once more.', checkPrompt: 'Welcome back. Tell me how many wall push-ups you completed and how your arms felt on the second set.' },
        { id: 'l1-balance', assignment: 'Stand on one foot for 15 seconds, switch feet, then walk heel-to-toe across the room twice. Hold a chair if you need it.', checkPrompt: 'Welcome back. Tell me which foot was harder to balance on and whether you used the chair.' }
      ],
      2: [
        { id: 'l2-circuit', assignment: 'Complete this circuit once: 20 jumping jacks, 10 sit-to-stands from a chair, a 30-second plank or tall-kneel hold, then a slow walk around the room.', checkPrompt: 'Welcome back. List the four parts you did and which part felt hardest.' },
        { id: 'l2-walk-notice', assignment: 'Walk for about 5 minutes (hallway laps or a safe outdoor loop). Notice two specific things: one sound and one thing you see.', checkPrompt: 'Welcome back. Tell me about the walk and name the sound and the sight. Use real sentences.' },
        { id: 'l2-stretch', assignment: 'Do a slow stretch set: 20 seconds reaching for your toes (knees soft), 20 seconds calf stretch each side against a wall, and 5 neck rolls each way. No bouncing.', checkPrompt: 'Welcome back. Name the stretches you did and one place in your body that felt tight.' },
        { id: 'l2-stairs', assignment: 'If you have stairs, walk up and down them 3 times carefully. If not, do 20 step-ups on a sturdy bottom step or a low sturdy platform with an adult nearby.', checkPrompt: 'Welcome back. Tell me whether you used stairs or step-ups and how your breathing changed.' },
        { id: 'l2-skip', assignment: 'Skip or high-knee march down a hallway or yard and back, then shake out your legs and take 5 slow breaths.', checkPrompt: 'Welcome back. Say whether you skipped or high-knee marched, and describe your breathing after.' }
      ],
      3: [
        { id: 'l3-outside', assignment: 'If you can go outside safely, walk for 8–10 minutes. Count how many times you cross a driveway or pass a tree. If you stay in, do 3 rounds of: 15 jacks, 10 sit-to-stands, 20 seconds march.', checkPrompt: 'Welcome back. Tell me which version you did, a number you counted or rounds you finished, and how your body feels now.' },
        { id: 'l3-strength', assignment: 'Do 2 rounds: 8 chair squats, 8 wall push-ups, 20-second Superman or bird-dog hold (on the floor, alternate arm/leg if you know it). Rest 30 seconds between rounds.', checkPrompt: 'Welcome back. Report both rounds and which exercise shook the most.' },
        { id: 'l3-pace', assignment: 'Set a timer for 6 minutes. Walk or march the whole time. At 3 minutes, speed up for 30 seconds, then return to an easy pace.', checkPrompt: 'Welcome back. Tell me whether you sped up at the midpoint and how your heart felt different then versus the easy pace.' },
        { id: 'l3-mobility', assignment: 'World’s-greatest-ish kid stretch: 5 lunges each side (hold a wall), 10 arm swings, and 30 seconds of cat-cow if you know it, or slow shoulder rolls if not.', checkPrompt: 'Welcome back. Name the mobility moves you did and one joint that felt stiffer than the others.' },
        { id: 'l3-play', assignment: 'Invent a 5-minute movement game (example: sock-ball toss into a laundry basket between jumping-jack breaks). Then actually play it.', checkPrompt: 'Welcome back. Describe the game you invented, how long you moved, and one rule you used.' }
      ],
      4: [
        { id: 'l4-intervals', assignment: 'Do 4 rounds: 20 seconds of fast feet or jumping jacks, 40 seconds of easy march. Then stretch calves and chest for 30 seconds each.', checkPrompt: 'Welcome back. Tell me how many rounds you finished and how the fast parts felt compared with the easy march.' },
        { id: 'l4-hike', assignment: 'If you can go outside safely, walk a hill or a longer block (10+ minutes). If not, do 5 minutes of step-ups plus 2 minutes of march with high knees.', checkPrompt: 'Welcome back. Say which option you chose, about how long you moved, and whether you were breathing harder at the end.' },
        { id: 'l4-core', assignment: 'Do 3 sets of a 20-second plank (knees down is fine) and 8 slow dead bugs or opposite-arm/leg reaches. Rest as needed.', checkPrompt: 'Welcome back. Report your sets and whether you modified the plank. Describe how your middle felt.' },
        { id: 'l4-carry', assignment: 'Do a farmer carry: hold a backpack or milk-jug-level weight (ask an adult what’s safe) and walk 4 lengths of a room. Stand tall. Then stretch your hands.', checkPrompt: 'Welcome back. Tell me what you carried, how many lengths you walked, and how you kept your posture.' },
        { id: 'l4-sport', assignment: 'Practice a sport skill for 8 minutes (dribble, wall-ball toss, jump-rope, or shadow swings). Count successful reps in the last minute.', checkPrompt: 'Welcome back. Name the skill, about how long you practiced, and the last-minute count if you had one.' }
      ],
      5: [
        { id: 'l5-long-walk', assignment: 'Walk 12–15 minutes outdoors if safe, or do 12 minutes of mixed indoor marching, step-ups, and jacks. Note your breathing at minute 2 and at the end.', checkPrompt: 'Welcome back. Tell me which option you did, roughly how long, and how your breathing at the end compared with minute 2.' },
        { id: 'l5-strength2', assignment: 'Do 3 rounds: 10 sit-to-stands, 8 wall or counter push-ups, 12 backpack rows (hinge a little, pull a loaded pack toward your ribs), 20-second side plank each side (knees ok).', checkPrompt: 'Welcome back. List the rounds you completed and which movement you would lower next time if form broke down.' },
        { id: 'l5-heart', assignment: 'Take a resting pulse (count beats for 15 seconds, multiply by 4). Then do 3 minutes of steady jacks or high-knee march. Take your pulse again. Write both numbers down.', checkPrompt: 'Welcome back. Report both pulse numbers and what you did between them. Guess why they changed.' },
        { id: 'l5-mobility2', assignment: 'Spend 8 minutes on slow mobility: 90/90 hips or seated figure-4, calf stretches, thoracic rotations (hug yourself and turn), and wrist circles if you write a lot.', checkPrompt: 'Welcome back. Name at least three mobility moves you did and one that felt most limited.' },
        { id: 'l5-team', assignment: 'Lead someone in your house (or yourself with a written card) through a 6-minute warm-up you design: pulse raiser, two strength moves, one stretch. You are the coach. Keep it kind and clear.', checkPrompt: 'Welcome back. Describe the warm-up you coached, who did it, and one cue you gave about form.' }
      ]
    };
  }

  function gradeKeywords(answer, accept, need, minWords) {
    if (wordCount(answer) < (minWords == null ? 2 : minWords)) return false;
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

  function variantsFor(table, level) {
    var pack = table[clampLevel(level)] || table[1];
    return pack;
  }

  function buildPack(subjectId, seed, level) {
    level = clampLevel(level);
    var key = seed + ':' + subjectId + ':L' + level;
    if (subjectId === 'reading') {
      return { kind: 'reading', data: pick(variantsFor(readingByLevel(), level), key), level: level };
    }
    if (subjectId === 'writing') {
      return { kind: 'writing', data: pick(variantsFor(writingByLevel(), level), key), level: level };
    }
    if (subjectId === 'math') {
      return { kind: 'math', data: pick(variantsFor(mathByLevel(), level), key), level: level };
    }
    if (subjectId === 'life') {
      return { kind: 'life', data: pick(variantsFor(lifeByLevel(), level), key), level: level };
    }
    if (subjectId === 'pe') {
      return { kind: 'pe', data: pick(variantsFor(peByLevel(), level), key), level: level };
    }
    return null;
  }

  function openingText(name, pack, level) {
    var hello = name ? name : 'adventurer';
    var lv = 'Level ' + clampLevel(level) + '. ';
    if (pack.kind === 'reading') {
      return 'Hello, ' + hello + '. I am Caldris. ' + lv + 'Read this passage carefully. You can ask me to repeat it.\n\n' + pack.data.passage + '\n\n' + pack.data.questions[0].prompt;
    }
    if (pack.kind === 'writing') {
      var first = pack.data.words[0];
      return 'Hello, ' + hello + '. ' + lv + 'Writing and spelling — one word at a time, then a short piece of writing.\n\nWord 1 of 5. Spell this word: **' + first.word + '**\nHint: ' + first.hint;
    }
    if (pack.kind === 'math') {
      return 'Hello, ' + hello + '. ' + lv + 'Four math problems, one at a time. Show your thinking if you want.\n\nProblem 1: ' + pack.data.problems[0].prompt;
    }
    if (pack.kind === 'life') {
      return 'Hello, ' + hello + '. ' + lv + pack.data.intro + '\n\n' + pack.data.questions[0].prompt;
    }
    if (pack.kind === 'pe') {
      return 'Hello, ' + hello + '. ' + lv + 'Physical education is a real quest — your body counts.\n\n' + pack.data.assignment + '\n\nWhen you finish, type "done" and tell me you are back.';
    }
    return 'Hello, ' + hello + '. Let us begin.';
  }

  function snapshotScore(state) {
    var correct = state && state.correct ? state.correct : 0;
    var helped = state && state.helped ? state.helped : 0;
    return {
      subjectId: state && state.subjectId ? state.subjectId : '',
      correct: correct,
      helped: helped,
      total: correct + helped,
      items: (state && state.itemResults) ? state.itemResults.slice() : []
    };
  }

  function persistLastScore(score) {
    lastScore = score;
    try {
      if (typeof localStorage !== 'undefined') {
        if (score) localStorage.setItem(LAST_SCORE_KEY, JSON.stringify(score));
        else localStorage.removeItem(LAST_SCORE_KEY);
      }
    } catch (e) {}
  }

  function consumeLastScore() {
    var score = lastScore;
    lastScore = null;
    try {
      if (typeof localStorage !== 'undefined') {
        if (!score) {
          var raw = localStorage.getItem(LAST_SCORE_KEY);
          if (raw) score = JSON.parse(raw);
        }
        localStorage.removeItem(LAST_SCORE_KEY);
      }
    } catch (e) {}
    return score;
  }

  function getLastScore() {
    return lastScore;
  }

  function mark(state, status) {
    var itemResults = (state.itemResults || []).slice();
    itemResults.push({ step: state.step, status: status });
    return Object.assign({}, state, {
      itemResults: itemResults,
      correct: (state.correct || 0) + (status === 'correct' ? 1 : 0),
      helped: (state.helped || 0) + (status === 'helped' ? 1 : 0)
    });
  }

  function startLesson(subjectId, options) {
    options = options || {};
    var name = options.name || 'Matthew';
    var level = clampLevel(options.level || 1);
    var seed = options.seed || (options.today || new Date().toDateString()) + ':' + subjectId;
    var pack = buildPack(subjectId, seed, level);
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
      correct: 0,
      helped: 0,
      itemResults: [],
      pack: pack,
      lastText: openingText(name, pack, level)
    };
  }

  function finish(state, text) {
    var next = Object.assign({}, state, { complete: true, lastText: text, attempts: 0 });
    var score = snapshotScore(next);
    persistLastScore(score);
    return {
      state: next,
      text: text,
      complete: true,
      score: score
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

  function helpedNote(explain) {
    return 'Not quite. Here is the answer: ' + explain + '\n\nThis item is completed with help — it will not count as a full-credit answer.';
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
      var correct = gradeKeywords(answer, q.accept, q.need || 1, q.minWords);
      if (correct) {
        var next = mark(state, 'correct');
        var note = 'That is right. ' + q.explain;
        if (state.step + 1 >= pack.data.questions.length) {
          return finish(next, note + '\n\nYou finished the reading questions. [QUEST_COMPLETE]');
        }
        return advance(next, note + '\n\n' + pack.data.questions[state.step + 1].prompt, state.step + 1);
      }
      if (attempts >= 2) {
        var helped = mark(state, 'helped');
        var helpText = helpedNote(q.explain);
        if (state.step + 1 >= pack.data.questions.length) {
          return finish(helped, helpText + '\n\nYou finished the reading questions. [QUEST_COMPLETE]');
        }
        return advance(helped, helpText + '\n\n' + pack.data.questions[state.step + 1].prompt, state.step + 1);
      }
      return stay(state, 'Not quite. Read the passage once more and try again in a full phrase — one loose word is not enough.\n\n' + q.prompt, attempts);
    }

    if (pack.kind === 'writing') {
      if (state.step < pack.data.words.length) {
        var item = pack.data.words[state.step];
        var spelled = normalize(answer) === item.word;
        if (spelled) {
          var okState = mark(state, 'correct');
          var spellNote = 'Yes — **' + item.word + '** is correct.';
          if (state.step + 1 < pack.data.words.length) {
            var nxt = pack.data.words[state.step + 1];
            return advance(okState, spellNote + '\n\nWord ' + (state.step + 2) + ' of 5. Spell this word: **' + nxt.word + '**\nHint: ' + nxt.hint, state.step + 1);
          }
          return advance(okState, spellNote + '\n\nNow writing. ' + pack.data.prompt, state.step + 1);
        }
        if (attempts >= 2) {
          var helpState = mark(state, 'helped');
          var shown = helpedNote('The correct spelling is **' + item.word + '**.');
          if (state.step + 1 < pack.data.words.length) {
            var nxtH = pack.data.words[state.step + 1];
            return advance(helpState, shown + '\n\nWord ' + (state.step + 2) + ' of 5. Spell this word: **' + nxtH.word + '**\nHint: ' + nxtH.hint, state.step + 1);
          }
          return advance(helpState, shown + '\n\nNow writing. ' + pack.data.prompt, state.step + 1);
        }
        return stay(state, 'Not quite. Listen to the hint and try the spelling again.\nHint: ' + item.hint, attempts);
      }
      if (sentenceCount(answer) >= 3 && wordCount(answer) >= 12) {
        return finish(mark(state, 'correct'), 'That is a real piece of writing — thank you for three full sentences. [QUEST_COMPLETE]');
      }
      return stay(state, 'Please write at least 3 complete sentences (12 or more words, with end marks). This part cannot be skipped.', attempts);
    }

    if (pack.kind === 'math') {
      var problem = pack.data.problems[state.step];
      var ok = problem.check(answer);
      if (ok) {
        var mathOk = mark(state, 'correct');
        var mathNote = 'Exactly. The answer is ' + problem.answer + '.';
        if (state.step + 1 >= pack.data.problems.length) {
          return finish(mathOk, mathNote + '\n\nAll four problems are done. [QUEST_COMPLETE]');
        }
        return advance(mathOk, mathNote + '\n\nProblem ' + (state.step + 2) + ': ' + pack.data.problems[state.step + 1].prompt, state.step + 1);
      }
      if (attempts >= 2) {
        var mathHelp = mark(state, 'helped');
        var mathShown = helpedNote('The answer is ' + problem.answer + '.');
        if (state.step + 1 >= pack.data.problems.length) {
          return finish(mathHelp, mathShown + '\n\nAll four problems are done. [QUEST_COMPLETE]');
        }
        return advance(mathHelp, mathShown + '\n\nProblem ' + (state.step + 2) + ': ' + pack.data.problems[state.step + 1].prompt, state.step + 1);
      }
      return stay(state, 'Not quite. Try one more time. You can write the number only.\n\n' + problem.prompt, attempts);
    }

    if (pack.kind === 'life') {
      var lq = pack.data.questions[state.step];
      var lifeOk = gradeKeywords(answer, lq.accept, lq.need || 1, lq.minWords);
      if (lifeOk) {
        var lifeYes = mark(state, 'correct');
        var lifeNote = 'Yes. ' + lq.explain;
        if (state.step + 1 >= pack.data.questions.length) {
          return finish(lifeYes, lifeNote + '\n\nYou finished life skills for today. [QUEST_COMPLETE]');
        }
        return advance(lifeYes, lifeNote + '\n\n' + pack.data.questions[state.step + 1].prompt, state.step + 1);
      }
      if (attempts >= 2) {
        var lifeHelp = mark(state, 'helped');
        var lifeShown = helpedNote(lq.explain);
        if (state.step + 1 >= pack.data.questions.length) {
          return finish(lifeHelp, lifeShown + '\n\nYou finished life skills for today. [QUEST_COMPLETE]');
        }
        return advance(lifeHelp, lifeShown + '\n\n' + pack.data.questions[state.step + 1].prompt, state.step + 1);
      }
      return stay(state, 'Add a bit more detail so I can see your thinking — a single loose word is not enough.\n\n' + lq.prompt, attempts);
    }

    if (pack.kind === 'pe') {
      if (state.step === 0) {
        if (hasAny(answer, ['done', 'finished', 'back', 'did it', 'complete', 'ready'])) {
          return advance(state, pack.data.checkPrompt, 1);
        }
        return stay(state, 'Go do the movement first. When you are back, type "done."\n\n' + pack.data.assignment, attempts);
      }
      var movement = hasAny(answer, [
        'jumping jack', 'jacks', 'toe touch', 'toes',
        'walked', 'walk', 'march', 'marched',
        'stretch', 'stretched', 'squat', 'push-up', 'push up', 'plank',
        'outside', 'yard', 'porch', 'step-up', 'step up', 'stairs',
        'skip', 'high knee', 'lunge', 'balance', 'pulse', 'carry'
      ]);
      var notJustMood = !(normalize(answer).replace(/i feel good/g, '').replace(/feel good/g, '').trim().length < 8 && hasAny(answer, ['feel', 'good']) && !movement);
      if (movement && wordCount(answer) >= 8 && notJustMood) {
        return finish(mark(state, 'correct'), 'That is a real effort. Rest a sip of water if you need it. [QUEST_COMPLETE]');
      }
      return stay(state, 'Tell me in a few full sentences what movement you actually did (jacks, walk, march, stretch, and so on). “I feel good” by itself is not enough.', attempts);
    }

    return stay(state, 'Please try that answer again.', attempts);
  }

  return {
    startLesson: startLesson,
    nextTurn: nextTurn,
    buildPack: buildPack,
    normalize: normalize,
    hasAny: hasAny,
    wordCount: wordCount,
    sentenceCount: sentenceCount,
    getLastScore: getLastScore,
    consumeLastScore: consumeLastScore,
    LAST_SCORE_KEY: LAST_SCORE_KEY
  };
});
