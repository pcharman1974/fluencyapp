#!/usr/bin/env node
// Records the app's spoken instructions (content/instructions/phrases.json) in the story voice, once.
//   node scripts/generate-instructions.mjs [--force] [--voice <id>]
// Uses ELEVENLABS_API_KEY and ELEVENLABS_VOICE_ID (and the same voice settings as generate-audio.mjs).
// Writes content/instructions/<id>.mp3. A phrase whose text changes needs --force (or delete its mp3).
import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const dir = path.resolve(here, '../../content/instructions');
const args = process.argv.slice(2);
const force = args.includes('--force');
const voice = args.includes('--voice') ? args[args.indexOf('--voice') + 1] : process.env.ELEVENLABS_VOICE_ID;
const key = process.env.ELEVENLABS_API_KEY;
if (!key || !voice) { console.error('Set ELEVENLABS_API_KEY and ELEVENLABS_VOICE_ID (or --voice).'); process.exit(1); }
const num = (v, d) => (v !== undefined && v !== '' && !Number.isNaN(Number(v)) ? Number(v) : d);

const phrases = JSON.parse(fs.readFileSync(path.join(dir, 'phrases.json'), 'utf8'));
for (const [id, text] of Object.entries(phrases)) {
  const file = path.join(dir, `${id}.mp3`);
  if (!force && fs.existsSync(file)) continue;
  process.stdout.write(`${id}… `);
  const r = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voice}?output_format=mp3_44100_128`, {
    method: 'POST',
    headers: { 'xi-api-key': key, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      text, model_id: process.env.ELEVENLABS_MODEL || 'eleven_v4', language_code: process.env.ELEVENLABS_LANGUAGE || 'en',
      voice_settings: { stability: num(process.env.ELEVENLABS_STABILITY, 0.5), similarity_boost: num(process.env.ELEVENLABS_SIMILARITY, 0.75), style: num(process.env.ELEVENLABS_STYLE, 0.15), use_speaker_boost: true },
    }),
  });
  if (!r.ok) { console.error(`ElevenLabs ${r.status}: ${(await r.text()).slice(0, 200)}`); process.exit(1); }
  fs.writeFileSync(file, Buffer.from(await r.arrayBuffer()));
  console.log('done');
}
console.log('Instructions saved to content/instructions. Listen to each before pupils hear them.');
