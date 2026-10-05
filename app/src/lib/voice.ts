// Model reading with the device's built-in voice (no data leaves the device).

function pickVoice(): SpeechSynthesisVoice | undefined {
  const voices = speechSynthesis.getVoices();
  return voices.find(v => v.lang === 'en-GB' && /natural|enhanced|premium/i.test(v.name))
    ?? voices.find(v => v.lang === 'en-GB') ?? voices.find(v => v.lang.startsWith('en'));
}

export const canSpeak = () => typeof window !== 'undefined' && 'speechSynthesis' in window;

export function speak(text: string, opts: { rate?: number; onWord?: (charIndex: number) => void; onEnd?: () => void } = {}) {
  if (!canSpeak()) return;
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  const v = pickVoice(); if (v) u.voice = v;
  u.lang = 'en-GB';
  u.rate = opts.rate ?? 0.9;
  u.onboundary = e => { if (e.name === 'word') opts.onWord?.(e.charIndex); };
  u.onend = () => opts.onEnd?.();
  speechSynthesis.speak(u);
}

export const stopSpeaking = () => { if (canSpeak()) speechSynthesis.cancel(); };
