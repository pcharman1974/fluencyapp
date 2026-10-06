// Celebrations: a confetti burst for big moments (today's bar filled, a new badge, a level up) and a small
// pop for each accepted page. Sound is off by default and only plays if the pupil turned it on.
// Pupils who ask their device for reduced motion get a gentle glow instead of flying confetti.
import { useEffect, useState } from 'react';
import { soundOn } from '../lib/profile';

type Kind = 'big' | 'small';
const EVENT = 'btc-celebrate';
export const celebrate = (kind: Kind) => window.dispatchEvent(new CustomEvent(EVENT, { detail: kind }));

const COLOURS = ['#F28C28', '#0C5076', '#E8B33A', '#1D6FB0', '#C2463A', '#7A5BC0', '#2F6B3A'];

let ctx: AudioContext | null = null;
/** A short rising chime made in the browser (no sound files). */
export function chime(kind: Kind) {
  try {
    ctx ??= new AudioContext();
    const notes = kind === 'big' ? [523, 659, 784, 1047] : [784, 1047];
    notes.forEach((f, i) => {
      const o = ctx!.createOscillator(), g = ctx!.createGain(), t = ctx!.currentTime + i * 0.09;
      o.type = 'triangle'; o.frequency.value = f;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.18, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.35);
      o.connect(g).connect(ctx!.destination); o.start(t); o.stop(t + 0.4);
    });
  } catch { /* no audio on this device */ }
}

interface Burst { id: number; kind: Kind }

export function Celebrations() {
  const [bursts, setBursts] = useState<Burst[]>([]);
  useEffect(() => {
    const on = (e: Event) => {
      const kind = (e as CustomEvent<Kind>).detail;
      const id = Date.now() + Math.random();
      setBursts(b => [...b, { id, kind }]);
      if (soundOn()) chime(kind);
      setTimeout(() => setBursts(b => b.filter(x => x.id !== id)), kind === 'big' ? 2600 : 1000);
    };
    window.addEventListener(EVENT, on);
    return () => window.removeEventListener(EVENT, on);
  }, []);
  return <>{bursts.map(b => (b.kind === 'big' ? <Confetti key={b.id} /> : <Pop key={b.id} />))}</>;
}

function Confetti() {
  // Fixed pieces per burst, worked out once.
  const [pieces] = useState(() => Array.from({ length: 70 }, (_, i) => ({
    left: Math.random() * 100, delay: Math.random() * 0.4, dur: 1.6 + Math.random() * 0.9,
    drift: (Math.random() - 0.5) * 160, spin: (Math.random() - 0.5) * 900, colour: COLOURS[i % COLOURS.length],
    w: 7 + Math.random() * 6, round: Math.random() < 0.3,
  })));
  return (
    <div className="confetti" aria-hidden="true">
      <div className="celebrate-glow" />
      {pieces.map((p, i) => (
        <span key={i} className="confetti-piece" style={{
          left: `${p.left}%`, width: p.w, height: p.round ? p.w : p.w * 1.6, background: p.colour, borderRadius: p.round ? '50%' : 2,
          animationDelay: `${p.delay}s`, animationDuration: `${p.dur}s`,
          ['--drift' as string]: `${p.drift}px`, ['--spin' as string]: `${p.spin}deg`,
        }} />
      ))}
    </div>
  );
}

function Pop() {
  return <div className="pop" aria-hidden="true"><span>✓</span></div>;
}
