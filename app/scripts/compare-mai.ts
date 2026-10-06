// Runs saved trial recordings through Microsoft's MAI-Transcribe-2 (a cheaper, file-based transcription model) and
// compares its marking with the live Azure pronunciation check the app uses now, and with adults' blind marking.
// Same scoring code as the app (checkPage), so the only thing that changes is what the speech service heard.
//
//   npm run compare:mai -- [--limit 50] [--reviewed-only] [--hints] [--local ../.qa-data]
//
// Needs: QA_URL (the Render app's address) and APP_PASSWORD, or --local <QA data dir>;
//        MAI_SPEECH_KEY and MAI_SPEECH_REGION (a Speech resource in a region with MAI-Transcribe, e.g. northeurope).
// Writes .qa-compare/report.md and .qa-compare/recordings.csv (pupil transcripts: never commit or share outside FFT).

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import 'dotenv/config';
import { checkPage, type RecordMark } from '../src/lib/verify';
import { compare, appWords, type Agreement, type Review } from '../src/lib/review';
import type { HeardWord } from '../src/lib/scoring';

interface Meta {
  id: string; type: string; storyId?: string; page?: number; text?: string; heard?: string; provider?: string;
  audio?: string; audioType?: string; check?: { record?: RecordMark[]; verified?: boolean; durationSec?: number };
  review?: Review;
}

const args = process.argv.slice(2);
const flag = (n: string) => args.includes(n);
const opt = (n: string) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : undefined; };
const LIMIT = Number(opt('--limit') ?? 1000);
const LOCAL = opt('--local');
const OUT = path.resolve(opt('--out') ?? '.qa-compare');
const { QA_URL = '', APP_PASSWORD = '' } = process.env;
const KEY = process.env.MAI_SPEECH_KEY ?? '';
const REGION = process.env.MAI_SPEECH_REGION ?? 'northeurope';
const ENDPOINT = process.env.MAI_SPEECH_ENDPOINT ?? `https://${REGION}.api.cognitive.microsoft.com`;

const auth = { Authorization: 'Basic ' + Buffer.from('x:' + APP_PASSWORD).toString('base64') };
const base = QA_URL.endsWith('/') ? QA_URL : QA_URL + '/';

async function listRecordings(): Promise<Meta[]> {
  if (LOCAL) {
    const dir = path.join(LOCAL, 'recordings');
    return fs.readdirSync(dir).filter(n => n.endsWith('.json')).map(n => JSON.parse(fs.readFileSync(path.join(dir, n), 'utf8')));
  }
  const r = await fetch(base + 'api/qa/recordings', { headers: auth });
  if (!r.ok) throw new Error(`Listing recordings failed: HTTP ${r.status}`);
  return r.json();
}

async function audioOf(m: Meta): Promise<Buffer> {
  if (LOCAL) return fs.readFileSync(path.join(LOCAL, 'recordings', m.audio!));
  const r = await fetch(base + `api/qa/recordings/${encodeURIComponent(m.id)}/audio`, { headers: auth });
  if (!r.ok) throw new Error(`audio HTTP ${r.status}`);
  return Buffer.from(await r.arrayBuffer());
}

/** Browser recordings are webm/mp4; MAI-Transcribe takes WAV, MP3 or FLAC. */
function toWav(audio: Buffer, tmp: string): { wav: Buffer; seconds: number } {
  const src = path.join(tmp, 'in.bin'), dst = path.join(tmp, 'out.wav');
  fs.writeFileSync(src, audio);
  execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', src, '-ac', '1', '-ar', '16000', dst]);
  const seconds = Number(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', dst]).toString().trim());
  return { wav: fs.readFileSync(dst), seconds };
}

interface MaiResult { words: HeardWord[]; text: string; ms: number }

async function transcribe(wav: Buffer, hints: string[]): Promise<MaiResult> {
  const definition = {
    locales: ['en'],
    enhancedMode: { enabled: true, model: 'MAI-Transcribe-2', modelOptions: { transcribeStyle: 'verbatim', timestamps: 'word' } },
    ...(hints.length ? { phraseList: { phrases: hints } } : {}),
  };
  const form = new FormData();
  form.append('audio', new Blob([wav], { type: 'audio/wav' }), 'audio.wav');
  form.append('definition', JSON.stringify(definition));
  const t0 = Date.now();
  for (let attempt = 0; ; attempt++) {
    const r = await fetch(`${ENDPOINT}/speechtotext/transcriptions:transcribe?api-version=2025-10-15`, {
      method: 'POST', headers: { 'Ocp-Apim-Subscription-Key': KEY }, body: form,
    });
    if (r.status === 429 && attempt < 4) { await new Promise(res => setTimeout(res, 2000 * 2 ** attempt)); continue; }
    if (!r.ok) throw new Error(`MAI HTTP ${r.status}: ${(await r.text()).slice(0, 300)}`);
    const j = await r.json();
    const ms = Date.now() - t0;
    const words: HeardWord[] = (j.phrases ?? []).flatMap((p: any) =>
      (p.words ?? []).map((w: any) => ({ text: w.text, startSec: (w.offsetMilliseconds ?? 0) / 1000 })));
    const text = (j.combinedPhrases ?? []).map((p: any) => p.text).join(' ');
    // No word list (timestamps off or unsupported): fall back to splitting the text.
    return { words: words.length ? words : text.split(/\s+/).filter(Boolean).map((t: string) => ({ text: t })), text, ms };
  }
}

/** One marking as an adult-style review (word positions marked wrong), so two marks can be compared word by word. */
const asReview = (record: RecordMark[]): Pick<Review, 'wrong' | 'stoppedAt'> => {
  const w = appWords(record);
  return { wrong: w.flatMap((m, i) => (m.kind !== 'ok' && m.kind !== 'unread' ? [i] : [])), stoppedAt: w.reduce((l, m, i) => (m.kind !== 'unread' ? i : l), -1) };
};
const add = (a: Agreement, b: Agreement) => { for (const k of Object.keys(a) as (keyof Agreement)[]) a[k] += b[k]; };
const zero = (): Agreement => ({ words: 0, bothRight: 0, bothWrong: 0, falseAlarms: 0, missed: 0 });
const pct = (a: number, b: number) => (b ? `${Math.round((a / b) * 1000) / 10}%` : '–');
const csv = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;

async function main() {
  if (!KEY) throw new Error('Set MAI_SPEECH_KEY (and MAI_SPEECH_REGION, e.g. northeurope).');
  if (!LOCAL && !QA_URL) throw new Error('Set QA_URL and APP_PASSWORD, or pass --local <QA data dir>.');
  fs.mkdirSync(OUT, { recursive: true });
  const tmp = fs.mkdtempSync(path.join(OUT, 'tmp-'));

  let all = (await listRecordings()).filter(m => m.audio && m.text && m.check?.record);
  if (flag('--reviewed-only')) all = all.filter(m => m.review);
  all = all.slice(0, LIMIT);
  console.log(`${all.length} recordings to run through MAI-Transcribe-2 (${REGION}).`);

  const rows: string[] = [['id', 'type', 'story', 'page', 'audioSec', 'maiMs', 'azureAccepted', 'maiAccepted', 'adultCounted',
    'azureVsAdult', 'maiVsAdult', 'azureVsMai', 'azureHeard', 'maiHeard'].join(',')];
  const azAdult = zero(), maiAdult = zero(), azMai = zero();
  let reviewed = 0, decisions = 0, azDecisionOk = 0, maiDecisionOk = 0, sameDecision = 0, pageReads = 0, audioSec = 0, failed = 0;
  const latency: number[] = [];

  for (const [i, m] of all.entries()) {
    try {
      const { wav, seconds } = toWav(await audioOf(m), tmp);
      const hints = flag('--hints') ? [...new Set(m.text!.split(/\s+/).map(w => w.replace(/[^\p{L}\p{N}'’-]/gu, '')).filter(w => w.length > 3))].slice(0, 100) : [];
      const mai = await transcribe(wav, hints);
      latency.push(mai.ms); audioSec += seconds;
      const elapsed = m.check!.durationSec ?? seconds;
      const maiCheck = checkPage(m.text!, { words: mai.words, durationSec: elapsed, provider: 'MAI-Transcribe-2' }, elapsed);
      const azRecord = m.check!.record!;

      const am = compare(azRecord, asReview(maiCheck.record)); add(azMai, am);
      let aa: Agreement | undefined, ma: Agreement | undefined;
      if (m.review) { reviewed++; aa = compare(azRecord, m.review); ma = compare(maiCheck.record, m.review); add(azAdult, aa); add(maiAdult, ma); }
      const isPage = m.type !== 'timed';
      if (isPage) { pageReads++; if (m.check!.verified === maiCheck.verified) sameDecision++; }
      if (isPage && typeof m.review?.counted === 'boolean') {
        decisions++;
        if (m.check!.verified === m.review.counted) azDecisionOk++;
        if (maiCheck.verified === m.review.counted) maiDecisionOk++;
      }
      const agreeRate = (a?: Agreement) => (a ? pct(a.bothRight + a.bothWrong, a.words) : '');
      rows.push([m.id, m.type, m.storyId, m.page, seconds.toFixed(1), mai.ms, isPage ? m.check!.verified : '', isPage ? maiCheck.verified : '',
        m.review?.counted ?? '', agreeRate(aa), agreeRate(ma), agreeRate(am), m.heard, mai.text].map(csv).join(','));
      console.log(`${i + 1}/${all.length} ${m.id}: ${seconds.toFixed(0)} s audio, ${mai.ms} ms`);
    } catch (e) {
      failed++;
      console.warn(`${i + 1}/${all.length} ${m.id}: ${(e as Error).message}`);
    }
  }
  fs.rmSync(tmp, { recursive: true, force: true });
  fs.writeFileSync(path.join(OUT, 'recordings.csv'), rows.join('\n') + '\n');

  latency.sort((a, b) => a - b);
  const q = (p: number) => (latency.length ? (latency[Math.min(latency.length - 1, Math.floor(p * latency.length))] / 1000).toFixed(1) + ' s' : '–');
  const line = (name: string, a: Agreement) =>
    `| ${name} | ${a.words} | ${pct(a.bothRight + a.bothWrong, a.words)} | ${pct(a.falseAlarms, a.bothRight + a.falseAlarms)} | ${pct(a.missed, a.bothWrong + a.missed)} |`;
  const report = `# MAI-Transcribe-2 vs current Azure check

Run ${new Date().toISOString().slice(0, 16)} · region ${REGION} · ${all.length - failed} recordings (${failed} failed) · ${(audioSec / 60).toFixed(1)} min of audio${flag('--hints') ? ' · page words sent as hints' : ''}

Both columns use the app's own scoring (checkPage). Only the speech service differs.

## Against adults' blind marking (${reviewed} reviewed recordings)

| Marking | Words | Agrees with adult | Marked wrong when adult heard it right | Errors the adult heard that were missed |
|---|---|---|---|---|
${line('Azure (now)', azAdult)}
${line('MAI-Transcribe-2', maiAdult)}

Page decisions where the adult said whether they'd count the page: ${decisions}. Azure agreed ${pct(azDecisionOk, decisions)}, MAI agreed ${pct(maiDecisionOk, decisions)}.

## Against each other (all ${all.length - failed} recordings)

Word-by-word agreement, Azure vs MAI: ${pct(azMai.bothRight + azMai.bothWrong, azMai.words)} of ${azMai.words} words. Same accept/retry decision on ${pct(sameDecision, pageReads)} of ${pageReads} page reads.

## Wait for the pupil

MAI works on the finished recording, so the pupil waits after reading. Upload plus transcription took ${q(0.5)} (median) and ${q(0.9)} (90th percentile). This was measured from this script's location, not from a school.

Per-recording detail, including both transcripts: recordings.csv (pupil data: keep inside FFT).
`;
  fs.writeFileSync(path.join(OUT, 'report.md'), report);
  console.log('\n' + report);
}

main().catch(e => { console.error(e.message); process.exit(1); });
