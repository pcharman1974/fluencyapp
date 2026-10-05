// Turning a speech service's timing data into one start/end time per word of the page.
// Words are the page text split on spaces, the same way the app splits it for highlighting.

/** Character index where each space-separated word starts. */
export function wordStarts(text) {
  const out = []; const re = /\S+/g; let m;
  while ((m = re.exec(text))) out.push({ start: m.index, end: m.index + m[0].length });
  return out;
}

/**
 * ElevenLabs "with-timestamps": one time per character of the text sent.
 * @param {string} text the exact text sent
 * @param {{characters: string[], character_start_times_seconds: number[], character_end_times_seconds: number[]}} alignment
 * @returns {{start: number, end: number}[]} seconds, one per word
 */
export function fromCharacterTimes(text, alignment) {
  const chars = alignment.characters, starts = alignment.character_start_times_seconds, ends = alignment.character_end_times_seconds;
  // Find runs of non-space characters in the alignment, in order: one run per word.
  const runs = [];
  let cur = null;
  for (let i = 0; i < chars.length; i++) {
    if (/\s/.test(chars[i])) { if (cur) { runs.push(cur); cur = null; } continue; }
    if (!cur) cur = { start: starts[i], end: ends[i] };
    else cur.end = ends[i];
  }
  if (cur) runs.push(cur);
  const words = wordStarts(text);
  if (runs.length !== words.length) throw new Error(`Timing has ${runs.length} words but the text has ${words.length}`);
  return runs.map(r => ({ start: round(r.start), end: round(r.end) }));
}

/**
 * Azure word-boundary events: text offset (characters) and audio offset/duration (seconds).
 * Punctuation boundaries are ignored; each boundary is mapped to the word it falls in.
 * @param {string} text
 * @param {{textOffset: number, start: number, duration: number}[]} boundaries
 */
export function fromWordBoundaries(text, boundaries) {
  const words = wordStarts(text);
  const times = words.map(() => null);
  for (const b of boundaries) {
    const i = words.findIndex(w => b.textOffset >= w.start && b.textOffset < w.end);
    if (i < 0) continue;
    if (!times[i]) times[i] = { start: b.start, end: b.start + b.duration };
    else times[i].end = Math.max(times[i].end, b.start + b.duration);
  }
  // A word the service skipped (rare) takes the gap between its neighbours.
  for (let i = 0; i < times.length; i++) {
    if (times[i]) continue;
    const prev = times[i - 1]?.end ?? 0;
    const next = times.slice(i + 1).find(Boolean)?.start ?? prev;
    times[i] = { start: prev, end: next };
  }
  return times.map(t => ({ start: round(t.start), end: round(t.end) }));
}

const round = n => Math.round(n * 1000) / 1000;

/**
 * When a word is said differently from how it is printed ("4m" said as "4 metres"), the text sent
 * to the voice has more words than the page. Group the spoken word times back onto page words.
 * @param {{start:number,end:number}[]} spokenTimes one per spoken word
 * @param {number[]} counts spoken words for each page word
 */
export function groupToPageWords(spokenTimes, counts) {
  const out = []; let k = 0;
  for (const n of counts) {
    const part = spokenTimes.slice(k, k + n); k += n;
    out.push({ start: part[0].start, end: part.at(-1).end });
  }
  if (k !== spokenTimes.length) throw new Error('Spoken words do not line up with page words');
  return out;
}

/** Page text -> text to speak, plus how many spoken words each page word became. */
export function spokenVersion(text, replacements = {}) {
  const words = text.split(/\s+/).filter(Boolean);
  const spoken = words.map(w => {
    for (const [from, to] of Object.entries(replacements)) if (w.includes(from)) return w.replace(from, to);
    return w;
  });
  return { text: spoken.join(' '), counts: spoken.map(s => s.split(/\s+/).length) };
}
