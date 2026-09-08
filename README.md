# The Realm of Caldris

Daily lessons for Matthew: reading, writing, math, life skills, and PE. Finish 3 subjects and 75 XP to unlock screen time. A parent PIN opens today's report, transcripts, and quest overrides.

This repository is public. Never put the Anthropic API key in a file that gets committed.

## Run it today (laptop)

1. Copy `.env.example` to `.env`
2. Put the Anthropic API key in `.env` as `ANTHROPIC_API_KEY=...`
3. From this folder run:

```bash
node server.js
```

4. Open [http://127.0.0.1:3000](http://127.0.0.1:3000)
5. On first launch, enter Matthew's name and a 4-digit parent PIN

`npm start` does the same thing. There are no packages to install.

If the key is missing, school still works. Caldris uses the prepared lesson path for that day (real questions, not a skip button). Add the key and restart the server when you want live Claude.

The hub uses the Caldris main-page art, the Wild Realm camp, and Matthew's unnamed fish sidekick. Those files live in `assets/`.

## What was broken before

- Chat called `/api/caldris`, but no server existed
- Overnight, the app threw away the child's name and the parent PIN
- Screen-time copy said "complete all quests" while the real rule is 3 subjects and 75 XP
- `Caldris.html` and `index.html` were duplicate copies that would drift

## Checks

```bash
npm test
```
