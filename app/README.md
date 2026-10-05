# Beyond the Code: reading fluency app (prototype)

Part of Little Wandle Beyond the Code. Secondary pupils who struggle with reading
practise a story page by page, then do a one-minute timed read that gives words
correct per minute (WCPM) and accuracy.

## Run it

```bash
npm install
npm run build
npm run server          # http://localhost:8787 (open on an iPad on the same network)
```

For development with live reload: `npm run server` in one terminal and `npm run dev` in another.
Tests: `npm test`.

Speech check needs an Azure AI Speech resource. Copy `.env.example` to `.env` and fill in
`AZURE_SPEECH_KEY` and `AZURE_SPEECH_REGION`. Without it the option is greyed out and the
adult-marked and demo modes still work.

## How it works

| Part | Where |
|---|---|
| Stories (text, images, glossary) | `../content/<story>/story.json` |
| Brand colours and font | `../brand/tokens.css` |
| WCPM scoring and matching speech to the text | `src/lib/scoring.ts` (tested in `scoring.test.ts`) |
| Speech services (swap-in interface) | `src/lib/speech/` (`azure.ts`, `demo.ts`) |
| Token server (keeps the Azure key off pupils' devices) | `server/index.js` |
| Screens | `src/screens/` |

**Scoring rules** (standard oral reading fluency practice): words read = start to last word
reached; errors = misread, skipped, or told by the adult; extra words and self-corrections
are not errors; WCPM = correct words / minutes.

**Speech check:** the app streams microphone audio to Azure pronunciation assessment
(en-GB) for the minute, then matches the words heard against the passage itself
(`alignHeard`). Azure's "mispronounced" judgement is shown as a dotted underline for the
adult to check, not counted as an error, because it is likely to be unreliable on regional
accents and young voices. The adult always reviews the marking before the result is saved.

## Not production-ready yet

- Results are stored in the browser on that device only (`localStorage`), keyed by a reader code.
- No logins, school or class structure, or teacher dashboard.
- Speech provider not yet tested with real pupils; accuracy on children's voices needs measuring
  against adult marking before it is relied on.
- Vocabulary definitions are drafts.
