// Demo provider: pretends a reader read the text at about 95 words a minute with a few
// mistakes. For trying the app without a microphone or speech service.
// Results are clearly labelled as demo data.

import type { SpeechProvider } from './types';
import { tokenise } from '../text';

const RATE = 1.6; // words per second, about 95 a minute

export const demoProvider: SpeechProvider = {
  id: 'demo',
  label: 'Demo (no microphone)',
  demo: true,
  async available() { return true; },
  async start(referenceText, onWord, opts = {}) {
    const startedAt = Date.now();
    const ref = tokenise(referenceText);
    const timer = setInterval(() => onWord?.(Math.floor(((Date.now() - startedAt) / 1000) * RATE)), 500);
    return {
      async stop() {
        clearInterval(timer);
        const secs = (Date.now() - startedAt) / 1000;
        // Timed reads stop part way through. For a page, pretend it was read to the end
        // unless "Done" was pressed almost straight away (shows what a failed check looks like).
        const count = opts.kind === 'page'
          ? (secs >= Math.min(4, 1 + ref.length * 0.05) ? ref.length : Math.round(ref.length * Math.min(1, secs / 8)))
          : Math.min(ref.length, Math.round(secs * RATE));
        const words = [];
        for (let i = 0; i < count; i++) {
          if (ref.length > 12 && i % 23 === 11) continue;                 // skips a word now and then
          const misread = ref.length > 12 && i % 17 === 8;
          words.push({
            text: misread ? ref[i].norm.slice(0, Math.max(2, ref[i].norm.length - 2)) : ref[i].norm,
            startSec: i / RATE,
            accuracyScore: i % 31 === 5 ? 45 : 90,
          });
        }
        return {
          words, durationSec: opts.kind === 'page' ? Math.max(1, count / RATE) : undefined,
          provider: 'Demo data (not a real recording)', scores: { fluency: 72, prosody: 65, pronunciation: 84 },
        };
      },
    };
  },
};
