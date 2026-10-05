import { useEffect, useRef, useState } from 'react';
import { LEVELS, levelFor, totalPoints, type Level, type ReadingEvent } from '../lib/rewards';

/** Lightning-bolt emblem used inside the core. Original shape. */
const BOLT = 'M108 40 L70 108 L96 108 L86 160 L132 86 L104 86 Z';

/**
 * The Power Core: a ring of 20 cells that charge up as Power is earned towards the next level,
 * with the level number at the centre in that level's colour.
 */
export function Core({ level, progress, size = 200, charging = false }: { level: Level; progress: number; size?: number; charging?: boolean }) {
  const cells = 20, lit = Math.round(progress * cells);
  return (
    <svg className={'core' + (charging ? ' charging' : '')} width={size} height={size} viewBox="0 0 200 200" role="img"
      aria-label={`Level ${level.level}, ${level.name}, ${Math.round(progress * 100)}% charged to the next level`}
      style={{ ['--lv' as string]: level.color }}>
      <circle cx="100" cy="100" r="96" className="core-halo" />
      {Array.from({ length: cells }, (_, i) => (
        <path key={i} className={'core-cell' + (i < lit ? ' lit' : '')} style={{ animationDelay: `${i * 40}ms` }}
          d={cellPath(i, cells)} />
      ))}
      <circle cx="100" cy="100" r="62" className="core-inner" />
      <path d={BOLT} className="core-bolt" transform="translate(-1 -2) scale(.9) translate(11 11)" />
      <text x="100" y="118" textAnchor="middle" className="core-num">{level.level}</text>
    </svg>
  );
}

function cellPath(i: number, n: number) {
  const gap = 3, a0 = (i * 360) / n + gap / 2 - 90, a1 = ((i + 1) * 360) / n - gap / 2 - 90;
  const p = (a: number, r: number) => [100 + r * Math.cos((a * Math.PI) / 180), 100 + r * Math.sin((a * Math.PI) / 180)].map(v => v.toFixed(2)).join(' ');
  return `M${p(a0, 90)} A90 90 0 0 1 ${p(a1, 90)} L${p(a1, 70)} A70 70 0 0 0 ${p(a0, 70)} Z`;
}

/** Home-screen panel: the core, Power total, distance to next level, and the ladder of levels. */
export function PowerPanel({ events }: { events: ReadingEvent[] }) {
  const pts = totalPoints(events), lv = levelFor(pts);
  const [shown, setShown] = useState(pts);
  const prev = useRef(pts);
  // Count up when Power is added.
  useEffect(() => {
    const from = prev.current; prev.current = pts;
    if (from === pts) { setShown(pts); return; }
    const t0 = performance.now();
    let raf = 0;
    const step = (t: number) => { const k = Math.min(1, (t - t0) / 700); setShown(Math.round(from + (pts - from) * k)); if (k < 1) raf = requestAnimationFrame(step); };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [pts]);

  return (
    <div className="power-panel" style={{ ['--lv' as string]: lv.color }}>
      <Core level={lv} progress={lv.progress} size={170} charging />
      <div className="power-body">
        <span className="power-eyebrow">Level {lv.level}</span>
        <strong className="power-name">{lv.name}</strong>
        <span className="power-total"><span className="bolt" aria-hidden="true" />{shown} Power</span>
        <span className="power-next">{lv.next ? <>Charge <b>{lv.toNext}</b> more Power to reach <b>{lv.next.name}</b></> : 'Top level reached. You are a Power Reader!'}</span>
      </div>
      <LevelLadder current={lv.level} />
    </div>
  );
}

export function LevelLadder({ current }: { current: number }) {
  return (
    <ol className="ladder" aria-label="Levels">
      {LEVELS.map(l => (
        <li key={l.level} className={l.level < current ? 'past' : l.level === current ? 'now' : 'next'} style={{ ['--lv' as string]: l.color }}
          title={l.level > current ? `${l.name}: ${l.min} Power` : l.name}>
          <span className="rung">{l.level}</span>
          <span className="rung-name">{l.name}</span>
        </li>
      ))}
    </ol>
  );
}

/** Full-screen level-up moment. */
export function LevelUp({ level, onClose }: { level: Level | null; onClose: () => void }) {
  if (!level) return null;
  return (
    <div className="levelup" role="dialog" aria-label={`Level up: level ${level.level}, ${level.name}`} onClick={onClose} style={{ ['--lv' as string]: level.color }}>
      <div className="levelup-rays" aria-hidden="true" />
      <div className="levelup-body">
        <p className="levelup-kicker">Level up!</p>
        <Core level={level} progress={0} size={240} />
        <p className="levelup-name">Level {level.level}: {level.name}</p>
        <p className="levelup-sub">{level.level < LEVELS.length ? `Next: ${LEVELS[level.level].name} at ${LEVELS[level.level].min} Power` : 'You have reached the top level.'}</p>
        <button className="btn btn-orange btn-big" onClick={onClose}>Keep reading</button>
      </div>
    </div>
  );
}
