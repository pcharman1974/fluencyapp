// Speech services write down what they hear: "nineteen sixties", "eleven thousand", "modern day".
// Printed text says 1960s, 11,000, modern-day. Before marking, runs of heard words that are a spoken
// form of a printed number or hyphenated word are merged back into that printed word, so a pupil who
// reads them correctly is marked correct.
import { normalise, type Token } from './text';
import type { HeardWord } from './scoring';

const ONES = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve',
  'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen'];
const TENS = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];

const under100 = (n: number): string => (n < 20 ? ONES[n] : TENS[Math.floor(n / 10)] + (n % 10 ? ' ' + ONES[n % 10] : ''));
const withRest = (head: string, rest: number, restForms: (n: number) => string[]): string[] =>
  rest === 0 ? [head] : restForms(rest).flatMap(r => (rest < 100 ? [`${head} and ${r}`, `${head} ${r}`] : [`${head} ${r}`, `${head} and ${r}`]));

/** Ways of saying a whole number (up to 999,999), British and American. */
export function sayNumber(n: number): string[] {
  if (!Number.isInteger(n) || n < 0 || n >= 1e6) return [];
  if (n < 100) return [under100(n)];
  const forms = new Set<string>();
  if (n < 1000) {
    for (const f of withRest(`${ONES[Math.floor(n / 100)]} hundred`, n % 100, x => [under100(x)])) forms.add(f);
    if (Math.floor(n / 100) === 1) for (const f of withRest('a hundred', n % 100, x => [under100(x)])) forms.add(f);
  } else {
    const th = Math.floor(n / 1000), rest = n % 1000;
    for (const t of sayNumber(th)) for (const f of withRest(`${t} thousand`, rest, sayNumber)) forms.add(f);
    // 1500 -> "fifteen hundred"; years: 1996 -> "nineteen ninety six", 1906 -> "nineteen oh six"
    if (n < 10000) {
      const hi = Math.floor(n / 100), lo = n % 100;
      if (hi % 10 !== 0) {
        if (lo === 0) forms.add(`${under100(hi)} hundred`);
        else forms.add(`${under100(hi)} ${lo < 10 ? 'oh ' + ONES[lo] : under100(lo)}`);
        if (lo !== 0) for (const f of withRest(`${under100(hi)} hundred`, lo, x => [under100(x)])) forms.add(f);
      }
    }
  }
  return [...forms];
}

/** "sixty" -> "sixties", "seven" -> "sevens": for decades like 1960s. */
const plural = (w: string) => (w.endsWith('y') ? w.slice(0, -1) + 'ies' : w + 's');

/** Spoken forms of one printed token, as word lists; empty if it's an ordinary word. */
export function spokenForms(display: string): string[][] {
  const norm = normalise(display);
  const m = norm.match(/^(\d+)(s|m)?$/);
  if (m) {
    const n = Number(m[1]), base = sayNumber(n);
    if (m[2] === 's') return base.map(f => { const w = f.split(' '); w[w.length - 1] = plural(w[w.length - 1]); return w; });
    if (m[2] === 'm') return base.flatMap(f => ['metres', 'meters', 'metre', 'meter', 'm'].map(u => [...f.split(' '), u]));
    return base.map(f => f.split(' ')).filter(w => w.length > 1); // a single spoken word (e.g. "forty") matches as itself below
  }
  if (norm.includes('-')) return [norm.split('-').filter(Boolean)];
  return [];
}

/** Single words that stand for a printed number token ("forty" for 40). */
function singleWordNumber(display: string): string | undefined {
  const m = normalise(display).match(/^(\d+)$/);
  if (!m) return undefined;
  const one = sayNumber(Number(m[1])).find(f => !f.includes(' '));
  return one;
}

/**
 * Merges runs of heard words that spell out a printed number or hyphenated word in the text into that
 * printed word. Heard words with hyphens are split first, so "modern-day" and "modern day" match alike.
 */
export function mergeSpoken(ref: Token[], heard: HeardWord[]): HeardWord[] {
  const split: HeardWord[] = heard.flatMap(w => {
    const parts = w.text.split('-').filter(Boolean);
    return parts.length > 1 ? parts.map((p, i) => ({ ...w, text: p, startSec: i ? undefined : w.startSec })) : [w];
  });
  const byFirst = new Map<string, { seq: string[]; text: string }[]>();
  const singles = new Map<string, string>();
  for (const t of ref) {
    for (const seq of spokenForms(t.display)) {
      const list = byFirst.get(seq[0]) ?? [];
      list.push({ seq, text: t.norm });
      byFirst.set(seq[0], list);
    }
    const one = singleWordNumber(t.display);
    if (one) singles.set(one, t.norm);
  }
  if (!byFirst.size && !singles.size) return heard;
  const norms = split.map(w => normalise(w.text));
  const out: HeardWord[] = [];
  for (let j = 0; j < split.length; ) {
    let best: { len: number; text: string } | undefined;
    for (const c of byFirst.get(norms[j]) ?? []) {
      if (c.seq.length > (best?.len ?? 0) && c.seq.every((s, k) => norms[j + k] === s)) best = { len: c.seq.length, text: c.text };
    }
    if (best) {
      const run = split.slice(j, j + best.len);
      const scores = run.map(w => w.accuracyScore).filter((x): x is number => x !== undefined);
      out.push({ text: best.text, startSec: run[0].startSec, accuracyScore: scores.length ? Math.min(...scores) : undefined });
      j += best.len;
    } else if (singles.has(norms[j])) {
      out.push({ ...split[j], text: singles.get(norms[j])! });
      j++;
    } else {
      out.push(split[j]);
      j++;
    }
  }
  return out;
}
