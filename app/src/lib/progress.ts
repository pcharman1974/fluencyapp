// Progress over time for the pupil and teacher charts. Pure functions over a pupil's events.
import { dayKey, levelFor, LEVELS, type ReadingEvent } from './rewards';

type PageEvent = Extract<ReadingEvent, { type: 'page' }>;

/**
 * WCPM for a checked page read. New reads store it; older ones are estimated from what was saved
 * (words heard and read correctly, over the reading time).
 */
export function pageWcpm(e: PageEvent): number {
  if (e.wcpm !== undefined) return e.wcpm;
  return e.durationSec > 0 ? Math.round((e.words * e.coverage * e.accuracy * 60) / e.durationSec) : 0;
}

export interface FluencyDay {
  day: string;          // YYYY-MM-DD
  pageAvg?: number;     // average WCPM of that day's checked page reads
  pages: number;        // how many checked page reads went into the average
  reread?: number;      // best checked "beat your best" re-read that day
  timed?: number;       // timed read that day (the last one, if there were several)
}

/** One row per day with any checked reading, oldest first. */
export function fluencyByDay(ev: ReadingEvent[], storyId?: string): FluencyDay[] {
  const days = new Map<string, { sum: number; pages: number; reread?: number; timed?: number }>();
  const get = (iso: string) => {
    const k = dayKey(iso);
    if (!days.has(k)) days.set(k, { sum: 0, pages: 0 });
    return days.get(k)!;
  };
  for (const e of ev) {
    if ('storyId' in e && storyId && e.storyId !== storyId) continue;
    if (e.type === 'page' && e.verified) { const d = get(e.date); d.sum += pageWcpm(e); d.pages++; }
    if (e.type === 'reread' && e.verified) { const d = get(e.date); d.reread = Math.max(d.reread ?? 0, e.wcpm); }
    if (e.type === 'timed') get(e.date).timed = e.wcpm;
  }
  return [...days.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([day, d]) => ({
    day, pages: d.pages, pageAvg: d.pages ? Math.round(d.sum / d.pages) : undefined, reread: d.reread, timed: d.timed,
  }));
}

export interface FluencySummary {
  firstTimed?: number;
  latestTimed?: number;
  bestTimed?: number;
  bestReread?: number;
  /** Change in the average of page reads: first week of reading vs the most recent week. */
  pageChange?: { from: number; to: number };
}

export function fluencySummary(days: FluencyDay[]): FluencySummary {
  const timed = days.filter(d => d.timed !== undefined).map(d => d.timed!);
  const rereads = days.filter(d => d.reread !== undefined).map(d => d.reread!);
  const pageDays = days.filter(d => d.pageAvg !== undefined);
  let pageChange: FluencySummary['pageChange'];
  if (pageDays.length >= 4) {
    const avg = (ds: FluencyDay[]) => Math.round(ds.reduce((s, d) => s + d.pageAvg! * d.pages, 0) / ds.reduce((s, d) => s + d.pages, 0));
    const firstDay = new Date(pageDays[0].day + 'T12:00:00').getTime(), lastDay = new Date(pageDays.at(-1)!.day + 'T12:00:00').getTime();
    const early = pageDays.filter(d => new Date(d.day + 'T12:00:00').getTime() - firstDay < 7 * 864e5);
    const late = pageDays.filter(d => lastDay - new Date(d.day + 'T12:00:00').getTime() < 7 * 864e5);
    if (lastDay - firstDay >= 14 * 864e5) pageChange = { from: avg(early), to: avg(late) };
  }
  return {
    firstTimed: timed[0], latestTimed: timed.at(-1),
    bestTimed: timed.length ? Math.max(...timed) : undefined,
    bestReread: rereads.length ? Math.max(...rereads) : undefined,
    pageChange,
  };
}

export interface PowerDay { day: string; earned: number; total: number; level: number }

/** Power earned each day and the running total, oldest first. */
export function powerByDay(ev: ReadingEvent[]): PowerDay[] {
  const earned = new Map<string, number>();
  for (const e of ev) if (e.type === 'points') earned.set(dayKey(e.date), (earned.get(dayKey(e.date)) ?? 0) + e.amount);
  let total = 0;
  return [...earned.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([day, n]) => {
    total += n;
    return { day, earned: n, total, level: levelFor(total).level };
  });
}

/** The level steps worth drawing on a Power chart that tops out at `max`: those reached, plus the next one. */
export function levelLines(max: number) {
  const next = LEVELS.find(l => l.min > max);
  return LEVELS.filter(l => l.min > 0 && (l.min <= max || l === next));
}
