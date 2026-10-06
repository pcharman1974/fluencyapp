// A small speaker button that reads an instruction aloud, so pupils who find reading hard don't have to
// read the instructions too. Fixed lines are recorded in the story voice (content/instructions); anything
// else uses the device's own voice.
import { useEffect, useRef, useState } from 'react';
import phrases from '../../../content/instructions/phrases.json';
import { speak, stopSpeaking } from '../lib/voice';
import { stopAudio } from '../lib/pageAudio';

export type PhraseId = keyof typeof phrases;
export const phrase = (id: PhraseId) => phrases[id];

let playing: HTMLAudioElement | null = null;

export function SayIt({ id, text, label }: { id?: PhraseId; text?: string; label?: string }) {
  const [on, setOn] = useState(false);
  const mine = useRef<HTMLAudioElement | null>(null);
  const words = text ?? (id ? phrases[id] : '');
  useEffect(() => () => { if (mine.current && playing === mine.current) { playing.pause(); playing = null; } }, []);
  if (!words) return null;
  const done = () => setOn(false);
  const play = () => {
    stopAudio(); stopSpeaking(); playing?.pause();
    if (on) { setOn(false); return; }
    setOn(true);
    const device = () => speak(words, { rate: 0.95, onEnd: done });
    if (!id) { device(); return; }
    const a = new Audio(`instructions/${id}.mp3`);
    mine.current = a; playing = a;
    a.onended = done;
    a.onerror = () => { if (playing === a) device(); };
    a.play().catch(() => device());
  };
  return (
    <button type="button" className={'say-it' + (on ? ' on' : '')} onClick={play} aria-label={label ?? `Hear this: ${words}`} title="Hear this">
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9h4l5-4v14l-5-4H4z" /><path d="M16 8.5a5 5 0 0 1 0 7M18.5 6a8.5 8.5 0 0 1 0 12" fill="none" /></svg>
    </button>
  );
}
