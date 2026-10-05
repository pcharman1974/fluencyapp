// Progress over time: reading speed (WCPM) and Power. Shared by the pupil's progress page and the
// teacher's pupil detail. Two separate charts because they are measured on different scales.
import { useLayoutEffect, useRef, useState } from 'react';
import type { ReadingEvent } from '../lib/rewards';
import { LEVELS, levelFor, weekKey } from '../lib/rewards';
import { fluencyByDay, fluencySummary, levelLines, powerByDay, type FluencyDay, type PowerDay } from '../lib/progress';

export type Audience = 'pupil' | 'teacher';

// Validated together for colour-blind separation and contrast on white (dataviz validator, light mode).
const C = { timed: '#1D6FB0', reread: '#E06A1E', page: '#7A5BC0', power: '#0C5076' };

const H = 240, PAD = { l: 40, r: 56, t: 16, b: 30 };
const dateLabel = (day: string, long = false) =>
  new Date(day + 'T12:00:00').toLocaleDateString('en-GB', long ? { weekday: 'short', day: 'numeric', month: 'short' } : { day: 'numeric', month: 'short' });
const ms = (day: string) => new Date(day + 'T12:00:00').getTime();

function useWidth() {
  const ref = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(600);
  useLayoutEffect(() => {
    const el = ref.current; if (!el) return;
    setW(el.clientWidth);
    const ro = new ResizeObserver(() => setW(el.clientWidth));
    ro.observe(el); return () => ro.disconnect();
  }, []);
  return [ref, w] as const;
}

/** Clean axis: the smallest round top (with 3 to 5 steps of 1, 2, 2.5 or 5 x 10^n) that fits `v`. */
function niceMax(v: number) {
  let bestMax = Infinity, bestStep = 1;
  const mag0 = 10 ** Math.floor(Math.log10(Math.max(1, v) / 5));
  for (const mag of [mag0, mag0 * 10]) for (const m of [1, 2, 2.5, 5]) for (const n of [3, 4, 5]) {
    const step = m * mag, max = step * n;
    if (max >= v && max < bestMax) { bestMax = max; bestStep = step; }
  }
  return { max: bestMax, step: bestStep };
}

/** A time x-scale over the given days, with a few readable date ticks. */
function timeScale(days: string[], width: number) {
  const a = ms(days[0]), b = ms(days.at(-1)!), span = Math.max(b - a, 864e5);
  const left = PAD.l + 12, right = width - PAD.r - 12;
  const x = (day: string) => days.length === 1 ? (left + right) / 2 : left + ((ms(day) - a) / span) * (right - left);
  const n = Math.max(2, Math.min(6, Math.floor((right - left) / 90)));
  const ticks = [...new Set(Array.from({ length: n }, (_, i) => {
    const d = new Date(a + (span * i) / (n - 1));
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }))];
  return { x, ticks: days.length === 1 ? [days[0]] : ticks };
}

/** Index of the day nearest the pointer, for the crosshair. */
function useCrosshair(xs: number[]) {
  const [i, setI] = useState<number | null>(null);
  const onMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const box = e.currentTarget.getBoundingClientRect(), px = e.clientX - box.left;
    let best = 0; xs.forEach((x, k) => { if (Math.abs(x - px) < Math.abs(xs[best] - px)) best = k; });
    setI(best);
  };
  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowRight') { setI(v => Math.min(xs.length - 1, (v ?? -1) + 1)); e.preventDefault(); }
    if (e.key === 'ArrowLeft') { setI(v => Math.max(0, (v ?? xs.length) - 1)); e.preventDefault(); }
    if (e.key === 'Escape') setI(null);
  };
  return { i, setI, handlers: { onPointerMove: onMove, onPointerLeave: () => setI(null), onKeyDown: onKey, onBlur: () => setI(null), tabIndex: 0 } };
}

function Tip({ x, width, children }: { x: number; width: number; children: React.ReactNode }) {
  const right = x > width * 0.6;
  return <div className="pc-tip" style={right ? { right: width - x + 12 } : { left: x + 12 }}>{children}</div>;
}

function Stat({ label, value, note, up }: { label: string; value: React.ReactNode; note?: string; up?: boolean }) {
  return (
    <div className="pc-stat">
      <span className="pc-stat-label">{label}</span>
      <b className="pc-stat-value">{value}</b>
      {note && <span className={'pc-stat-note' + (up === true ? ' up' : up === false ? ' down' : '')}>{note}</span>}
    </div>
  );
}

const signed = (d: number) => (d > 0 ? `▲ ${d}` : d < 0 ? `▼ ${-d}` : 'no change');

// ---------- Reading speed ----------

export function FluencyChart({ events, storyId, audience }: { events: ReadingEvent[]; storyId?: string; audience: Audience }) {
  const days = fluencyByDay(events, storyId);
  const s = fluencySummary(days);
  const [table, setTable] = useState(false);
  const pupil = audience === 'pupil';
  const names = {
    timed: 'Timed reads',
    reread: pupil ? 'Beat-your-best re-reads' : 'Re-reads (beat your best)',
    page: pupil ? 'Page reads (average that day)' : 'Page reads (daily average)',
  };

  return (
    <div className="pc">
      <div className="pc-stats">
        <Stat label={pupil ? 'Latest timed read' : 'Latest timed read (WCPM)'} value={s.latestTimed ?? '–'}
          note={s.firstTimed !== undefined && s.latestTimed !== undefined && s.bestTimed !== undefined && days.filter(d => d.timed !== undefined).length > 1
            ? `${signed(s.latestTimed - s.firstTimed)} since ${pupil ? 'your' : 'the'} first` : pupil ? 'Do a timed read to start' : 'No timed reads yet'}
          up={s.firstTimed !== undefined && s.latestTimed !== undefined && days.filter(d => d.timed !== undefined).length > 1 ? s.latestTimed > s.firstTimed : undefined} />
        <Stat label={pupil ? 'Your best re-read' : 'Best re-read (WCPM)'} value={s.bestReread ?? '–'}
          note={s.bestReread !== undefined ? (pupil ? 'Practised pages go faster' : 'Practised page, so higher than cold reads') : pupil ? 'Re-read a page to set one' : 'No re-reads yet'} />
        <Stat label={pupil ? 'Page reads' : 'Page reads, first vs latest week'} value={s.pageChange ? <>{s.pageChange.from} → {s.pageChange.to}</> : '–'}
          note={s.pageChange ? signed(s.pageChange.to - s.pageChange.from) : pupil ? 'Keep reading to see a change' : 'Needs 2+ weeks of page reads'}
          up={s.pageChange ? s.pageChange.to > s.pageChange.from : undefined} />
      </div>

      {days.length === 0 ? <p className="hint">{pupil ? 'Read a page aloud to start your graph.' : 'No checked reading yet.'}</p> : <>
        <ul className="pc-legend" aria-label="Key">
          <li><svg width="22" height="10" aria-hidden="true"><line x1="1" y1="5" x2="21" y2="5" stroke={C.timed} strokeWidth="2.5" strokeLinecap="round" /></svg>{names.timed}</li>
          <li><svg width="22" height="10" aria-hidden="true"><line x1="1" y1="5" x2="21" y2="5" stroke={C.page} strokeWidth="2.5" strokeLinecap="round" /></svg>{names.page}</li>
          <li><svg width="12" height="12" aria-hidden="true"><circle cx="6" cy="6" r="5" fill={C.reread} /></svg>{names.reread}</li>
        </ul>
        {table ? <FluencyTable days={days} names={names} /> : <FluencyPlot days={days} names={names} />}
        <div className="pc-foot">
          <p className="hint">{pupil
            ? 'Words correct per minute: how many words you read correctly in one minute. Higher is better, and practising a page makes it go up.'
            : 'WCPM = words read correctly per minute. Timed reads are the fairest measure over time. Page reads are first reads of new pages; re-reads are practised pages, so they run higher.'}</p>
          <button className="link" onClick={() => setTable(!table)}>{table ? 'Show as graph' : 'Show as table'}</button>
        </div>
      </>}
    </div>
  );
}

function FluencyPlot({ days, names }: { days: FluencyDay[]; names: Record<'timed' | 'reread' | 'page', string> }) {
  const [ref, width] = useWidth();
  const values = days.flatMap(d => [d.timed, d.reread, d.pageAvg].filter((v): v is number => v !== undefined));
  const { max, step } = niceMax(Math.max(...values) * 1.1);
  const { x, ticks } = timeScale(days.map(d => d.day), width);
  const y = (v: number) => PAD.t + (H - PAD.t - PAD.b) * (1 - v / max);
  const xs = days.map(d => x(d.day));
  const { i, handlers } = useCrosshair(xs);
  const line = (key: 'timed' | 'pageAvg') => days.filter(d => d[key] !== undefined).map((d, k) => `${k ? 'L' : 'M'}${x(d.day)},${y(d[key]!)}`).join(' ');

  // Selective labels: the latest timed read at its end, and the best result overall.
  const timedDays = days.filter(d => d.timed !== undefined);
  const lastTimed = timedDays.at(-1);
  let best: { day: string; v: number } | undefined;
  for (const d of days) for (const v of [d.timed, d.reread, d.pageAvg]) if (v !== undefined && (!best || v > best.v)) best = { day: d.day, v };
  // Hide the best label only if its box would actually overlap the end label.
  const showBest = best && !(lastTimed && (best.day === lastTimed.day && best.v === lastTimed.timed
    || (x(best.day) + 34 > x(lastTimed.day) + 8 && Math.abs((y(best.v) - 12) - (y(lastTimed.timed!) + 4)) < 14)));
  const hov = i !== null ? days[i] : null;

  return (
    <div className="pc-plot" ref={ref}>
      <svg width={width} height={H} role="img" {...handlers}
        aria-label={`Reading speed in words correct per minute on ${days.length} days. ${lastTimed ? `Latest timed read ${lastTimed.timed}.` : ''} ${best ? `Best ${best.v}.` : ''} Use the table view for every value.`}>
        {Array.from({ length: max / step + 1 }, (_, k) => k * step).map(v => (
          <g key={v}>
            <line x1={PAD.l} x2={width - PAD.r} y1={y(v)} y2={y(v)} className={v === 0 ? 'pc-base' : 'pc-grid'} />
            <text x={PAD.l - 8} y={y(v) + 4} textAnchor="end" className="pc-axis">{v}</text>
          </g>
        ))}
        {ticks.map(t => <text key={t} x={x(t)} y={H - 8} textAnchor="middle" className="pc-axis">{dateLabel(t)}</text>)}
        {hov && <line x1={xs[i!]} x2={xs[i!]} y1={PAD.t} y2={H - PAD.b} className="pc-cross" />}
        <path d={line('pageAvg')} fill="none" stroke={C.page} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
        <path d={line('timed')} fill="none" stroke={C.timed} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
        {days.map((d, k) => (
          <g key={d.day} className={k === i ? 'pc-hot' : ''}>
            {d.pageAvg !== undefined && <circle cx={x(d.day)} cy={y(d.pageAvg)} r={k === i ? 5.5 : 4} fill={C.page} className="pc-dot" />}
            {d.timed !== undefined && <circle cx={x(d.day)} cy={y(d.timed)} r={k === i ? 6 : 4.5} fill={C.timed} className="pc-dot" />}
            {d.reread !== undefined && <circle cx={x(d.day)} cy={y(d.reread)} r={k === i ? 7 : 5.5} fill={C.reread} className="pc-dot" />}
          </g>
        ))}
        {lastTimed && <text x={x(lastTimed.day) + 10} y={y(lastTimed.timed!) + 4} className="pc-label">{lastTimed.timed}</text>}
        {showBest && best && <text x={x(best.day)} y={y(best.v) - 12} textAnchor="middle" className="pc-label">Best {best.v}</text>}
        <text x={PAD.l} y={PAD.t - 4} className="pc-axis">WCPM</text>
      </svg>
      {hov && (
        <Tip x={xs[i!]} width={width}>
          <div className="pc-tip-date">{dateLabel(hov.day, true)}</div>
          {hov.timed !== undefined && <div><Key c={C.timed} /><b>{hov.timed}</b> timed read</div>}
          {hov.reread !== undefined && <div><Key c={C.reread} dot /><b>{hov.reread}</b> best re-read</div>}
          {hov.pageAvg !== undefined && <div><Key c={C.page} /><b>{hov.pageAvg}</b> page reads ({hov.pages} {hov.pages === 1 ? 'page' : 'pages'})</div>}
        </Tip>
      )}
    </div>
  );
}

function FluencyTable({ days, names }: { days: FluencyDay[]; names: Record<'timed' | 'reread' | 'page', string> }) {
  return (
    <div className="table-wrap">
      <table className="table">
        <thead><tr><th>Date</th><th className="num">{names.page}</th><th className="num">{names.reread}</th><th className="num">{names.timed}</th></tr></thead>
        <tbody>
          {[...days].reverse().map(d => (
            <tr key={d.day}>
              <td>{dateLabel(d.day, true)}</td>
              <td className="num">{d.pageAvg !== undefined ? `${d.pageAvg} (${d.pages} ${d.pages === 1 ? 'page' : 'pages'})` : '–'}</td>
              <td className="num">{d.reread ?? '–'}</td>
              <td className="num">{d.timed ?? '–'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const Key = ({ c, dot }: { c: string; dot?: boolean }) => dot
  ? <svg width="14" height="10" className="pc-key" aria-hidden="true"><circle cx="7" cy="5" r="4" fill={c} /></svg>
  : <svg width="14" height="10" className="pc-key" aria-hidden="true"><line x1="1" y1="5" x2="13" y2="5" stroke={c} strokeWidth="2.5" strokeLinecap="round" /></svg>;

// ---------- Power ----------

export function PowerChart({ events, audience }: { events: ReadingEvent[]; audience: Audience }) {
  const days = powerByDay(events);
  const [table, setTable] = useState(false);
  const pupil = audience === 'pupil';
  const total = days.at(-1)?.total ?? 0, lv = levelFor(total);
  const thisWeek = weekKey(new Date().toISOString());
  const week = days.filter(d => weekKey(d.day + 'T12:00:00') === thisWeek).reduce((t, d) => t + d.earned, 0);

  return (
    <div className="pc">
      <div className="pc-stats">
        <Stat label={pupil ? 'Your Power' : 'Total Power'} value={total.toLocaleString('en-GB')} note={`Level ${lv.level} · ${lv.name}`} />
        <Stat label="This week" value={`+${week}`} note={pupil ? 'Power earned since Monday' : 'Earned since Monday'} />
        <Stat label="Next level" value={lv.next ? lv.toNext : '–'} note={lv.next ? `Power to reach ${lv.next.name}` : 'Top level reached'} />
      </div>
      {days.length === 0 ? <p className="hint">{pupil ? 'Read a page aloud to earn your first Power.' : 'No Power earned yet.'}</p> : <>
        {table ? <PowerTable days={days} /> : <PowerPlot days={days} />}
        <div className="pc-foot">
          <p className="hint">{pupil
            ? 'Power goes up every time you practise. The dotted steps show where each new level starts.'
            : 'Power rewards practice (pages read, re-reads, timed reads, weekly goal), not speed. The steps show where each level starts.'}</p>
          <button className="link" onClick={() => setTable(!table)}>{table ? 'Show as graph' : 'Show as table'}</button>
        </div>
      </>}
    </div>
  );
}

function PowerPlot({ days }: { days: PowerDay[] }) {
  const [ref, width] = useWidth();
  const top = days.at(-1)!.total;
  const levels = levelLines(top);
  const { max, step } = niceMax(Math.max(top, levels.at(-1)?.min ?? 0) * 1.08);
  const { x, ticks } = timeScale(days.map(d => d.day), width);
  const y = (v: number) => PAD.t + (H - PAD.t - PAD.b) * (1 - v / max);
  const xs = days.map(d => x(d.day));
  const { i, handlers } = useCrosshair(xs);
  // Running total as a line from zero, so the first day's Power shows as a rise.
  const pts = [{ x: xs[0] - (days.length === 1 ? 40 : 0), v: 0 }, ...days.map((d, k) => ({ x: xs[k], v: d.total }))];
  const d = pts.map((p, k) => `${k ? 'L' : 'M'}${p.x},${y(p.v)}`).join(' ');
  const hov = i !== null ? days[i] : null;
  const last = days.at(-1)!;
  // Every level line is drawn; a label is dropped if it would sit on the one above it.
  const labelled = new Set<number>();
  let lastY = -Infinity;
  for (const l of [...levels].sort((a, b) => b.min - a.min)) if (y(l.min) - lastY >= 22) { labelled.add(l.level); lastY = y(l.min); }

  return (
    <div className="pc-plot" ref={ref}>
      <svg width={width} height={H} role="img" {...handlers}
        aria-label={`Power over time: ${last.total} Power after ${days.length} days of practice, level ${last.level}. Use the table view for every value.`}>
        {Array.from({ length: max / step + 1 }, (_, k) => k * step).map(v => (
          <g key={v}>
            <line x1={PAD.l} x2={width - PAD.r} y1={y(v)} y2={y(v)} className={v === 0 ? 'pc-base' : 'pc-grid'} />
            <text x={PAD.l - 8} y={y(v) + 4} textAnchor="end" className="pc-axis">{v.toLocaleString('en-GB')}</text>
          </g>
        ))}
        {levels.map(l => (
          <g key={l.level}>
            <line x1={PAD.l} x2={width - PAD.r} y1={y(l.min)} y2={y(l.min)} className={'pc-level' + (l.min > top ? ' next' : '')} style={{ stroke: l.color }} />
            {labelled.has(l.level) && <text x={PAD.l + 6} y={y(l.min) - 5} className="pc-level-label">{l.min > top ? `Next: ${l.name}` : `Level ${l.level} · ${l.name}`}</text>}
          </g>
        ))}
        {ticks.map(t => <text key={t} x={x(t)} y={H - 8} textAnchor="middle" className="pc-axis">{dateLabel(t)}</text>)}
        <path d={`${d} L${pts.at(-1)!.x},${y(0)} L${pts[0].x},${y(0)} Z`} fill={C.power} opacity="0.1" />
        {hov && <line x1={xs[i!]} x2={xs[i!]} y1={PAD.t} y2={H - PAD.b} className="pc-cross" />}
        <path d={d} fill="none" stroke={C.power} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
        {i !== null && <circle cx={xs[i]} cy={y(days[i].total)} r="5.5" fill={C.power} className="pc-dot" />}
        <circle cx={xs.at(-1)!} cy={y(last.total)} r="5" fill={C.power} className="pc-dot" />
        <text x={xs.at(-1)! + 10} y={y(last.total) + 4} className="pc-label">{last.total.toLocaleString('en-GB')}</text>
      </svg>
      {hov && (
        <Tip x={xs[i!]} width={width}>
          <div className="pc-tip-date">{dateLabel(hov.day, true)}</div>
          <div><b>+{hov.earned}</b> Power that day</div>
          <div><b>{hov.total.toLocaleString('en-GB')}</b> total · {LEVELS[hov.level - 1].name}</div>
        </Tip>
      )}
    </div>
  );
}

function PowerTable({ days }: { days: PowerDay[] }) {
  return (
    <div className="table-wrap">
      <table className="table">
        <thead><tr><th>Date</th><th className="num">Power earned</th><th className="num">Total</th><th>Level</th></tr></thead>
        <tbody>
          {[...days].reverse().map(d => (
            <tr key={d.day}><td>{dateLabel(d.day, true)}</td><td className="num">+{d.earned}</td><td className="num">{d.total.toLocaleString('en-GB')}</td><td>{d.level} · {LEVELS[d.level - 1].name}</td></tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

