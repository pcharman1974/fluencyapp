// "Did they read it?" Checks a page read aloud against the page text.
import { alignHeard, scoreReading, type Alignment } from './scoring';
import { tokenise } from './text';
import type { SpeechResult } from './speech';
import type { CheckDetail } from './rewards';

// Starting thresholds for the prototype. To be tuned against adult judgements in trials.
export const MIN_COVERAGE = 0.8;  // share of the page's words heard, in order
export const MIN_WPM = 20;        // slower than this suggests long silences or something else going on
export const MAX_WPM = 250;       // faster than this suggests skimming, not reading aloud

export interface PageCheck {
  verified: boolean;
  coverage: number;   // 0..1
  accuracy: number;   // correct / attempted
  wpm: number;
  wcpm: number;
  words: number;      // words on the page
  durationSec: number;
  misread: string[];  // words read wrongly or skipped, for warm-ups
  message: string;
  /** Running record: every word of the text, marked as read, plus where extra words came. */
  record: RecordMark[];
}

/** One mark in a running record. 'sub' = said something else (said), 'omit' = missed out, 'unread' = not reached, 'ins' = extra word added. */
export type RecordMark =
  | { kind: 'ok' | 'omit' | 'unread'; word: string }
  | { kind: 'sub'; word: string; said: string }
  | { kind: 'ins'; said: string };

/** Builds the running record from an alignment: words in order, with insertions where they came. */
export function runningRecord(ref: { index: number; display: string }[], a: Alignment): RecordMark[] {
  const byIndex = new Map(a.words.map(w => [w.refIndex, w]));
  const out: RecordMark[] = [];
  for (const t of ref) {
    for (const x of a.inserted) if (x.at === t.index) out.push({ kind: 'ins', said: x.text });
    const w = byIndex.get(t.index);
    if (t.index > a.lastWordIndex) out.push({ kind: 'unread', word: t.display });
    else if (!w || w.status === 'skipped') out.push({ kind: 'omit', word: t.display });
    else if (w.status === 'misread') out.push({ kind: 'sub', word: t.display, said: w.heard ?? '' });
    else out.push({ kind: 'ok', word: t.display });
  }
  return out;
}

export function checkPage(text: string, result: SpeechResult, elapsedSec: number): PageCheck {
  const ref = tokenise(text);
  const a = alignHeard(ref, result.words);
  const attempted = a.words.filter(w => w.status !== 'skipped').length;
  const correct = a.words.filter(w => w.status === 'correct').length;
  const duration = Math.max(1, result.durationSec ?? elapsedSec);
  const coverage = ref.length ? attempted / ref.length : 0;
  const wpm = Math.round(attempted / (duration / 60));
  const errors = a.words.filter(w => w.status !== 'correct').map(w => w.refIndex);
  const wcpm = scoreReading(a.lastWordIndex, errors, duration).wcpm;
  const misread = [...new Set(a.words.filter(w => w.status !== 'correct').map(w => ref[w.refIndex].display.replace(/[^\p{L}\p{N}'’-]/gu, '')))].filter(Boolean);

  let message = 'Page checked. Well read!';
  let verified = true;
  if (coverage < MIN_COVERAGE) {
    verified = false;
    message = attempted === 0
      ? "We didn't hear any reading. Check the microphone and read the page aloud."
      : `We heard about ${Math.round(coverage * 100)}% of the page. Read the whole page aloud to earn your points.`;
  } else if (wpm > MAX_WPM) {
    verified = false; message = 'That was too fast to be reading aloud. Read it at your normal pace.';
  } else if (wpm < MIN_WPM) {
    verified = false; message = 'There were long gaps in the reading. Try the page again.';
  }
  return { verified, coverage, accuracy: attempted ? correct / attempted : 0, wpm, wcpm, words: ref.length, durationSec: duration, misread, message, record: runningRecord(ref, a) };
}

/** The fields of a page check that are saved with each read, for checking later. */
export function checkDetail(c: PageCheck, checkedBy = 'unknown'): CheckDetail {
  return { coverage: c.coverage, accuracy: c.accuracy, words: c.words, durationSec: c.durationSec, wpm: c.wpm, wcpm: c.wcpm,
    misread: c.misread, message: c.message, checkedBy };
}
