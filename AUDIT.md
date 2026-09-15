# AUDIT — The Realm of Caldris

Audit date: 2026-09-15. Canonical app: `index.html` (plus `css/app.css`, `js/app.js`, `lib/*`).

## What was broken or inconsistent

### Two apps
- `index.html` and `Caldris.html` were forked copies. Index had fishing, day paging, and more parent UI; Caldris.html did not.
- **Fix:** `index.html` is the only shell. `Caldris.html` redirects to `/`.

### Unlock rule vs copy
Live and local UI contradicted itself:
- Banner: “Complete all quests to unlock”
- XP caption: “Earn 75 XP to unlock”
- Code: `xp >= 75 && doneCount >= 3`

A child could theoretically miss Life Skills + PE (or grind XP) and still get mixed messages.

**Fix (canonical):** screen time unlocks only when **all 5 required daily quests** are complete. XP is a bar, not a key. Parent override can still open or re-lock TV, and both actions hit the incident log.

### Lessons died without Anthropic
Chat sessions called `/api/caldris`. With no key the function returns 503, and the child saw a dead “try again” loop.

**Fix:** bundled local quest packs in `lib/quests.js` (hook + 3–6 beats, mixed tap / type / speak / order / map / move / fishing trial). The day is finishable offline.

### Voice dead-ends
Missing Speech Recognition alerted “use Chrome” and stopped. Mic permission errors were silent-ish.

**Fix:** type is always available. Unsupported or blocked mic explains itself and never blocks the quest.

### Parent “Loading…”
Status Snapshot HTML shipped as `Loading...` and only updated after PIN + render. If JS stalled, it stayed there.

**Fix:** snapshot writes real numbers on first parent paint (quests, XP, TV, streak, last activity, mic, override). Default copy is a short ledger line, not infinite loading.

### PIN in the daily session
Name/PIN lived on the daily session object and were easy to read from child-facing state.

**Fix:** PIN is hashed (`p1_…`) on `mq_profile_v1`. It is not copied onto the daily session or painted in the child UI. Verify-only compare. Change-PIN flow in the dashboard.

### Mid-quest loss
Leaving chat dropped the session. Finished questions were gone.

**Fix:** `questState` per subject stores beat index, attempts, scaffold flag, and a short log. Re-entry resumes. Unfinished quests stay incomplete. Parent reset of a subject clears that quest state so it cannot auto-complete again.

### Art unused or half-wired
`realm-main.jpg`, `realm-campsite.jpg`, `matthew.png`, `caldris.jpg`, `sidekick.png` existed; the hub hid the hero or swapped the kid for an orb. Fish art paths pointed at missing JPGs.

**Fix:** campsite/academy backgrounds are full-bleed. Matthew, Caldris, and Bass Buddy sit on the HUD. Dock uses the campsite. Codex uses generated SVG portraits in `assets/fish/`.

### Sound toggle was costume
The 🔊 control flipped an in-memory flag and started **unmuted**, which can blast TTS on phones.

**Fix:** sound/TTS start **off**, persist in `mq_settings_v1`, and need one tap to enable. Short Web Audio chimes (complete / lock / unlock / Caldris) are original, not licensed.

### Fishing orphan risk
Fishing existed in index and tests, but was easy to miss and had no collection stamps next to quests.

**Fix:** dock banner on the hub, journal of stamps + fish. Completing a subject still awards at most one cast. Fishing cannot set TV unlocked.

### Entertainment
Hub was a dark list. Quests were a worksheet chat.

**Fix:** map-like quest cards, lantern motion, XP burst, stamp/streak/rank (Adventurer → Pathfinder → Realm Keeper → Star Warden), sidekick reactions, almost/hint/scaffold retries that still require a real correct beat, rune-burst the **first** time the gate opens.

## What we did not invent
Same product: Matthew / Adventurer, Caldris, five homeschool subjects, PIN parent dashboard, daily reset, incident log, transcripts, TV earned not taken forever.

## Remaining limits (honest)
- Physical Ed “I Did It” is honor-system movement (by design).
- TTS/mic quality depends on the browser. Typing always works.
- Fish portraits are original SVG stand-ins, not photos.
- The Anthropic function is still deployed for optional use; the child loop no longer waits on it.
