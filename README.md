# The Realm of Caldris

Matthew’s homeschool adventure. Daily subject rooms with Caldris as the teacher, then a Screen Time Gateway that opens only when the day’s work is done. Tomorrow is always a clean slate.

This is a static site plus one Claude proxy (`/api/caldris`). Local lesson packs paint the room immediately. When `ANTHROPIC_API_KEY` is set, Claude is the live teacher on lesson start and on every kid question.

## Unlock rule (canonical)

- There are **5 daily rooms**: Reading Treehouse, Writing Desk, Math Workshop, Life Skills Kitchen, Nature Lab.
- Each completed room awards XP (25 / 25 / 25 / 20 / 15). The XP bar is **progress theater**, not a bypass.
- **Screen time unlocks only when all 5 rooms are complete.**
- A parent can **Unlock TV today (override)** or **Re-lock TV** from the PIN dashboard. Both write the incident log.
- Fishing / Bass Buddy’s Dock is a **bonus**. It never opens the gateway.
- **Reset for New Day** clears today’s child progress and re-locks TV. Name, PIN, settings, streak history, and past-day reports remain.

## Claude is the teacher

The frontend **POSTs `/api/caldris`** when a room opens and again each time Matthew types or speaks a question.

| Piece | Role |
| --- | --- |
| `js/app.js` | Calls `CaldrisTeacher.callCaldris` on lesson start and on each kid question |
| `lib/teacher.js` | **One system prompt** (child Matthew, teacher Caldris, current room + objective, two-way Q&A, 2–5 short complete sentences) plus request builder / reply parser / last API status |
| `server.js` | Local `POST /api/caldris` proxy to Anthropic |
| `netlify.toml` | Rewrites `/api/caldris` → `/.netlify/functions/caldris` |
| `netlify/functions/caldris.js` | Same proxy for Netlify |
| `ANTHROPIC_API_KEY` | Required for live Claude. If missing, the proxy returns **503** and the classroom shows “Teacher is offline — practice mode” with the local pack |

Model: `claude-sonnet-5` (the alias this key already uses after Sonnet 4 retired). If that id 404s, the client retries `claude-sonnet-4-5`, then `claude-3-5-sonnet-latest`. `max_tokens` is **900** so replies are not clipped mid-clause.

A parent-dashboard-only debug line shows last teacher API status: `ok` / `no-key` / error code.

## Run locally

```bash
npm test          # Node’s built-in test runner
npm start         # serves http://0.0.0.0:3000
```

Or `node server.js`. Open `/` — that is the only app. `/Caldris.html` redirects here.

Copy `.env.example` and export:

- `ANTHROPIC_API_KEY` — live Claude teacher
- `ANTHROPIC_VERSION` — default `2023-06-01`
- `ANTHROPIC_BASE_URL` — default `https://api.anthropic.com`
- `PORT` / `HOST` — local server bind

`GET /healthz` reports whether a key is configured.

## Deploy on Netlify

1. Publish the repo root (`netlify.toml` already sets `publish = "."`).
2. Functions live in `netlify/functions`. `/api/caldris` rewrites to `/.netlify/functions/caldris`.
3. Set `ANTHROPIC_API_KEY` in Site settings → Environment variables so Claude can teach.

## Parent dashboard

The ⚙ Parent Mode button asks for the 4-digit PIN. Wrong PIN shows an error and does not leak the code. The PIN is stored hashed in `localStorage` (`mq_profile_v1`), never drawn in the child UI.

Parents can:

- Read today’s (and past days’) XP, rooms, TV status, streak, last activity, mic state
- See last teacher API status (`ok` / `no-key` / error)
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

Tap **Enable teacher voice** once. That gesture unlocks `speechSynthesis` on desktop Chrome and mobile Safari/Chrome and is saved in `mq_settings_v1`.

- Speech is **queued**. A re-render never calls `speechSynthesis.cancel()`.
- Cancel only on a new kid question, Skip talking, mute, Replay, or leaving the room.
- Long lines split on sentence boundaries and play in order. Replay speaks the same full line that is in the bubble.
- If autoplay is blocked, a **Tap to hear Caldris** overlay appears.
- Mic and speaker are separate. If the speaker fails, typing still works. If the mic is denied, the text box is focused: “Type your question.”

## Tests

```bash
npm test
```

Covers daily rollover, PIN hashing, XP cap, **unlock-only-when-all-quests-done**, parent override, reset-for-new-day, mid-quest save, fishing odds/casts/codex, local quest grading, speech sentence-split / no-cancel-on-render, and Claude request payload shape.
