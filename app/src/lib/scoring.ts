// Words correct per minute (WCPM) and accuracy.
//
// Standard oral reading fluency rules:
//  - words read = every word from the start up to the last word the reader reached
//  - errors = words in that range that were misread, skipped, or supplied by the adult
//  - insertions (extra words) and self-corrections are NOT errors
//  - WCPM = (words read - errors) / minutes

import { normalise, type Token } from './text';
import { mergeSpoken } from './spoken';

export interface FluencyResult {
  seconds: number;
  wordsRead: number;
  errors: number;
  wordsCorrect: number;
  wcpm: number;
  accuracy: number; // 0..1
}

export function scoreReading(lastWordIndex: number, errorIndexes: Iterable<number>, seconds: number): FluencyResult {
  const wordsRead = Math.max(0, lastWordIndex + 1);
  const errors = [...new Set(errorIndexes)].filter(i => i >= 0 && i <= lastWordIndex).length;
  const wordsCorrect = wordsRead - errors;
  const wcpm = seconds > 0 ? Math.round((wordsCorrect * 60) / seconds) : 0;
  const accuracy = wordsRead > 0 ? wordsCorrect / wordsRead : 0;
  return { seconds, wordsRead, errors, wordsCorrect, wcpm, accuracy };
}

// ---------- Matching what was heard against the text ----------

export type WordStatus = 'correct' | 'misread' | 'skipped';

export interface HeardWord {
  text: string;
  startSec?: number;
  /** 0-100 pronunciation confidence from the speech service, if it gives one */
  accuracyScore?: number;
}

export interface AlignedWord {
  refIndex: number;
  status: WordStatus;
  heard?: string;
  /** speech service thinks the word was said but unclearly; for the adult to check, not counted */
  check?: boolean;
  startSec?: number;
}

export interface Alignment {
  words: AlignedWord[];   // one per reference word, up to lastWordIndex
  lastWordIndex: number;  // -1 if nothing recognised
  insertions: string[];
  /** Each extra word and where it came: before reference word `at` (its index). For running records. */
  inserted: { at: number; text: string }[];
}

// Costs: a misreading that looks like the target (england's -> english) is cheaper than one
// that doesn't, so ties are resolved towards the word the reader was actually attempting.
const GAP = 2, SUB_SIMILAR = 2, SUB_OTHER = 3;

function subCost(a: string, b: string): number {
  if (a === b) return 0;
  const shared = a.length >= 2 && b.length >= 2 && a.slice(0, 2) === b.slice(0, 2);
  return shared ? SUB_SIMILAR : SUB_OTHER;
}

/** Word-level edit-distance alignment of heard words against the reference text. */
export function alignHeard(ref: Token[], heard: HeardWord[], opts: { checkBelow?: number } = {}): Alignment {
  const checkBelow = opts.checkBelow ?? 60;
  // Spoken numbers and hyphenated words ("nineteen sixties", "modern day") become the printed word first.
  const h = mergeSpoken(ref, heard).map(w => ({ ...w, norm: normalise(w.text) })).filter(w => w.norm);
  const n = ref.length, m = h.length;
  // cost[i][j] = cost of aligning ref[0..i) with heard[0..j)
  const cost: Uint32Array[] = Array.from({ length: n + 1 }, () => new Uint32Array(m + 1));
  for (let i = 1; i <= n; i++) cost[i][0] = i * GAP;
  for (let j = 1; j <= m; j++) cost[0][j] = j * GAP;
  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      cost[i][j] = Math.min(
        cost[i - 1][j - 1] + subCost(ref[i - 1].norm, h[j - 1].norm),
        cost[i - 1][j] + GAP, // skipped reference word
        cost[i][j - 1] + GAP, // extra heard word
      );
    }
  }
  // Reading stops part way through the text: don't charge for the unread tail.
  // Choose the end point i where the alignment of all heard words is cheapest.
  let bestI = 0;
  for (let i = 0; i <= n; i++) if (cost[i][m] < cost[bestI][m]) bestI = i;

  const words: AlignedWord[] = [];
  const insertions: string[] = [];
  const inserted: { at: number; text: string }[] = [];
  let i = bestI, j = m;
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0) {
      const same = ref[i - 1].norm === h[j - 1].norm;
      if (cost[i][j] === cost[i - 1][j - 1] + subCost(ref[i - 1].norm, h[j - 1].norm)) {
        const hw = h[j - 1];
        words.push({
          refIndex: ref[i - 1].index,
          status: same ? 'correct' : 'misread',
          heard: hw.text,
          check: same && hw.accuracyScore !== undefined && hw.accuracyScore < checkBelow,
          startSec: hw.startSec,
        });
        i--; j--; continue;
      }
    }
    if (i > 0 && cost[i][j] === cost[i - 1][j] + GAP) {
      words.push({ refIndex: ref[i - 1].index, status: 'skipped' });
      i--; continue;
    }
    insertions.push(h[j - 1].text);
    inserted.push({ at: i < n ? ref[i].index : (ref.at(-1)?.index ?? -1) + 1, text: h[j - 1].text });
    j--;
  }
  words.reverse(); insertions.reverse(); inserted.reverse();
  // Last word reached = last reference word that was actually voiced.
  let last = -1;
  for (const w of words) if (w.status !== 'skipped') last = w.refIndex;
  // Extra words after the last word reached are just chatter at the end, not insertions.
  return { words: words.filter(w => w.refIndex <= last), lastWordIndex: last, insertions, inserted: inserted.filter(x => x.at <= last) };
}

export function errorsFromAlignment(a: Alignment): number[] {
  return a.words.filter(w => w.status !== 'correct').map(w => w.refIndex);
}
