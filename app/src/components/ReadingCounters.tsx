// Total words read and total minutes reading aloud, each with a ring gauge filling towards the next
// milestone badge. Also the weekly/monthly bar chart of words or minutes for the Progress page.
import { useState } from 'react';
import type { ReadingEvent } from '../lib/rewards';
import { byPeriod, formatMinutes, formatWords, nextMilestone, totals, weekTotals, type Totals } from '../lib/milestones';

const COLOR = { words: '#1D6FB0', minutes: '#7A5BC0' };

function Ring({ progress, color, children, label }: { progress: number; color: string; children: React.ReactNode; label: string }) {
  const r = 42, c = 2 * Math.PI * r;
  return (
    <div className="rc-ring">
      <svg viewBox="0 0 100 100" role="img" aria-label={label}>
        <circle cx="50" cy="50" r={r} className="rc-ring-bg" />
        <circle cx="50" cy="50" r={r} fill="none" stroke={color} strokeWidth="9" strokeLinecap="round"
          strokeDasharray={`${c * Math.max(0.02, Math.min(1, progress))} ${c}`} transform="rotate(-90 50 50)" />
      </svg>
      <div className="rc-ring-inner">{children}</div>
    </div>
  );
}

function Counter({ measure, t, week }: { measure: 'words' | 'minutes'; t: Totals; week: Totals }) {
  const n = nextMilestone(t, measure);
  const big = measure === 'words' ? formatWords(t.words) : formatMinutes(t.seconds);
  const togo = n.next ? (measure === 'words' ? `${formatWords(n.togo)} words` : `${n.togo} min`) : '';
  return (
    <div className="rc-counter">
      <Ring progress={n.progress} color={COLOR[measure]}
        label={`${big} ${measure === 'words' ? 'words read' : 'reading aloud'}. ${n.next ? `${togo} to the ${n.next.name} badge.` : 'Every milestone reached.'}`}>
        <b className="rc-big">{big}</b>
        <span className="rc-unit">{measure === 'words' ? 'words read' : 'reading aloud'}</span>
      </Ring>
      <p className="rc-next">{n.next ? <><b>{togo}</b> to the <b>{n.next.name}</b> badge</> : 'Every milestone reached!'}</p>
      <p className="rc-week">This week: {measure === 'words' ? `${formatWords(week.words)} words` : formatMinutes(week.seconds)}</p>
    </div>
  );
}

/** The two counters side by side. */
export function ReadingCounters({ events }: { events: ReadingEvent[] }) {
  const now = new Date().toISOString();
  const t = totals(events), wk = weekTotals(events, now);
  return (
    <div className="rc">
      <Counter measure="words" t={t} week={wk} />
      <Counter measure="minutes" t={t} week={wk} />
    </div>
  );
}

const MONTH = (k: string) => new Date(k + '-15T12:00:00').toLocaleDateString('en-GB', { month: 'short' });
const WEEK = (k: string) => new Date(k + 'T12:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });

/** Bars of words or minutes per week or month. */
export function ReadingVolumeChart({ events, audience = 'pupil' }: { events: ReadingEvent[]; audience?: 'pupil' | 'teacher' }) {
  const [measure, setMeasure] = useState<'words' | 'minutes'>('words');
  const [period, setPeriod] = useState<'week' | 'month'>('week');
  const rows = byPeriod(events, period, new Date().toISOString(), period === 'week' ? 10 : 12);
  const val = (r: Totals) => (measure === 'words' ? r.words : Math.round(r.seconds / 60));
  const max = Math.max(1, ...rows.map(val));
  const best = Math.max(...rows.map(val));
  const pupil = audience === 'pupil';
  const unit = measure === 'words' ? 'words' : 'minutes';
  return (
    <div className="rv">
      <div className="row wrap between">
        <div className="seg" role="group" aria-label="Show">
          {(['words', 'minutes'] as const).map(m => <button key={m} className={m === measure ? 'on' : ''} aria-pressed={m === measure} onClick={() => setMeasure(m)}>{m === 'words' ? 'Words' : 'Minutes'}</button>)}
        </div>
        <div className="seg" role="group" aria-label="Per">
          {(['week', 'month'] as const).map(p => <button key={p} className={p === period ? 'on' : ''} aria-pressed={p === period} onClick={() => setPeriod(p)}>{p === 'week' ? 'By week' : 'By month'}</button>)}
        </div>
      </div>
      {rows.every(r => !val(r)) ? <p className="hint">{pupil ? 'Read a page aloud to start your chart.' : 'No checked reading yet.'}</p> : (
        <ol className="rv-bars" aria-label={`${unit} read aloud per ${period}`}>
          {rows.map(r => {
            const v = val(r);
            return (
              <li key={r.key} title={`${period === 'week' ? 'Week of ' + WEEK(r.key) : MONTH(r.key)}: ${v.toLocaleString('en-GB')} ${unit}`}>
                <span className="rv-val">{v ? v.toLocaleString('en-GB') : ''}</span>
                <span className={'rv-bar' + (v && v === best ? ' best' : '')} style={{ height: `${(v / max) * 100}%`, background: COLOR[measure] }} />
                <span className="rv-key">{period === 'week' ? WEEK(r.key) : MONTH(r.key)}</span>
              </li>
            );
          })}
        </ol>
      )}
      <p className="hint">{pupil ? `Only reading the app heard counts. Your best ${period} is the tallest bar.` : `Checked reading aloud only: accepted page reads, best readings, timed reads and correct practice words.`}</p>
    </div>
  );
}
