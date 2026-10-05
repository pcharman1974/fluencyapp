// Recorded model reading: plays a page's pre-generated audio and reports which word is being said.
// Falls back to the device voice (voice.ts) when a story has no recordings.

export interface AudioManifest {
  provider?: string;
  voice?: string;
  pages: Record<string, { file: string; words: { start: number; end: number }[] }>;
  words: Record<string, string>;
}

const cache = new Map<string, Promise<AudioManifest | null>>();
/** Why the recordings list couldn't be loaded, for diagnosing devices that fall back to the device voice. */
export let manifestProblem = '';

/** Loads <story>/audio/manifest.json once (fresh, one retry); null if the story has no recordings. */
export function loadManifest(storyBase: string): Promise<AudioManifest | null> {
  if (!cache.has(storyBase)) {
    const get = () => fetch(storyBase + 'audio/manifest.json', { cache: 'no-store', credentials: 'same-origin' })
      .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json() as Promise<AudioManifest>; });
    cache.set(storyBase, get().catch(get).then(m => { manifestProblem = ''; return m; }).catch(e => { manifestProblem = String(e?.message ?? e); return null; }));
  }
  return cache.get(storyBase)!;
}

// Recordings are fetched like the story text (same credentials as the page) and played from memory.
// Some phones won't send the site password with an <audio> element's own request, so this avoids it.
const blobs = new Map<string, Promise<string | null>>();
const ready = new Map<string, string>();
/** Starts loading a recording so it's ready to play the moment Listen is pressed. */
export function preloadAudio(src: string): Promise<string | null> {
  if (!blobs.has(src)) {
    blobs.set(src, fetch(src, { credentials: 'same-origin' })
      .then(r => (r.ok ? r.blob() : null))
      .then(b => { if (!b) return null; const url = URL.createObjectURL(b); ready.set(src, url); return url; })
      .catch(() => null));
  }
  return blobs.get(src)!;
}

let current: HTMLAudioElement | null = null;
let raf = 0;

export function stopAudio() {
  cancelAnimationFrame(raf);
  // Detach handlers first, so a stop is never reported as the reading finishing.
  if (current) { current.onended = null; current.onerror = null; current.pause(); current.src = ''; current = null; }
}

/** Index of the word being said at time t (seconds), or -1 before the first word. */
export function wordAt(words: { start: number; end: number }[], t: number): number {
  let lo = 0, hi = words.length - 1, ans = -1;
  while (lo <= hi) { const mid = (lo + hi) >> 1; if (words[mid].start <= t) { ans = mid; lo = mid + 1; } else hi = mid - 1; }
  return ans;
}

export function playPage(src: string, words: { start: number; end: number }[], opts: { rate?: number; onWord?: (i: number) => void; onEnd?: () => void; onFail?: (why: string) => void } = {}) {
  stopAudio();
  const a = new Audio(ready.get(src) ?? src);
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
  // A recording that won't play is reported (so the device voice can step in), not treated as heard.
  let failed = false; // an error and a rejected play() can both fire: report once
  const fail = (why: string) => { if (failed) return; failed = true; cancelAnimationFrame(raf); if (current === a) current = null; (opts.onFail ?? opts.onEnd)?.(why); };
  a.onerror = () => fail(`media error ${a.error?.code ?? ''}`.trim());
  a.play().then(() => { raf = requestAnimationFrame(tick); }).catch(e => fail(`play() ${e?.name ?? 'rejected'}`));
}

export function playWord(src: string) {
  stopAudio();
  const a = new Audio(ready.get(src) ?? src); current = a;
  a.onended = () => { current = null; };
  a.play().catch(() => { /* ignore */ });
}
