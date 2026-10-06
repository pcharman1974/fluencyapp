// Reading counters: total words read aloud and total minutes reading aloud, with milestone badges for
// totals, single weeks and single months. Only reading the app heard and accepted counts.
import { dayKey, readingSeconds, weekKey, type ReadingEvent } from './rewards';

/** Words read aloud in one event (accepted reads only). */
export function wordsRead(e: ReadingEvent): number {
  if (e.type === 'page' && e.verified) return Math.round(e.words * (e.coverage ?? 1));
  if (e.type === 'reread' && e.verified) return Math.round((e.words ?? 0) * (e.coverage ?? 1));
  if (e.type === 'timed') return Math.round((e.wcpm * (e.seconds ?? 60)) / 60) + e.errorWords.length;
  if (e.type === 'warmup' && e.correct) return 1;
  return 0;
}

export const monthKey = (iso: string) => dayKey(iso).slice(0, 7); // YYYY-MM

export interface Totals { words: number; seconds: number }
const add = (t: Totals, e: ReadingEvent) => { t.words += wordsRead(e); t.seconds += readingSeconds(e); return t; };

export function totals(ev: ReadingEvent[], filter: (e: ReadingEvent) => boolean = () => true): Totals {
  return ev.filter(filter).reduce(add, { words: 0, seconds: 0 });
}
export const weekTotals = (ev: ReadingEvent[], iso: string) => totals(ev, e => weekKey(e.date) === weekKey(iso));
export const monthTotals = (ev: ReadingEvent[], iso: string) => totals(ev, e => monthKey(e.date) === monthKey(iso));

/** Totals per week or month, oldest first, including empty periods back to the first reading (max `n`). */
export function byPeriod(ev: ReadingEvent[], period: 'week' | 'month', nowIso: string, n: number): ({ key: string } & Totals)[] {
  const keyOf = period === 'week' ? weekKey : monthKey;
  const m = new Map<string, Totals>();
  for (const e of ev) { const k = keyOf(e.date); m.set(k, add(m.get(k) ?? { words: 0, seconds: 0 }, e)); }
  const first = [...m.keys()].filter(k => (m.get(k)!.words || m.get(k)!.seconds)).sort()[0];
  const keys: string[] = [];
  const d = new Date(nowIso);
  for (let i = 0; i < n; i++) {
    const k = period === 'week'
      ? weekKey(new Date(d.getFullYear(), d.getMonth(), d.getDate() - 7 * i, 12).toISOString())
      : monthKey(new Date(d.getFullYear(), d.getMonth() - i, 15, 12).toISOString());
    keys.unshift(k);
    if (!first || k <= first) break;
  }
  return keys.map(k => ({ key: k, ...(m.get(k) ?? { words: 0, seconds: 0 }) }));
}

// ---------- milestone badges ----------

export type MilestoneScope = 'total' | 'week' | 'month';
export interface Milestone { id: string; scope: MilestoneScope; measure: 'words' | 'minutes'; at: number; name: string; how: string; label: string }

const fmt = (n: number) => n.toLocaleString('en-GB');
export const formatWords = fmt;
const words = (scope: MilestoneScope, at: number, label: string, name: string): Milestone =>
  ({ id: `${scope}-words-${at}`, scope, measure: 'words', at, label, name,
     how: scope === 'total' ? `Read ${fmt(at)} words aloud` : `Read ${fmt(at)} words aloud in one ${scope}` });
const mins = (scope: MilestoneScope, at: number, label: string, name: string): Milestone =>
  ({ id: `${scope}-minutes-${at}`, scope, measure: 'minutes', at, label, name,
     how: scope === 'total' ? `Read aloud for ${at >= 60 ? `${at / 60} hour${at === 60 ? '' : 's'}` : `${at} minutes`} in total` : `Read aloud for ${at} minutes in one ${scope}` });

/**
 * Pitched for the target pupils: about 100 words a minute, 5 minutes on 3+ days a week, so roughly
 * 1,500 words and 15 minutes a week. Totals give an early win, then grow; week and month badges can be
 * earned again each week or month.
 */
export const MILESTONES: Milestone[] = [
  words('total', 250, '250', 'First 250 words'),
  words('total', 1000, '1k', '1,000 words'),
  words('total', 5000, '5k', '5,000 words'),
  words('total', 10000, '10k', '10,000 words'),
  words('total', 25000, '25k', '25,000 words'),
  words('total', 50000, '50k', '50,000 words'),
  words('total', 100000, '100k', '100,000 words'),
  mins('total', 30, '30m', '30 minutes'),
  mins('total', 60, '1h', '1 hour'),
  mins('total', 180, '3h', '3 hours'),
  mins('total', 300, '5h', '5 hours'),
  mins('total', 600, '10h', '10 hours'),
  mins('total', 1200, '20h', '20 hours'),
  words('week', 1000, '1k', '1,000-word week'),
  mins('week', 20, '20m', '20-minute week'),
  words('month', 5000, '5k', '5,000-word month'),
  mins('month', 60, '60m', '60-minute month'),
];

const value = (t: Totals, m: Milestone) => (m.measure === 'words' ? t.words : t.seconds / 60);
const scoped = (ev: ReadingEvent[], m: Milestone, iso: string) =>
  m.scope === 'total' ? totals(ev) : m.scope === 'week' ? weekTotals(ev, iso) : monthTotals(ev, iso);
const samePeriod = (m: Milestone, a: string, b: string) =>
  m.scope === 'week' ? weekKey(a) === weekKey(b) : m.scope === 'month' ? monthKey(a) === monthKey(b) : true;

/** Milestones reached by a new event: crossed now, and not already earned (this week/month for repeatable ones). */
export function milestonesReached(before: ReadingEvent[], e: ReadingEvent): string[] {
  if (!wordsRead(e) && !readingSeconds(e)) return [];
  const after = [...before, e];
  return MILESTONES.filter(m => {
    if (value(scoped(after, m, e.date), m) < m.at) return false;
    return !before.some(x => x.type === 'badge' && x.id === m.id && samePeriod(m, x.date, e.date));
  }).map(m => m.id);
}

/** How many times each milestone badge has been earned. */
export function milestoneCounts(ev: ReadingEvent[]): Map<string, number> {
  const c = new Map<string, number>();
  for (const e of ev) if (e.type === 'badge' && MILESTONES.some(m => m.id === e.id)) c.set(e.id, (c.get(e.id) ?? 0) + 1);
  return c;
}

/** The next total milestone for a measure, and how far along the way to it the pupil is (0-1). */
export function nextMilestone(t: Totals, measure: 'words' | 'minutes') {
  const list = MILESTONES.filter(m => m.scope === 'total' && m.measure === measure);
  const v = measure === 'words' ? t.words : t.seconds / 60;
  const i = list.findIndex(m => m.at > v);
  if (i < 0) return { next: undefined, from: list.at(-1)!.at, progress: 1, togo: 0 };
  const from = i ? list[i - 1].at : 0, next = list[i];
  return { next, from, progress: (v - from) / (next.at - from), togo: Math.ceil(next.at - v) };
}

export const formatMinutes = (seconds: number) => {
  const m = Math.floor(seconds / 60);
  return m >= 60 ? (m % 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m / 60}h`) : `${m} min`;
};

/** Name and how-to for any badge id, core or milestone. */
export function badgeInfo(id: string, core: { id: string; name: string; how: string }[]) {
  return core.find(b => b.id === id) ?? MILESTONES.find(m => m.id === id) ?? { id, name: id, how: '' };
}
