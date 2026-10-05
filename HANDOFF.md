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
| Progress charts (reading speed in WCPM, Power over time), pupil + teacher | `app/src/components/ProgressCharts.tsx`, `app/src/lib/progress.ts` |
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
`ELEVENLABS_VOICE_ID`, with `ELEVENLABS_MODEL` optional (default `eleven_v4`, since 5 Oct 2026; the voice used is `fwBvoY941Q2wcOnBTlbP`). Voice settings: `ELEVENLABS_STABILITY` (default 0.5), `ELEVENLABS_SIMILARITY` (0.75), `ELEVENLABS_STYLE` (0.15), `ELEVENLABS_LANGUAGE` (en).
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
- **Regular and often: 5 minutes a day, at least 3 days a week** (decided 5 Oct 2026). A day counts
  as a session once its reading bar is full: 5 minutes of checked reading aloud (counted page reads,
  counted re-reads, timed reads). Filling the bar earns +15 Power; each extra full minute that day
  earns +2, up to 15 extra minutes. Weekly goal is 3 such days. Streaks are counted in weeks, and
  holiday weeks are skipped. Constants in `app/src/lib/rewards.ts`.
- **Session order: read first, then beat your best, then word practice at the end** (decided
  5 Oct 2026). A practice word must be tried once before moving on.
- **Mic check is a one-off per device** (decided 5 Oct 2026), not part of each session. It runs
  before the first reading on a device and can be re-run from "Check microphone" on the home
  screen. Later it should move to first login.
- **Model then do on every session page** (decided 5 Oct 2026): the pupil listens to the model reading
  (word highlighting on) and Read aloud unlocks only when it has played to the end; then they read
  the page alone, unaided. "Practise any page" keeps Listen optional with a gentle nudge. Grounded in
  listening-passage-preview evidence for secondary struggling readers (Wexler et al. 2008) and the
  EEF's guided oral reading. Echo reading (Rasinski: sentence by sentence) is the agreed next step.
- **"Your best reading" replaces "Beat your best"** (decided 5 Oct 2026): encourages fluent reading with
  expression, not speed (Rasinski: rehearsal is for a meaningful reading, not a fast one). Storyteller
  tips before reading; afterwards the pupil sees feedback only: words right first, an Expression
  score (Azure prosody, a guide) and words a minute last. No listen-back and no self-evaluation
  (both judged too much for teenagers; old 'selfcheck' records still show in the data log). A new
  personal best needs at least 95% of words right, and only accurate readings set the best.
- **Tricky-word boxes show while listening, not while reading aloud** (decided 5 Oct 2026): boxed
  during the model reading so pupils notice them, plain at "Your turn" and while the microphone is on
  (they read them unprompted), back once the page is done so meanings can be tapped.
- **Running record after "Your best reading"** (decided 5 Oct 2026): the passage with each word marked:
  read right (plain), said something else (what was said above it), missed out (faded, dash above),
  added word (+word where it came), not reached (grey). Teachers see the same record, in classic terms,
  beside each saved recording. Self-corrections and words told by an adult can't be detected, so they
  aren't marked. Built in `lib/verify.ts` (`runningRecord`) from the speech-check alignment.
- **The app opens on "Who's reading?" every time** (decided 5 Oct 2026), for shared school devices:
  "I've read before" (tap your number; the last reader is highlighted) or "I'm new" (make up a
  4-digit number). Numbers are unique: the server claims a new number atomically
  (POST /api/qa/readers, 409 if taken), and a taken number is never opened from "I'm new".
  Moving between screens doesn't ask again; "Change reader" does.
- **The timed read is a bonus activity, always one minute** (decided 5 Oct 2026): +10 Power, counts
  towards the daily bar, offered at the end of a session and from the home screen. One fixed length
  keeps WCPM comparable over time.
- **Model reading is pre-recorded once per story**, not generated live: fixed cost, quality
  reviewed before release, no pupil data sent to the voice supplier.
- **Orange buttons use deep navy text,** because white on the brand orange fails contrast.
- **Reading text is in Nunito,** at the user's request.
- **Speech-check "mispronounced" flags are shown for adults to check, not counted as errors.**
- **Timed reads are marked automatically** by the speech check (demo data if no Azure key). No adult
  marking step (changed 5 Oct 2026 at the user's request; previously adults reviewed the marking).
- **Pupils are identified by a reader code, never a name.**

## Testing data store (5 Oct 2026)

The whole app is currently a test version. When the site has a password and the Render disk is
mounted at `/var/data`, every record (page reads, re-reads, warm-ups, timed reads, Power, badges) is
also sent to the server, with a recording of each read and the words the speech check heard. Nothing
is deleted automatically. Code: `app/server/qa.js`, `app/src/lib/qa.ts`, teacher panel
`app/src/components/ServerData.tsx`. The home screen shows a "Test version" notice while it's on.
Pupils are chosen from a list (this device plus the server) or added by code; choosing one loads
their history from the server. **Before real pupils use it: DPIA, consent, retention policy.**

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
