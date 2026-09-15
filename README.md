# The Realm of Caldris

Matthew’s homeschool adventure. Daily subject quests with Caldris (Guide of Worlds), then a Screen Time Gateway that opens only when the day’s work is done. Tomorrow is always a clean slate.

This is a static site plus one optional Netlify Function. Lessons run **offline with bundled quests**. The Anthropic proxy is optional flavor, not required to finish a day.

## Unlock rule (canonical)

- There are **5 daily quests**: Reading, Writing & Spelling, Math, Life Skills, Physical Ed.
- Each completed quest awards XP (25 / 25 / 25 / 20 / 15). The XP bar is **progress theater**, not a bypass.
- **Screen time unlocks only when all 5 quests are complete.**
- A parent can **Unlock TV today (override)** or **Re-lock TV** from the PIN dashboard. Both write the incident log.
- Fishing / Bass Buddy’s Dock is a **bonus**. It never opens the gateway.
- **Reset for New Day** clears today’s child progress and re-locks TV. Name, PIN, settings, streak history, and past-day reports remain.

## Run locally

```bash
npm test          # Node’s built-in test runner
npm start         # serves http://0.0.0.0:3000
```

Or `node server.js`. Open `/` — that is the only app. `/Caldris.html` redirects here.

No API key is required. If `ANTHROPIC_API_KEY` is unset, quests still run from `lib/quests.js`.

### Optional AI proxy

Copy `.env.example` and export:

- `ANTHROPIC_API_KEY` — only if you want live model replies (not used by the default local quest engine)
- `ANTHROPIC_VERSION` — default `2023-06-01`
- `ANTHROPIC_BASE_URL` — default `https://api.anthropic.com`
- `PORT` / `HOST` — local server bind

`GET /healthz` reports whether a key is configured.

## Deploy on Netlify

1. Publish the repo root (`netlify.toml` already sets `publish = "."`).
2. Functions live in `netlify/functions`. `/api/caldris` rewrites to `/.netlify/functions/caldris`.
3. Set `ANTHROPIC_API_KEY` in Site settings → Environment variables only if you want the proxy. The child app does not depend on it.

## Parent dashboard

The ⚙ Parent Mode button asks for the 4-digit PIN. Wrong PIN shows an error and does not leak the code. The PIN is stored hashed in `localStorage` (`mq_profile_v1`), never drawn in the child UI.

Parents can:

- Read today’s (and past days’) XP, quests, TV status, streak, last activity, mic state
- Open session transcripts by subject
- Mark a quest complete / reset it (logged)
- Log incidents
- Change the PIN
- Override or re-lock TV
- Reset the day

## Storage keys

| Key | Lives | Purpose |
| --- | --- | --- |
| `mq_profile_v1` | Persistent | Name, hashed PIN, setup flag, streak, stamps |
| `mq_acad_v3` | Today only (yesterday is archived) | Completions, XP, incidents, TV override, mid-quest progress |
| `mq_summaries_v1` | Transcripts by date | Parent-readable Q&A |
| `mq_history_v1` | Archived days | Past reports |
| `mq_settings_v1` | Persistent | Sound / TTS preference (starts muted) |
| `mq_fishing_v1` | Persistent catches; daily casts reset | Bonus dock minigame |

## Voice

Tap 🎤 to speak, or type. If Speech Recognition is missing or blocked, the quest continues with typing. TTS only runs after sound is enabled.

## Tests

```bash
npm test
```

Covers daily rollover, PIN hashing, XP cap, **unlock-only-when-all-quests-done**, parent override, reset-for-new-day, mid-quest save, fishing odds/casts/codex, and local quest grading.
