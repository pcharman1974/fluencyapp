// Usage summary for the teacher dashboard. Pure functions over a pupil's events.
import { totals, weekTotals } from './milestones';
import { dayKey, levelFor, sessionDays, sessionsInWeek, totalPoints, trickyWords, weekKey, weekStreak, WEEKLY_TARGET, type ReadingEvent } from './rewards';

export type Status = 'on-track' | 'behind' | 'not-started' | 'holiday';

export interface PupilSummary {
  code: string;
  example: boolean;
  sessionsThisWeek: number;
  status: Status;
  streak: number;
  pagesThisWeek: number;
  minutesThisWeek: number;
  checksThisWeek: number;
  failedThisWeek: number;
  failedShare: number;
  latestWcpm?: number;
  firstWcpm?: number;
  power: number;
  level: number;
  levelName: string;
  lastActive?: string;
  wordsTotal: number;
  wordsThisWeek: number;
  minutesTotal: number;
  weeks: { week: string; sessions: number; holiday: boolean }[]; // oldest first
  tricky: string[];
  needsAttention: boolean;
}

export function summarise(code: string, ev: ReadingEvent[], nowIso: string, holidays: string[], example = false, weeksBack = 8): PupilSummary {
  const wk = weekKey(nowIso);
  const thisWeek = ev.filter(e => weekKey(e.date) === wk);
  const checks = thisWeek.filter(e => e.type === 'page') as Extract<ReadingEvent, { type: 'page' }>[];
  const passed = checks.filter(c => c.verified);
  const timed = ev.filter(e => e.type === 'timed') as Extract<ReadingEvent, { type: 'timed' }>[];
  const sessions = sessionsInWeek(ev, nowIso);
  const holiday = holidays.includes(wk);
  const status: Status = holiday ? 'holiday' : sessions >= WEEKLY_TARGET ? 'on-track' : sessions === 0 ? 'not-started' : 'behind';
  const pts = totalPoints(ev), lv = levelFor(pts);
  const reading = ev.filter(e => e.type !== 'points' && e.type !== 'badge' && e.type !== 'profile');
  const days = sessionDays(ev);
  const weeks: PupilSummary['weeks'] = [];
  let w = wk;
  for (let i = 0; i < weeksBack; i++) {
    weeks.unshift({ week: w, sessions: [...days].filter(d => weekKey(d + 'T12:00:00') === w).length, holiday: holidays.includes(w) });
    const [y, m, d] = w.split('-').map(Number);
    w = dayKey(new Date(y, m - 1, d - 7, 12).toISOString());
  }
  const failedShare = checks.length ? (checks.length - passed.length) / checks.length : 0;
  return {
    code, example, sessionsThisWeek: sessions, status, streak: weekStreak(ev, nowIso, holidays),
    pagesThisWeek: passed.length,
    minutesThisWeek: Math.round(passed.reduce((s, c) => s + c.durationSec, 0) / 60),
    checksThisWeek: checks.length, failedThisWeek: checks.length - passed.length, failedShare,
    latestWcpm: timed.at(-1)?.wcpm, firstWcpm: timed.length > 1 ? timed[0].wcpm : undefined,
    power: pts, level: lv.level, levelName: lv.name,
    lastActive: reading.at(-1)?.date,
    wordsTotal: totals(ev).words, wordsThisWeek: weekTotals(ev, nowIso).words, minutesTotal: Math.round(totals(ev).seconds / 60),
    weeks, tricky: trickyWords(ev, 6),
    needsAttention: !holiday && (status === 'not-started' || (checks.length >= 3 && failedShare >= 0.4)),
  };
}

/** Pupils who need a look first, then those behind, then on track. */
export function sortForTeacher(list: PupilSummary[]): PupilSummary[] {
  const rank: Record<Status, number> = { 'not-started': 0, behind: 1, 'on-track': 2, holiday: 3 };
  return [...list].sort((a, b) => Number(b.needsAttention) - Number(a.needsAttention) || rank[a.status] - rank[b.status] || a.code.localeCompare(b.code));
}
