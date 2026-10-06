# Switching on the Azure speech check, and calibrating it

Status: plan, not yet started. The app currently runs in demo mode (no Azure key), so every "speech check" result so far is made up.

## What has been checked without a key

- The server swaps the Azure key for a 10-minute token (`/api/speech-token`), so the key never reaches a pupil's device. With no key it answers "not configured" and the app falls back to demo mode.
- The browser asks Azure for **pronunciation assessment in British English (en-GB)**, scored per word, with Azure's own miscue detection off. The app lines up the heard words against the page itself (`app/src/lib/scoring.ts`).
- Words are read in Azure's spoken form ("twenty twenty two", "six hundred pounds", "f a"). The app converts these back to the printed text before marking. Tests read every page of both stories the way Azure writes it down, and every page scores 100%.
- New: if Azure stops with an error part way through (network drop, expired token, quota), the reason is now saved with the test recording (`speechProblem`). This lets us tell "the pupil didn't read" apart from "the service failed".
- Not testable without a key: real recognition quality, how Azure behaves with children's voices, and whether the browser copes with two microphone users at once (the test recording and Azure). Step 3 checks the last of these.

## 1. Switch it on (about 30 minutes, technical person)

1. In the Azure portal, create a **Speech** resource in **UK South**. Use the standard (S0) tier: the free tier has tight limits. Check the current price of pronunciation assessment on Microsoft's pricing page before setting a budget alert.
2. In Render, go to **power-reader → Environment** and add:
   - `AZURE_SPEECH_KEY` = the key from the resource
   - `AZURE_SPEECH_REGION` = `uksouth`
3. Save. Render redeploys. The timed-read screen should stop saying "marked with made-up demo data".

## 2. Before any pupil uses it

- **DPIA.** Pupils' voice recordings and reading results are personal data about children. The DPIA needs to cover:
  - Microsoft as a processor (audio sent to Azure UK South);
  - the test recordings kept on the Render disk (Render region: Frankfurt, see `render.yaml`);
  - how long the data is kept (currently indefinitely, as a test) and who can listen.
- Tell the schools, and parents through the schools, that reading aloud is recorded for testing. The app already shows a notice on the home screen.
- Agree the pupil numbers with the school so no names go into the app. Notes in the marking review say not to include names.

## 3. Adult smoke test (one afternoon)

Two or three staff each read 5 pages and a timed read, on a laptop, an iPad and an Android phone. Then, in **Teacher view → Saved on the server**, check:

- each recording says "Azure AI Speech (en-GB)", not "demo";
- there is no `speechProblem` in "All fields";
- the recording plays back. If a device has no recording, or Azure heard nothing while recording was on, that device can't run both at once. Note it.

## 4. Calibration with pupils (2–3 weeks)

**Who.** 5–10 pupils from the target group, chosen to include:

- regional accents;
- pupils with English as an additional language;
- quiet or hesitant readers;
- at least one session in a normal noisy classroom, not a quiet room.

**How much.** At least 30 reads, about 3,000 words in total. The marking-check panel says when there is too little to judge.

**Marking.** For each read, an adult uses **Review marking**:

1. Listen to the recording.
2. Tap the words the pupil got wrong, without seeing the app's marks.
3. Say whether they would count the page.

Have a second adult mark 1 read in 10 as well. How often two adults agree with each other is the fair benchmark for the app.

**What the panel reports, overall and per speech service:**

- **Agreed:** the share of words where the app and the adult agree.
- **Right words marked wrong:** the app said wrong, the adult heard it right. This is the most important number, because it is unfair on pupils and puts them off.
- **Errors missed:** the adult heard an error the app accepted. This makes accuracy and WCPM read high.
- **Page decisions agreed:** whether the app and the adult would both count the page, and whether the app leans too strict or too lenient.

**Suggested targets.** These are starting points for discussion, not taken from research:

- right words marked wrong at or under 5%;
- page decisions agreeing at least 9 times in 10;
- the app agreeing with an adult about as often as two adults agree with each other.

## 5. What can be tuned, and where

| Setting | Now | File | Change it if… |
|---|---|---|---|
| Share of page that must be heard to count it | 80% | `app/src/lib/verify.ts` (`MIN_COVERAGE`) | the app is too strict or too lenient on pages adults would count |
| Pace limits for a page | 20–250 words a minute | `verify.ts` (`MIN_WPM`, `MAX_WPM`) | genuine slow readers are refused |
| Word flagged "check" (not an error) | Azure word score under 60 | `app/src/lib/scoring.ts` (`checkBelow`) | flags pile up on accents |
| Spoken forms of numbers and abbreviations | — | `app/src/lib/spoken.ts` | a word that's always read right is marked wrong |

Change one setting at a time, then re-run the comparison on the same reviewed recordings. The reviews are kept with each recording, so this costs no more adult time.

## 6. Decision point

After calibration, decide:

- go: the targets are met;
- tune and repeat: they are close;
- keep adult marking for the timed read: the app misses or invents too many errors.

Prosody ("expression") scores from Azure are shown as a guide only. Microsoft's documentation has listed prosody assessment for US English, so it may not be returned for en-GB. Check this in step 3, and don't use those scores for decisions.
