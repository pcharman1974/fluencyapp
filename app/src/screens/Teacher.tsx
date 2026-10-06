import { useEffect, useMemo, useState } from 'react';
import type { Attempt } from '../types';
import { STORIES } from '../lib/library';
import { fromServer, mergeClass, type PupilData } from '../lib/classData';
import { listRecords, qaEnabled, removeReader } from '../lib/qa';
import type { Screen } from '../App';
import { getAllReaderCodes, getAttempts, getEvents, getHolidays, removeLocalReader, setHolidays } from '../lib/storage';
import DataLog from '../components/DataLog';
import ServerData from '../components/ServerData';
import { download, logRows, toCsv } from '../lib/dataLog';
import { summarise, sortForTeacher, type PupilSummary, type Status } from '../lib/teacher';
import { exampleClass } from '../lib/exampleData';
import { DAILY_TARGET_MIN, TEST_TARGET_KEY, weekKey, WEEKLY_TARGET, LEVELS, type ReadingEvent } from '../lib/rewards';
import { GoalRing } from '../components/Rewards';
import { FluencyChart, PowerChart } from '../components/ProgressCharts';
import { ReadingCounters, ReadingVolumeChart } from '../components/ReadingCounters';

interface Props { go: (s: Screen) => void }

const STATUS: Record<Status, { label: string; icon: string }> = {
  'on-track': { label: 'On track', icon: '✓' },
  behind: { label: 'Behind', icon: '!' },
  'not-started': { label: 'Not started', icon: '×' },
  holiday: { label: 'Holiday', icon: '–' },
};

export default function Teacher({ go }: Props) {
  const now = new Date().toISOString();
  const [holidays, setHol] = useState(getHolidays());
  // Every pupil saved on the server (any device), plus anything on this device not uploaded yet.
  const [server, setServer] = useState<Record<string, PupilData> | null>(null);
  const [serverOn, setServerOn] = useState(false);
  const loadServer = () => qaEnabled().then(on => { setServerOn(on); if (on) listRecords().then(r => setServer(fromServer(r))).catch(() => setServer({})); });
  useEffect(() => { loadServer(); }, []);
  const [removedTick, setRemovedTick] = useState(0);
  const remove = async (code: string) => {
    if (!confirm(`Remove pupil ${code}? This deletes all their data: reading records, timed reads and recordings, from the server and this device. It can't be undone.`)) return;
    if (serverOn && !(await removeReader(code))) { alert('Could not remove the pupil from the server. Check the connection and try again.'); return; }
    removeLocalReader(code);
    setOpen(null); setRemovedTick(t => t + 1); loadServer();
  };
  const classData = useMemo(() => {
    const local: Record<string, PupilData> = {};
    for (const code of getAllReaderCodes()) local[code] = { events: getEvents(code), attempts: getAttempts(code) };
    return mergeClass(server ?? {}, local);
  }, [server, removedTick]);
  const real = Object.keys(classData).filter(c => classData[c].events.length || classData[c].attempts.length || server?.[c]);
  const [showExamples, setShowExamples] = useState(() => getAllReaderCodes().length < 3);
  const [open, setOpen] = useState<string | null>(null);
  const examples = useMemo(() => exampleClass(), []);

  const pupils = useMemo(() => {
    const list: { s: PupilSummary; events: ReadingEvent[]; attempts: Attempt[] }[] = real.map(code => {
      const { events, attempts } = classData[code];
      return { s: summarise(code, events, now, holidays), events, attempts };
    });
    if (showExamples) list.push(...examples.map(e => ({ s: summarise(e.code, e.events, now, holidays, true), events: e.events, attempts: [] })));
    return list;
  }, [holidays, showExamples, classData, removedTick]);
  const sorted = sortForTeacher(pupils.map(p => p.s));
  const thisWeek = weekKey(now);
  const isHoliday = holidays.includes(thisWeek);
  const toggleHoliday = () => {
    const next = isHoliday ? holidays.filter(h => h !== thisWeek) : [...holidays, thisWeek];
    setHolidays(next); setHol(next);
  };

  const onTrack = sorted.filter(s => s.status === 'on-track').length;
  const attention = sorted.filter(s => s.needsAttention).length;
  const mins = sorted.reduce((t, s) => t + s.minutesThisWeek, 0);
  const detail = open ? pupils.find(p => p.s.code === open) : null;

  if (detail) return <PupilDetail p={detail.s} events={detail.events} attempts={detail.attempts} onBack={() => setOpen(null)} onRemove={detail.s.example ? undefined : () => remove(detail.s.code)} />;

  return (
    <div className="teacher">
      <div className="row wrap between">
        <button className="btn btn-ghost" onClick={() => go({ name: 'home' })}>← Pupil view</button>
        <div className="row wrap">
          <label className="check"><input type="checkbox" checked={showExamples} onChange={e => setShowExamples(e.target.checked)} /> Show example pupils</label>
          <label className="check"><input type="checkbox" checked={isHoliday} onChange={toggleHoliday} /> This week is a school holiday</label>
          <label className="check" title="For testing only. Changes this device until switched off.">
            <input type="checkbox" checked={DAILY_TARGET_MIN < 5} onChange={e => {
              try { e.target.checked ? localStorage.setItem(TEST_TARGET_KEY, '1') : localStorage.removeItem(TEST_TARGET_KEY); } catch { /* ignore */ }
              location.reload();
            }} /> Testing: 1-minute daily bar on this device</label>
          {real.length > 0 && <button className="link" onClick={() => download(`power-reader-all-${now.slice(0, 10)}.csv`,
            toCsv(real.flatMap(code => logRows(classData[code].events, classData[code].attempts).map(row => ({ readerCode: code, row })))), 'text/csv')}>Download all data (QA, CSV)</button>}
        </div>
      </div>
      <section className="panel">
        <h2>Class reading this week</h2>
        <p className="hint">Week starting {new Date(thisWeek + 'T12:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'long' })} · Goal: reading bar filled (5 minutes of checked reading aloud) on {WEEKLY_TARGET} days per pupil.
          {' '}{serverOn ? 'Shows every pupil saved on the server, from any device' : 'Shows pupils who have used this device'}{showExamples ? ', plus example pupils' : ''}. {serverOn && <button className="link" onClick={loadServer}>Refresh</button>}</p>
        <div className="t-summary">
          <div><b>{onTrack} of {sorted.length}</b><span>pupils have hit their goal</span></div>
          <div><b>{attention}</b><span>{attention === 1 ? 'pupil needs' : 'pupils need'} a look</span></div>
          <div><b>{mins} min</b><span>reading aloud, checked</span></div>
        </div>
        <div className="table-wrap">
          <table className="table t-table">
            <thead><tr>
              <th>Reader</th><th>This week</th><th>Week streak</th><th>Pages read</th><th>Minutes</th><th>Failed checks</th><th>Fluency (WCPM)</th><th>Words read</th><th>Total time</th><th>Level</th><th>Last active</th>
            </tr></thead>
            <tbody>
              {sorted.map(s => (
                <tr key={s.code} className={s.needsAttention ? 'attn' : ''} onClick={() => setOpen(s.code)} tabIndex={0} onKeyDown={e => e.key === 'Enter' && setOpen(s.code)}>
                  <td><strong>{s.code}</strong>{s.example && <span className="tag ex">Example</span>}</td>
                  <td><span className={'status ' + s.status}><span aria-hidden="true">{STATUS[s.status].icon}</span> {STATUS[s.status].label}</span> <span className="num">{s.sessionsThisWeek}/{WEEKLY_TARGET}</span></td>
                  <td className="num">{s.streak ? `${s.streak} wk` : '–'}</td>
                  <td className="num">{s.pagesThisWeek}</td>
                  <td className="num">{s.minutesThisWeek}</td>
                  <td className="num">{s.checksThisWeek ? <span className={s.failedShare >= 0.4 && s.checksThisWeek >= 3 ? 'flag' : ''}>{s.failedThisWeek} of {s.checksThisWeek}</span> : '–'}</td>
                  <td className="num">{s.latestWcpm ?? '–'}{s.firstWcpm !== undefined && s.latestWcpm !== undefined && <Change d={s.latestWcpm - s.firstWcpm} />}</td>
                  <td className="num">{s.wordsTotal.toLocaleString('en-GB')}{s.wordsThisWeek > 0 && <span className="sub"> +{s.wordsThisWeek.toLocaleString('en-GB')} this week</span>}</td>
                  <td className="num">{s.minutesTotal >= 60 ? `${Math.floor(s.minutesTotal / 60)}h ${s.minutesTotal % 60}m` : `${s.minutesTotal} min`}</td>
                  <td>{s.level} · {s.levelName}</td>
                  <td>{s.lastActive ? ago(s.lastActive) : 'Never'}</td>
                </tr>
              ))}
              {sorted.length === 0 && <tr><td colSpan={11}>No pupils have used this device yet. Tick "Show example pupils" to see how the dashboard works.</td></tr>}
            </tbody>
          </table>
        </div>
        <p className="hint">Tap a pupil for detail. "Failed checks" are pages where the app didn't hear most of the page read aloud; lots of these can mean a microphone problem, rushing, or not reading.</p>
      </section>
      <ServerData />
    </div>
  );
}

function Change({ d }: { d: number }) {
  return <span className={'change ' + (d > 0 ? 'up' : d < 0 ? 'down' : '')}>{d > 0 ? ` ▲${d}` : d < 0 ? ` ▼${-d}` : ' ='}</span>;
}

function ago(iso: string) {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 864e5);
  return days <= 0 ? 'Today' : days === 1 ? 'Yesterday' : `${days} days ago`;
}

function PupilDetail({ p, events, attempts, onBack, onRemove }: { p: PupilSummary; events: ReadingEvent[]; attempts: Attempt[]; onBack: () => void; onRemove?: () => void }) {
  const [log, setLog] = useState(false);
  const recent = events.filter(e => e.type === 'page' || e.type === 'reread' || e.type === 'timed').slice(-12).reverse();
  return (
    <div className="teacher">
      <div className="row wrap between">
        <button className="btn btn-ghost" onClick={onBack}>← Class</button>
        <div className="row wrap">
          <button className={'btn ' + (log ? 'btn-navy' : 'btn-ghost')} aria-pressed={log} onClick={() => setLog(!log)}>Data log (QA)</button>
          {onRemove && <button className="btn btn-ghost btn-danger" onClick={onRemove}>Remove pupil</button>}
        </div>
      </div>
      {log && <DataLog code={p.code} events={events} attempts={attempts} example={p.example} />}
      <section className="panel">
        <div className="row wrap between">
          <h2>{p.code} {p.example && <span className="tag ex">Example</span>}</h2>
          <span className="lv-chip" style={{ ['--lv' as string]: LEVELS[p.level - 1].color }}>Level {p.level} · {p.levelName} · {p.power} Power</span>
        </div>
        <div className="t-detail">
          <div className="t-week"><GoalRing done={p.sessionsThisWeek} size={110} /><span className={'status ' + p.status}>{STATUS[p.status].icon} {STATUS[p.status].label}</span></div>
          <div className="t-chart">
            <h3>Days with a full reading bar, per week</h3>
            <WeeksChart weeks={p.weeks} />
          </div>
        </div>
      </section>
      <section className="progress-charts">
        <div className="panel">
          <h3>Reading speed (words correct per minute)</h3>
          <FluencyChart events={events} audience="teacher" />
        </div>
        <div className="panel">
          <h3>Power over time</h3>
          <PowerChart events={events} audience="teacher" />
        </div>
      </section>
      <section className="panel">
        <h3>Reading volume: words and minutes read aloud</h3>
        <ReadingCounters events={events} />
        <ReadingVolumeChart events={events} audience="teacher" />
      </section>
      <div className="t-cols">
        <section className="panel">
          <h3>Words to work on</h3>
          {p.tricky.length ? <p className="word-list left">{p.tricky.map(w => <span key={w} className="chip">{w}</span>)}</p> : <p className="hint">None at the moment.</p>}
        </section>
        <section className="panel">
          <h3>Recent reading</h3>
          <ul className="activity">
            {recent.map((e, i) => (
              <li key={i}>
                <span className="when">{new Date(e.date).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}</span>
                {e.type === 'page' && <span>{e.verified ? '✓' : '✗'} {STORIES.find(s => s.id === e.storyId)?.title ?? e.storyId}, page {e.page} · heard {Math.round(e.coverage * 100)}%{e.verified ? `, ${Math.round(e.accuracy * 100)}% correct` : ''}</span>}
                {e.type === 'reread' && <span>{e.verified ? '✓' : '✗'} Re-read page {e.page} · {e.wcpm} WCPM</span>}
                {e.type === 'timed' && <span>Timed read · {e.wcpm} WCPM</span>}
              </li>
            ))}
            {recent.length === 0 && <li className="hint">Nothing yet.</li>}
          </ul>
        </section>
      </div>
    </div>
  );
}

/** Single-series bar chart: sessions per week, with the weekly goal as a reference line. */
function WeeksChart({ weeks }: { weeks: PupilSummary['weeks'] }) {
  const [hover, setHover] = useState<number | null>(null);
  const W = 560, H = 190, L = 34, R = 10, T = 14, B = 34, max = Math.max(WEEKLY_TARGET + 1, ...weeks.map(w => w.sessions));
  const bw = (W - L - R) / weeks.length;
  const y = (v: number) => T + (H - T - B) * (1 - v / max);
  return (
    <div className="weeks-chart">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Sessions per week for the last ${weeks.length} weeks: ${weeks.map(w => w.sessions).join(', ')}. Goal ${WEEKLY_TARGET}.`}>
        {Array.from({ length: max + 1 }, (_, v) => (
          <g key={v}>
            <line x1={L} x2={W - R} y1={y(v)} y2={y(v)} className={v === 0 ? 'wc-base' : 'wc-grid'} />
            <text x={L - 8} y={y(v) + 4} textAnchor="end" className="wc-axis">{v}</text>
          </g>
        ))}
        {weeks.map((w, i) => {
          const x = L + i * bw + bw * 0.2, width = bw * 0.6, top = y(w.sessions), h = y(0) - top;
          const r = Math.min(4, h / 2);
          return (
            <g key={w.week} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)} onFocus={() => setHover(i)} onBlur={() => setHover(null)} tabIndex={0}>
              <rect x={L + i * bw} y={T} width={bw} height={H - T - B} className="wc-hit" />
              {w.holiday
                ? <rect x={x} y={y(max) } width={width} height={y(0) - y(max)} className="wc-holiday" />
                : h > 0 && <path className={'wc-bar' + (w.sessions >= WEEKLY_TARGET ? ' met' : '') + (hover === i ? ' hot' : '')}
                    d={`M${x} ${y(0)} V${top + r} Q${x} ${top} ${x + r} ${top} H${x + width - r} Q${x + width} ${top} ${x + width} ${top + r} V${y(0)} Z`} />}
              <text x={x + width / 2} y={H - B + 18} textAnchor="middle" className="wc-axis">{new Date(w.week + 'T12:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</text>
            </g>
          );
        })}
        <line x1={L} x2={W - R} y1={y(WEEKLY_TARGET)} y2={y(WEEKLY_TARGET)} className="wc-goal" />
        <text x={W - R} y={y(WEEKLY_TARGET) - 6} textAnchor="end" className="wc-goal-label">Goal {WEEKLY_TARGET}</text>
      </svg>
      {hover !== null && (
        <div className="wc-tip" style={{ left: `${((L + hover * bw + bw / 2) / W) * 100}%` }}>
          Week of {new Date(weeks[hover].week + 'T12:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}: <b>{weeks[hover].holiday ? 'holiday' : `${weeks[hover].sessions} session${weeks[hover].sessions === 1 ? '' : 's'}`}</b>
        </div>
      )}
    </div>
  );
}
