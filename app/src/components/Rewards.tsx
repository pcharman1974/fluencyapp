import { useEffect, useState } from 'react';
import { BADGES, dayKey, DAILY_TARGET_MIN, levelFor, MAX_EXTRA_MINUTES, POINTS, readingByDay, sessionsInWeek, totalPoints, weekStreak, WEEKLY_TARGET, type Award, type BadgeId, type ReadingEvent } from '../lib/rewards';

/** Ring that fills one third per session this week. */
export function GoalRing({ done, size = 96 }: { done: number; size?: number }) {
  const r = 40, c = 2 * Math.PI * r, frac = Math.min(done, WEEKLY_TARGET) / WEEKLY_TARGET;
  return (
    <svg className="goal-ring" width={size} height={size} viewBox="0 0 100 100" role="img" aria-label={`Reading bar filled on ${Math.min(done, WEEKLY_TARGET)} of ${WEEKLY_TARGET} days this week`}>
      <circle cx="50" cy="50" r={r} className="ring-bg" />
      {[0, 1, 2].map(i => <line key={i} x1="50" y1="4" x2="50" y2="16" className="ring-tick" transform={`rotate(${i * 120} 50 50)`} />)}
      <circle cx="50" cy="50" r={r} className="ring-fg" strokeDasharray={`${c * frac} ${c}`} transform="rotate(-90 50 50)" />
      <text x="50" y="49" textAnchor="middle" className="ring-num">{Math.min(done, WEEKLY_TARGET)}/{WEEKLY_TARGET}</text>
      <text x="50" y="66" textAnchor="middle" className="ring-label">this week</text>
    </svg>
  );
}

/** Simple original badge emblem: a shield with a symbol per badge. */
const SYMBOL: Record<BadgeId, string> = {
  'first-page': 'M38 30h24v40H38z M44 40h12 M44 48h12 M44 56h8',
  'perfect-page': 'M36 52l10 10 20-24',
  'story-finished': 'M34 34h14v34H34z M52 34h14v34H52z',
  'personal-best': 'M50 30l6 13 14 2-10 10 2 14-12-7-12 7 2-14-10-10 14-2z',
  're-reader': 'M64 42a16 16 0 1 0 2 14 M64 30v12H52',
  'goal-week': 'M50 30a20 20 0 1 0 0.1 0 M50 40a10 10 0 1 0 0.1 0',
  'streak-3': 'M50 28c8 10 14 16 14 26a14 14 0 0 1-28 0c0-6 4-10 6-14 2 6 4 8 8 8-2-8 0-14 0-20z',
  'sessions-10': 'M36 36h28v28H36z M36 46h28 M46 36v28 M56 36v28',
  'word-fixer': 'M40 64l24-24 M58 34l8 8 M36 68l6-2-4-4z',
};

export function Badge({ id, earned }: { id: BadgeId; earned: boolean }) {
  const b = BADGES.find(x => x.id === id)!;
  return (
    <div className={'badge' + (earned ? ' earned' : '')}>
      <svg viewBox="0 0 100 100" aria-hidden="true">
        <path d="M50 6l38 14v28c0 24-17 38-38 46C29 86 12 72 12 48V20z" className="badge-shield" />
        <path d={SYMBOL[id]} className="badge-symbol" />
      </svg>
      <strong>{b.name}</strong>
      <span>{earned ? 'Earned' : b.how}</span>
    </div>
  );
}

export function LevelBar({ events }: { events: ReadingEvent[] }) {
  const pts = totalPoints(events), lv = levelFor(pts);
  return (
    <div className="level">
      <div className="level-head">
        <span className="level-badge">Level {lv.level}</span>
        <strong>{lv.name}</strong>
        <span className="power"><span className="bolt" aria-hidden="true" />{pts} Power</span>
      </div>
      <div className="level-track" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(lv.progress * 100)}>
        <div style={{ width: lv.progress * 100 + '%' }} />
      </div>
      <span className="hint">{lv.next ? `${lv.toNext} Power to Level ${lv.next.level}: ${lv.next.name}` : 'Top level reached!'}</span>
    </div>
  );
}

export function WeekSummary({ events, holidays }: { events: ReadingEvent[]; holidays: string[] }) {
  const now = new Date().toISOString();
  const done = sessionsInWeek(events, now), streak = weekStreak(events, now, holidays);
  return (
    <div className="week-wrap">
      <TodayBar events={events} />
      <div className="week">
        <GoalRing done={done} />
        <div>
          <strong className="week-title">{done >= WEEKLY_TARGET ? 'Weekly goal done!' : `Fill your bar on ${WEEKLY_TARGET - done} more day${WEEKLY_TARGET - done === 1 ? '' : 's'} this week`}</strong>
          <span className="hint">{DAILY_TARGET_MIN} minutes of reading aloud, at least {WEEKLY_TARGET} days a week. Little and often.</span>
          <span className="streak">{streak > 0 ? `${streak}-week streak` : 'Start a week streak'}</span>
        </div>
      </div>
    </div>
  );
}

const mmss = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

/** Today's reading bar: fills with minutes of checked reading aloud. Full at DAILY_TARGET_MIN; extra minutes earn more Power. */
export function TodayBar({ events, compact }: { events: ReadingEvent[]; compact?: boolean }) {
  const secs = readingByDay(events).get(dayKey(new Date().toISOString())) ?? 0;
  const target = DAILY_TARGET_MIN * 60, full = secs >= target;
  const extra = Math.min(MAX_EXTRA_MINUTES, Math.max(0, Math.floor((secs - target) / 60)));
  const label = full
    ? `Bar full! ${Math.floor(secs / 60)} minutes today${extra ? ` · +${extra * POINTS.extraMinute} extra Power` : ''}`
    : `${mmss(secs)} of ${DAILY_TARGET_MIN}:00 today`;
  return (
    <div className={'today' + (compact ? ' compact' : '') + (full ? ' full' : '')}>
      {!compact && <div className="today-head"><strong>Today's reading</strong><span>{label}</span></div>}
      <div className="today-track" role="progressbar" aria-label="Today's reading" aria-valuemin={0} aria-valuemax={DAILY_TARGET_MIN} aria-valuenow={Math.min(DAILY_TARGET_MIN, Math.round(secs / 6) / 10)} aria-valuetext={label}>
        <div className="today-fill" style={{ width: Math.min(100, (secs / target) * 100) + '%' }} />
        {Array.from({ length: DAILY_TARGET_MIN - 1 }, (_, i) => <span key={i} className="today-tick" style={{ left: ((i + 1) / DAILY_TARGET_MIN) * 100 + '%' }} />)}
      </div>
      {compact && <span className="today-label">{label}</span>}
      {!compact && <span className="hint">{full ? `Keep going: +${POINTS.extraMinute} Power for every extra minute.` : `Only reading that passes the check counts. Filling the bar earns +${POINTS.dailyGoal} Power.`}</span>}
    </div>
  );
}

/** Pop-up rewards after something is earned. */
export function RewardToast({ award, onDone }: { award: Award | null; onDone: () => void }) {
  const [shown, setShown] = useState(award);
  useEffect(() => {
    setShown(award);
    if (!award) return;
    const t = setTimeout(onDone, 3200);
    return () => clearTimeout(t);
  }, [award]);
  if (!shown || (!shown.points.length && !shown.badges.length)) return null;
  const total = shown.points.reduce((s, p) => s + p.amount, 0);
  return (
    <div className="toast" role="status" onClick={onDone}>
      {total > 0 && <div className="toast-points"><span className="bolt" aria-hidden="true" />+{total} Power</div>}
      {shown.points.map((p, i) => <div key={i} className="toast-line">{p.reason} <b>+{p.amount}</b></div>)}
      {shown.badges.map(id => <div key={id} className="toast-badge">New badge: {BADGES.find(b => b.id === id)!.name}</div>)}
    </div>
  );
}
