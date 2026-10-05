// Demo provider: pretends a reader read the passage at about 95 words a minute with a few
// mistakes. For trying the app and testing without a microphone or speech service.
// Results are clearly labelled as demo data.

import type { SpeechProvider } from './types';
import { tokenise } from '../text';

export const demoProvider: SpeechProvider = {
  id: 'demo',
  label: 'Demo (no microphone)',
  async available() { return true; },
  async start(referenceText, onWord) {
    const startedAt = Date.now();
    const ref = tokenise(referenceText);
    const timer = setInterval(() => onWord?.(Math.floor(((Date.now() - startedAt) / 1000) * 1.6)), 500);
    return {
      async stop() {
        clearInterval(timer);
        const secs = (Date.now() - startedAt) / 1000;
        const count = Math.min(ref.length, Math.round(secs * 1.6));
        const words = [];
        for (let i = 0; i < count; i++) {
          if (i % 23 === 11) continue;                                   // skips a word now and then
          const misread = i % 17 === 8;
          words.push({
            text: misread ? ref[i].norm.slice(0, Math.max(2, ref[i].norm.length - 2)) : ref[i].norm,
            startSec: i / 1.6,
            accuracyScore: i % 31 === 5 ? 45 : 90,
          });
        }
        return { words, provider: 'Demo data (not a real recording)', scores: { fluency: 72, prosody: 65, pronunciation: 84 } };
      },
    };
  },
};
