#!/usr/bin/env node
// Generate model-reading audio for a story, once, with word timings for highlighting.
//
//   node scripts/generate-audio.mjs --story secret-stones --dry-run      count characters, call nothing
//   node scripts/generate-audio.mjs --story secret-stones                ElevenLabs (default)
//   node scripts/generate-audio.mjs --story secret-stones --provider azure
//
// Options: --voice <id or name>  --only pages|words  --force (redo files that already exist)
// Keys come from the environment (or app/.env):
//   ElevenLabs: ELEVENLABS_API_KEY, optional ELEVENLABS_VOICE_ID, ELEVENLABS_MODEL (default eleven_v4),
//               ELEVENLABS_STABILITY (0.5), ELEVENLABS_SIMILARITY (0.75), ELEVENLABS_STYLE (0.15), ELEVENLABS_LANGUAGE (en)
//   Azure:      AZURE_SPEECH_KEY, AZURE_SPEECH_REGION, optional AZURE_TTS_VOICE
//
// Writes content/<story>/audio/: page-01.mp3 ..., words/<word>.mp3, and manifest.json (timings).
// Already-generated files are skipped, so re-running only pays for what is missing.

import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { fromCharacterTimes, fromWordBoundaries, groupToPageWords, spokenVersion } from './audio-align.mjs';

const args = Object.fromEntries(process.argv.slice(2).reduce((acc, a, i, all) => {
  if (a.startsWith('--')) acc.push([a.slice(2), all[i + 1] && !all[i + 1].startsWith('--') ? all[i + 1] : true]);
  return acc;
}, []));
const here = path.dirname(fileURLToPath(import.meta.url));
const storyId = args.story || 'secret-stones';
const storyDir = path.resolve(here, '../../content', storyId);
const story = JSON.parse(fs.readFileSync(path.join(storyDir, 'story.json'), 'utf8'));
const audioDir = path.join(storyDir, 'audio');
const provider = args.provider || 'elevenlabs';

// ---------- what to generate ----------
const pages = args.only === 'words' ? [] : story.pages;
const wordList = args.only === 'pages' ? [] : [...new Set([
  ...story.pages.flatMap(p => p.warmupWords ?? []),
  ...Object.keys(story.glossary ?? {}),
].map(w => w.toLowerCase()))];
const slug = w => w.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-');
const pageFile = n => `page-${String(n).padStart(2, '0')}.mp3`;

const manifestPath = path.join(audioDir, 'manifest.json');
const manifest = fs.existsSync(manifestPath) ? JSON.parse(fs.readFileSync(manifestPath, 'utf8')) : { pages: {}, words: {} };
const todoPages = pages.filter(p => args.force || !manifest.pages[p.page] || !fs.existsSync(path.join(audioDir, pageFile(p.page))));
const todoWords = wordList.filter(w => args.force || !manifest.words[w] || !fs.existsSync(path.join(audioDir, 'words', slug(w) + '.mp3')));
const chars = todoPages.reduce((n, p) => n + spokenVersion(p.text, story.ttsReplacements).text.length, 0) + todoWords.reduce((n, w) => n + w.length, 0);

console.log(`${story.title}: ${todoPages.length} pages and ${todoWords.length} words to generate, ${chars.toLocaleString()} characters (${provider}).`);
if (args['dry-run'] || chars === 0) process.exit(0);

const num = (v, d) => (v !== undefined && v !== '' && !Number.isNaN(Number(v)) ? Number(v) : d);

// ---------- providers ----------
async function elevenlabs(text) {
  const key = process.env.ELEVENLABS_API_KEY;
  if (!key) throw new Error('Set ELEVENLABS_API_KEY');
  const voice = args.voice || process.env.ELEVENLABS_VOICE_ID;
  if (!voice) throw new Error('Choose a voice: --voice <voice id> or ELEVENLABS_VOICE_ID');
  const r = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voice}/with-timestamps?output_format=mp3_44100_128`, {
    method: 'POST',
    headers: { 'xi-api-key': key, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      text,
      model_id: process.env.ELEVENLABS_MODEL || 'eleven_v4',
      language_code: process.env.ELEVENLABS_LANGUAGE || 'en',
      // Match the ElevenLabs website's sliders: stability 0.5 = halfway, similarity 0.75 = 75%.
      voice_settings: {
        stability: num(process.env.ELEVENLABS_STABILITY, 0.5),
        similarity_boost: num(process.env.ELEVENLABS_SIMILARITY, 0.75),
        style: num(process.env.ELEVENLABS_STYLE, 0.15),
        use_speaker_boost: true,
      },
    }),
  });
  if (!r.ok) throw new Error(`ElevenLabs ${r.status}: ${(await r.text()).slice(0, 300)}`);
  const j = await r.json();
  return { audio: Buffer.from(j.audio_base64, 'base64'), times: fromCharacterTimes(text, j.alignment), voice };
}

async function azure(text) {
  const { AZURE_SPEECH_KEY: key, AZURE_SPEECH_REGION: region } = process.env;
  if (!key || !region) throw new Error('Set AZURE_SPEECH_KEY and AZURE_SPEECH_REGION');
  const sdk = await import('microsoft-cognitiveservices-speech-sdk');
  const cfg = sdk.SpeechConfig.fromSubscription(key, region);
  const voice = args.voice || process.env.AZURE_TTS_VOICE || 'en-GB-SoniaNeural';
  cfg.speechSynthesisVoiceName = voice;
  cfg.speechSynthesisOutputFormat = sdk.SpeechSynthesisOutputFormat.Audio24Khz96KBitRateMonoMp3;
  const synth = new sdk.SpeechSynthesizer(cfg, null);
  const boundaries = [];
  synth.wordBoundary = (_s, e) => {
    if (e.boundaryType !== sdk.SpeechSynthesisBoundaryType.Word) return;
    boundaries.push({ textOffset: e.textOffset, start: e.audioOffset / 1e7, duration: e.duration / 1e7 });
  };
  const result = await new Promise((res, rej) => synth.speakTextAsync(text, res, rej));
  synth.close();
  if (result.reason !== sdk.ResultReason.SynthesizingAudioCompleted) throw new Error('Azure: ' + result.errorDetails);
  return { audio: Buffer.from(result.audioData), times: fromWordBoundaries(text, boundaries), voice };
}

const speak = provider === 'azure' ? azure : elevenlabs;

// ---------- run ----------
fs.mkdirSync(path.join(audioDir, 'words'), { recursive: true });
const save = () => fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));

for (const p of todoPages) {
  const { text, counts } = spokenVersion(p.text, story.ttsReplacements);
  process.stdout.write(`Page ${p.page}… `);
  const out = await speak(text);
  fs.writeFileSync(path.join(audioDir, pageFile(p.page)), out.audio);
  manifest.pages[p.page] = { file: 'audio/' + pageFile(p.page), words: groupToPageWords(out.times, counts) };
  Object.assign(manifest, { provider, voice: out.voice, generatedAt: new Date().toISOString() });
  save();
  console.log(`done (${out.times.at(-1).end.toFixed(1)}s)`);
}
for (const w of todoWords) {
  process.stdout.write(`Word "${w}"… `);
  const out = await speak(w);
  fs.writeFileSync(path.join(audioDir, 'words', slug(w) + '.mp3'), out.audio);
  manifest.words[w] = 'audio/words/' + slug(w) + '.mp3';
  Object.assign(manifest, { provider, voice: out.voice });
  save();
  console.log('done');
}
console.log(`Saved to ${path.relative(process.cwd(), audioDir)}. Listen to every file before pupils use it.`);
