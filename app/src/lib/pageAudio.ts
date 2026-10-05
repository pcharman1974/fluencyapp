// Recorded model reading: plays a page's pre-generated audio and reports which word is being said.
// Falls back to the device voice (voice.ts) when a story has no recordings.

export interface AudioManifest {
  provider?: string;
  voice?: string;
  pages: Record<string, { file: string; words: { start: number; end: number }[] }>;
  words: Record<string, string>;
}

const cache = new Map<string, Promise<AudioManifest | null>>();

/** Loads <story>/audio/manifest.json once; null if the story has no recordings. */
export function loadManifest(storyBase: string): Promise<AudioManifest | null> {
  if (!cache.has(storyBase)) {
    cache.set(storyBase, fetch(storyBase + 'audio/manifest.json')
      .then(r => (r.ok ? r.json() : null))
      .catch(() => null));
  }
  return cache.get(storyBase)!;
}

let current: HTMLAudioElement | null = null;
let raf = 0;

export function stopAudio() {
  cancelAnimationFrame(raf);
  if (current) { current.pause(); current.src = ''; current = null; }
}

/** Index of the word being said at time t (seconds), or -1 before the first word. */
export function wordAt(words: { start: number; end: number }[], t: number): number {
  let lo = 0, hi = words.length - 1, ans = -1;
  while (lo <= hi) { const mid = (lo + hi) >> 1; if (words[mid].start <= t) { ans = mid; lo = mid + 1; } else hi = mid - 1; }
  return ans;
}

export function playPage(src: string, words: { start: number; end: number }[], opts: { rate?: number; onWord?: (i: number) => void; onEnd?: () => void } = {}) {
  stopAudio();
  const a = new Audio(src);
  current = a;
  a.playbackRate = opts.rate ?? 1;
  (a as HTMLAudioElement & { preservesPitch?: boolean }).preservesPitch = true;
  let last = -2;
  const tick = () => {
    const i = wordAt(words, a.currentTime);
    if (i !== last) { last = i; if (i >= 0) opts.onWord?.(i); }
    raf = requestAnimationFrame(tick);
  };
  a.onended = () => { cancelAnimationFrame(raf); current = null; opts.onEnd?.(); };
  a.onerror = () => { cancelAnimationFrame(raf); current = null; opts.onEnd?.(); };
  a.play().then(() => { raf = requestAnimationFrame(tick); }).catch(() => opts.onEnd?.());
}

export function playWord(src: string) {
  stopAudio();
  const a = new Audio(src); current = a;
  a.onended = () => { current = null; };
  a.play().catch(() => { /* ignore */ });
}
