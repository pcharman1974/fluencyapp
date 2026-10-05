# Handoff: Beyond the Code Power Reader

For the next Claude Code session. Read this first, then `app/README.md`.

## What this is

A reading-fluency practice app for struggling secondary readers (KS3). It's part of
**Little Wandle Beyond the Code**, a joint product of Wandle Learning Trust, FFT Education and
Collins. FFT is a partner, so the Little Wandle Code logo and characters from
littlewandlecode.org.uk may be used. The owner is Paul Charman, Managing Director of FFT.

Pupils practise reading aloud 2–3 times a week. They read a story page by page, with a speech
check confirming that each page was actually read aloud, and do timed reads scored in words
correct per minute (WCPM). They earn Power points, levels, badges and story cards.

## Where things are

| Thing | Location |
|---|---|
| App (Vite + React + TypeScript) | `app/` |
| Story content: text, images, glossary, warm-up words | `content/secret-stones/story.json` + `images/` |
| Brand tokens (colours; fonts: Nunito for reading text, Montserrat for headings) | `brand/tokens.css`, `brand/BRAND.md`, `brand/assets/` |
| Scoring and speech alignment | `app/src/lib/scoring.ts` |
| "Did they read it?" page check (thresholds) | `app/src/lib/verify.ts` |
| Points, levels, weekly goal, streak, badges | `app/src/lib/rewards.ts` |
| Teacher summary, example class | `app/src/lib/teacher.ts`, `app/src/lib/exampleData.ts` |
| Speech providers (Azure + demo) | `app/src/lib/speech/` |
| Recorded model reading: playback | `app/src/lib/pageAudio.ts` |
| Recorded model reading: generation | `app/scripts/generate-audio.mjs`, `app/scripts/audio-align.mjs` |
| Server (token endpoint, optional password) | `app/server/index.js` |
| Render deployment | `render.yaml` (Blueprint, rootDir `app`) |
| Published prototype | https://claude.ai/artifact/9PjFyJ8ceKsDcm8t9mWS1H, built into `artifact/` |

Commands, run in `app/`: `npm ci`, `npm test` (33 tests), `npm run build`, `npm start`,
`npm run build:artifact`, `npm run audio -- --story secret-stones [--dry-run] [--provider azure]`.

## Immediate task: generate the model-reading audio

The user has added ElevenLabs keys to this cloud environment: `ELEVENLABS_API_KEY` and
`ELEVENLABS_VOICE_ID`, with `ELEVENLABS_MODEL` optional (default `eleven_multilingual_v2`).
**Never print or commit the keys.**

1. In `app/`, run `npm ci`.
2. Run `npm run audio -- --story secret-stones --dry-run`. It should report 10 pages, 21 words
   and 4,727 characters.
3. Run `npm run audio -- --story secret-stones`. This writes `content/secret-stones/audio/`:
   `page-01.mp3` to `page-10.mp3`, `words/*.mp3` and `manifest.json` with the word timings.
   - If a key variable is missing, say which one and stop. Don't guess.
   - If the ElevenLabs request fails, report the status and message.
4. Sanity-check `manifest.json`: every page should have as many timings as its text has
   space-separated words, and the timings should rise steadily.
5. Run `npm run build:artifact`, which copies the audio into `artifact/secret-stones/audio/`.
6. Republish to the **same** artifact. Use `file_path: artifact/index.html` with `url` set to the
   link above, and read the artifact first if this session hasn't published it. In `files`,
   include `secret-stones/story.json`, `secret-stones/audio/manifest.json`, every
   `secret-stones/audio/page-XX.mp3` and every `secret-stones/audio/words/*.mp3`. The images are
   already published; files left out are kept.
7. Commit the audio and the rebuilt artifact, then push to `master`.
8. Tell the user to listen to every page before pupils hear it, especially names such as
   "Göbekli Tepe" and "Carnac". Mispronunciations are fixed by adding entries to
   `ttsReplacements` in `story.json` and re-running with `--force`.

## Decisions already made (don't relitigate)

- **Reward practice and personal improvement, never speed against other pupils.** No
  leaderboards ranking pupils by ability.
- **Weekly goal is 3 sessions.** A day counts as a session if it has at least 2 checked pages, a
  checked re-read or a timed read. Streaks are counted in weeks, and holiday weeks are skipped.
- **Model reading is pre-recorded once per story**, not generated live: fixed cost, quality
  reviewed before release, no pupil data sent to the voice supplier.
- **Orange buttons use deep navy text,** because white on the brand orange fails contrast.
- **Reading text is in Nunito,** at the user's request.
- **Speech-check "mispronounced" flags are shown for adults to check, not counted as errors.**
  Adults review timed-read marking before it's saved.
- **Pupils are identified by a reader code, never a name.**

## Known limits and open items

- **Storage is device-only** (`localStorage`). The teacher view only sees pupils who used that
  device; example pupils are labelled "Example".
- **Phase 2, not started:** logins, school and class structure, a shared database, a
  cross-device teacher dashboard, live Azure speech on iPads (needs the HTTPS host on Render), a
  DPIA for pupils' voice data, and a cost model for speech use.
- **Thresholds and points are starting guesses,** to be tuned in trials: 80% coverage, a pace of
  20–250 words a minute, the points values and the level steps.
- **Draft content to be checked by the content team:** vocabulary definitions and warm-up word
  picks. The cover image still has the "FFT tutoring / Lightning Squad" badge from the original
  screenshot.
- **Possible next feature:** echo reading. The app plays one sentence of the recording, the pupil
  reads it back, and the speech check scores it.

## Working style for this user

The user is FFT's Managing Director: non-developer, decisive, often sends follow-ups mid-task.
- Give plain-English replies with a clear recommendation.
- Test in a browser before publishing.
- Publish updates to the same artifact link.
- Commit and push to `master` after each change. Don't open PRs unless asked.
- Don't invent statistics or cite research without a verifiable source.
- Customer-facing text is a draft for human review.
