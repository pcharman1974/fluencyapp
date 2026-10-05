// Power points, levels, weekly goal, week streak and badges.
// Principle: reward reading practice and personal improvement, never raw speed against others.

/** Everything a speech check measured, saved with each read for checking (QA). Older records may lack some fields. */
export interface CheckDetail {
  coverage: number; accuracy: number; words: number; durationSec: number; wpm: number; wcpm: number;
  misread: string[]; message: string; checkedBy: string; // speech service id, e.g. 'azure' or 'demo'
}

export type ReadingEvent =
  | ({ type: 'page'; date: string; storyId: string; page: number; verified: boolean; coverage: number; accuracy: number; words: number; durationSec: number; misread: string[] } & Partial<CheckDetail>)
  | ({ type: 'reread'; date: string; storyId: string; page: number; verified: boolean; wcpm: number } & Partial<CheckDetail>)
  | { type: 'timed'; date: string; storyId: string; wcpm: number; errorWords: string[]; seconds?: number }
  | ({ type: 'warmup'; date: string; word: string; correct: boolean } & Partial<CheckDetail>)
  | { type: 'points'; date: string; amount: number; reason: string }
  | { type: 'badge'; date: string; id: BadgeId };

export const POINTS = {
  perTenWords: 1, minPerPage: 2, reread: 5, personalBest: 10, timedRead: 10,
  weeklyGoal: 25, storyFinished: 20, warmupWord: 1,
  dailyGoal: 15,   // filling today's reading bar
  extraMinute: 2,  // each further full minute of reading that day
};
// Regular and often: a few minutes most days beats one long go a week.
export const DAILY_TARGET_MIN = 5;   // minutes of checked reading aloud that fill the day's bar
export const MAX_EXTRA_MINUTES = 15; // extra-minute Power stops after this many, so it can't be farmed
export const WEEKLY_TARGET = 3;      // days a week with the bar filled ("sessions")

// Each level has its own colour: warm gold at the start, through orange, to deep navy at the top.
export const LEVELS = [
  { level: 1, name: 'Spark', min: 0, color: '#E8B33A' },
  { level: 2, name: 'Charge', min: 100, color: '#E09A2E' },
  { level: 3, name: 'Boost', min: 250, color: '#EE7E32' },
  { level: 4, name: 'Surge', min: 500, color: '#E0612B' },
  { level: 5, name: 'Power', min: 800, color: '#C2463A' },
  { level: 6, name: 'Turbo', min: 1200, color: '#8E3A6E' },
  { level: 7, name: 'Lightning', min: 1700, color: '#3D4F9A' },
  { level: 8, name: 'Power Reader', min: 2300, color: '#0C5076' },
];
export type Level = (typeof LEVELS)[number];

export type BadgeId = 'first-page' | 'perfect-page' | 'story-finished' | 'personal-best' | 're-reader'
  | 'goal-week' | 'streak-3' | 'sessions-10' | 'word-fixer';

export const BADGES: { id: BadgeId; name: string; how: string }[] = [
  { id: 'first-page', name: 'First page', how: 'Read your first page aloud' },
  { id: 'perfect-page', name: 'Perfect page', how: 'Read every word on a page correctly' },
  { id: 'story-finished', name: 'Story finished', how: 'Read every page of a story aloud' },
  { id: 'personal-best', name: 'Personal best', how: 'Beat your best on a re-read' },
  { id: 're-reader', name: 'Re-reader', how: 'Do 5 re-reads' },
  { id: 'goal-week', name: 'Goal week', how: 'Fill your reading bar on 3 days in one week' },
  { id: 'streak-3', name: '3-week streak', how: 'Hit your weekly goal 3 weeks running' },
  { id: 'sessions-10', name: '10 sessions', how: 'Fill your reading bar on 10 days' },
  { id: 'word-fixer', name: 'Word fixer', how: 'Get 10 warm-up words right' },
];

// ---------- dates ----------

/** Local calendar day, YYYY-MM-DD. */
export function dayKey(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
/** The Monday that starts the week containing this date, YYYY-MM-DD. */
export function weekKey(iso: string): string {
  const d = new Date(iso);
  const monday = new Date(d.getFullYear(), d.getMonth(), d.getDate() - ((d.getDay() + 6) % 7));
  return dayKey(monday.toISOString().slice(0, 10) + 'T12:00:00');
}
function previousWeek(week: string): string {
  const [y, m, d] = week.split('-').map(Number);
  return dayKey(new Date(y, m - 1, d - 7, 12).toISOString());
}

// ---------- derived state ----------

export const totalPoints = (ev: ReadingEvent[]) => ev.reduce((s, e) => s + (e.type === 'points' ? e.amount : 0), 0);

export function levelFor(points: number) {
  let cur = LEVELS[0];
  for (const l of LEVELS) if (points >= l.min) cur = l;
  const next = LEVELS.find(l => l.min > points);
  return { ...cur, next, toNext: next ? next.min - points : 0, progress: next ? (points - cur.min) / (next.min - cur.min) : 1 };
}

/** Seconds of checked reading aloud in one event: counted page reads, counted re-reads and timed reads. */
export function readingSeconds(e: ReadingEvent): number {
  if (e.type === 'page' && e.verified) return e.durationSec;
  if (e.type === 'reread' && e.verified) return e.durationSec ?? 0;
  if (e.type === 'timed') return e.seconds ?? 60;
  return 0;
}

/** Seconds of checked reading aloud on each day. */
export function readingByDay(ev: ReadingEvent[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const e of ev) { const s = readingSeconds(e); if (s > 0) m.set(dayKey(e.date), (m.get(dayKey(e.date)) ?? 0) + s); }
  return m;
}

/** A day counts as a session once its reading bar is full: DAILY_TARGET_MIN minutes of checked reading aloud. */
export function sessionDays(ev: ReadingEvent[]): Set<string> {
  return new Set([...readingByDay(ev)].filter(([, s]) => s >= DAILY_TARGET_MIN * 60).map(([d]) => d));
}

export function sessionsInWeek(ev: ReadingEvent[], nowIso: string): number {
  const wk = weekKey(nowIso);
  return [...sessionDays(ev)].filter(d => weekKey(d + 'T12:00:00') === wk).length;
}

/** Weeks in a row the goal was hit. The current week only adds once its goal is met; holiday weeks are skipped. */
export function weekStreak(ev: ReadingEvent[], nowIso: string, holidays: string[] = []): number {
  const perWeek = new Map<string, number>();
  for (const d of sessionDays(ev)) { const w = weekKey(d + 'T12:00:00'); perWeek.set(w, (perWeek.get(w) ?? 0) + 1); }
  const met = (w: string) => (perWeek.get(w) ?? 0) >= WEEKLY_TARGET;
  let w = weekKey(nowIso), streak = 0;
  if (met(w)) streak++;
  w = previousWeek(w);
  for (let guard = 0; guard < 520; guard++) {
    if (holidays.includes(w)) { w = previousWeek(w); continue; }
    if (!met(w)) break;
    streak++; w = previousWeek(w);
  }
  return streak;
}

export function bestReread(ev: ReadingEvent[], storyId: string, page: number): number | undefined {
  let best: number | undefined;
  for (const e of ev) if (e.type === 'reread' && e.verified && e.storyId === storyId && e.page === page) best = Math.max(best ?? 0, e.wcpm);
  return best;
}

export const earnedBadges = (ev: ReadingEvent[]) => new Set(ev.filter(e => e.type === 'badge').map(e => (e as { id: BadgeId }).id));

/** Words to warm up on: recently misread, not yet got right twice in a warm-up. */
export function trickyWords(ev: ReadingEvent[], max = 5): string[] {
  const fixed = new Map<string, number>();
  for (const e of ev) if (e.type === 'warmup' && e.correct) fixed.set(e.word.toLowerCase(), (fixed.get(e.word.toLowerCase()) ?? 0) + 1);
  const out: string[] = [];
  for (let i = ev.length - 1; i >= 0 && out.length < max; i--) {
    const e = ev[i];
    const list = e.type === 'page' ? e.misread : e.type === 'timed' ? e.errorWords : [];
    for (const w of list) {
      const k = w.toLowerCase();
      if (k.length < 3 || (fixed.get(k) ?? 0) >= 2 || out.some(o => o.toLowerCase() === k)) continue;
      out.push(w); if (out.length >= max) break;
    }
  }
  return out;
}

// ---------- awarding ----------

export interface Award { points: { amount: number; reason: string }[]; badges: BadgeId[] }

/**
 * What a new event earns, given everything before it. Returns the extra 'points' and 'badge'
 * events to store alongside it.
 */
export function award(before: ReadingEvent[], e: ReadingEvent, ctx: { storyPages?: number; holidays?: string[] } = {}): Award {
  const pts: Award['points'] = [];
  const after = [...before, e];

  if (e.type === 'page' && e.verified) {
    pts.push({ amount: Math.max(POINTS.minPerPage, Math.round(e.words / 10) * POINTS.perTenWords), reason: `Read page ${e.page}` });
    if (ctx.storyPages && storyComplete(after, e.storyId, ctx.storyPages) && !storyComplete(before, e.storyId, ctx.storyPages)) {
      pts.push({ amount: POINTS.storyFinished, reason: 'Finished the story' });
    }
  }
  if (e.type === 'reread' && e.verified) {
    pts.push({ amount: POINTS.reread, reason: `Re-read page ${e.page}` });
    const prev = bestReread(before, e.storyId, e.page);
    if (prev !== undefined && e.wcpm > prev) pts.push({ amount: POINTS.personalBest, reason: 'New personal best' });
  }
  if (e.type === 'timed') pts.push({ amount: POINTS.timedRead, reason: 'Bonus timed read' });
  if (e.type === 'warmup' && e.correct) pts.push({ amount: POINTS.warmupWord, reason: `Practice word: ${e.word}` });

  // Today's reading bar: a bonus when it fills, then Power for each extra full minute (up to a cap).
  const secs = readingSeconds(e);
  if (secs > 0) {
    const target = DAILY_TARGET_MIN * 60;
    const was = readingByDay(before).get(dayKey(e.date)) ?? 0, now = was + secs;
    if (was < target && now >= target) pts.push({ amount: POINTS.dailyGoal, reason: "Filled today's reading bar" });
    const extra = (t: number) => Math.min(MAX_EXTRA_MINUTES, Math.max(0, Math.floor((t - target) / 60)));
    const more = extra(now) - extra(was);
    if (more > 0) pts.push({ amount: more * POINTS.extraMinute, reason: `Extra reading: ${more} more minute${more === 1 ? '' : 's'}` });
  }

  // Weekly goal, once per week.
  const wk = weekKey(e.date);
  const goalAlready = before.some(x => x.type === 'points' && x.reason === 'Weekly goal' && weekKey(x.date) === wk);
  if (!goalAlready && sessionsInWeek(after, e.date) >= WEEKLY_TARGET) pts.push({ amount: POINTS.weeklyGoal, reason: 'Weekly goal' });

  // Badges
  const have = earnedBadges(before);
  const badges: BadgeId[] = [];
  const add = (id: BadgeId, cond: boolean) => { if (cond && !have.has(id)) badges.push(id); };
  const verifiedPages = after.filter(x => x.type === 'page' && x.verified);
  add('first-page', verifiedPages.length >= 1);
  add('perfect-page', e.type === 'page' && e.verified && e.accuracy === 1);
  add('story-finished', !!ctx.storyPages && e.type === 'page' && storyComplete(after, e.storyId, ctx.storyPages));
  add('personal-best', pts.some(p => p.reason === 'New personal best'));
  add('re-reader', after.filter(x => x.type === 'reread' && x.verified).length >= 5);
  add('goal-week', pts.some(p => p.reason === 'Weekly goal') || before.some(x => x.type === 'points' && x.reason === 'Weekly goal'));
  add('sessions-10', sessionDays(after).size >= 10);
  add('word-fixer', after.filter(x => x.type === 'warmup' && x.correct).length >= 10);
  const withGoal = [...after, ...pts.map(p => ({ type: 'points' as const, date: e.date, ...p }))];
  add('streak-3', weekStreak(withGoal, e.date, ctx.holidays) >= 3);

  return { points: pts, badges };
}

function storyComplete(ev: ReadingEvent[], storyId: string, pages: number): boolean {
  const read = new Set(ev.filter(x => x.type === 'page' && x.verified && x.storyId === storyId).map(x => (x as { page: number }).page));
  return read.size >= pages;
}
