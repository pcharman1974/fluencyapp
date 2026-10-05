import { describe, it, expect } from 'vitest';
import { award, levelFor, sessionsInWeek, weekStreak, weekKey, trickyWords, type ReadingEvent } from './rewards';
import { checkPage } from './verify';

const page = (date: string, p: number, extra: Partial<ReadingEvent> = {}): ReadingEvent =>
  ({ type: 'page', date, storyId: 's', page: p, verified: true, coverage: 1, accuracy: 0.95, words: 80, durationSec: 50, misread: [], ...extra } as ReadingEvent);

/** Apply events one by one, storing awards, like the app does. */
function run(events: ReadingEvent[], storyPages = 10): ReadingEvent[] {
  const out: ReadingEvent[] = [];
  for (const e of events) {
    const a = award(out, e, { storyPages });
    out.push(e, ...a.points.map(p => ({ type: 'points' as const, date: e.date, ...p })), ...a.badges.map(id => ({ type: 'badge' as const, date: e.date, id })));
  }
  return out;
}

describe('weeks', () => {
  it('starts weeks on Monday', () => {
    expect(weekKey('2026-10-05T10:00:00')).toBe('2026-10-05'); // Monday
    expect(weekKey('2026-10-11T10:00:00')).toBe('2026-10-05'); // Sunday
    expect(weekKey('2026-10-12T10:00:00')).toBe('2026-10-12');
  });
});

describe('points and goals', () => {
  it('gives page points by length and the first-page badge', () => {
    const a = award([], page('2026-10-05T10:00:00', 1));
    expect(a.points).toEqual([{ amount: 8, reason: 'Read page 1' }]);
    expect(a.badges).toEqual(['first-page']);
  });
  it('gives nothing for an unverified page', () => {
    expect(award([], page('2026-10-05T10:00:00', 1, { verified: false })).points).toEqual([]);
  });
  it('counts a session as 2+ checked pages in a day and awards the weekly goal once at 3', () => {
    const ev = run([
      page('2026-10-05T10:00:00', 1), page('2026-10-05T10:05:00', 2),
      page('2026-10-07T10:00:00', 3), page('2026-10-07T10:05:00', 4),
      page('2026-10-09T10:00:00', 5), page('2026-10-09T10:05:00', 6),
      page('2026-10-09T10:10:00', 7),
    ]);
    expect(sessionsInWeek(ev, '2026-10-09T12:00:00')).toBe(3);
    expect(ev.filter(e => e.type === 'points' && e.reason === 'Weekly goal')).toHaveLength(1);
    expect(ev.some(e => e.type === 'badge' && e.id === 'goal-week')).toBe(true);
  });
  it('rewards a personal best only when beating an earlier re-read', () => {
    const ev = run([
      { type: 'reread', date: '2026-10-05T10:00:00', storyId: 's', page: 2, verified: true, wcpm: 70 },
      { type: 'reread', date: '2026-10-06T10:00:00', storyId: 's', page: 2, verified: true, wcpm: 68 },
      { type: 'reread', date: '2026-10-07T10:00:00', storyId: 's', page: 2, verified: true, wcpm: 81 },
    ]);
    expect(ev.filter(e => e.type === 'points' && e.reason === 'New personal best')).toHaveLength(1);
  });
  it('awards story finished when every page is checked', () => {
    const ev = run([1, 2, 3].map(p => page('2026-10-05T10:00:00', p)), 3);
    expect(ev.some(e => e.type === 'points' && e.reason === 'Finished the story')).toBe(true);
    expect(ev.some(e => e.type === 'badge' && e.id === 'story-finished')).toBe(true);
  });
});

describe('streaks', () => {
  const goalWeek = (monday: string) => [0, 2, 4].map(d => ({ type: 'timed' as const, date: new Date(new Date(monday + 'T10:00:00').getTime() + d * 864e5).toISOString(), storyId: 's', wcpm: 80, errorWords: [] }));
  it('counts consecutive goal weeks and skips holiday weeks', () => {
    const ev = [...goalWeek('2026-09-14'), ...goalWeek('2026-09-21'), ...goalWeek('2026-10-05')];
    expect(weekStreak(ev, '2026-10-06T12:00:00')).toBe(1);                 // gap week 28 Sep breaks it
    expect(weekStreak(ev, '2026-10-06T12:00:00', ['2026-09-28'])).toBe(3); // unless it was a holiday
  });
  it('does not break the streak for a week still in progress', () => {
    const ev = [...goalWeek('2026-09-21'), ...goalWeek('2026-09-28')];
    expect(weekStreak(ev, '2026-10-06T12:00:00')).toBe(2);
  });
});

describe('levels and tricky words', () => {
  it('works out level and progress', () => {
    expect(levelFor(0)).toMatchObject({ level: 1, toNext: 100 });
    expect(levelFor(260)).toMatchObject({ level: 3, name: 'Boost', toNext: 240 });
  });
  it('drops a tricky word after two correct warm-ups', () => {
    const ev: ReadingEvent[] = [
      page('2026-10-05T10:00:00', 1, { misread: ['archaeologists', 'it'] }),
      { type: 'warmup', date: '2026-10-06T10:00:00', word: 'archaeologists', correct: true },
    ];
    expect(trickyWords(ev)).toEqual(['archaeologists']); // 'it' too short to bother
    ev.push({ type: 'warmup', date: '2026-10-07T10:00:00', word: 'archaeologists', correct: true });
    expect(trickyWords(ev)).toEqual([]);
  });
});

describe('checkPage', () => {
  const text = 'Easter Island lies in the Pacific Ocean, off the west coast of Chile. It is known the world over for its statues.';
  const all = text.split(' ').map(t => ({ text: t }));
  it('verifies a full reading at a normal pace', () => {
    const c = checkPage(text, { words: all, provider: 't' }, 15);
    expect(c).toMatchObject({ verified: true, coverage: 1, accuracy: 1 });
  });
  it('rejects half a page', () => {
    const c = checkPage(text, { words: all.slice(0, 10), provider: 't' }, 8);
    expect(c.verified).toBe(false);
    expect(c.message).toMatch(/about 45%/);
  });
  it('rejects silence and impossibly fast reading', () => {
    expect(checkPage(text, { words: [], provider: 't' }, 10).verified).toBe(false);
    expect(checkPage(text, { words: all, provider: 't' }, 2).verified).toBe(false);
  });
  it('lists misread words for warm-ups', () => {
    const w = [...all]; w[9] = { text: 'waste' }; // 'west'
    expect(checkPage(text, { words: w, provider: 't' }, 15).misread).toEqual(['west']);
  });
});

import { summarise, sortForTeacher } from './teacher';
import { exampleClass } from './exampleData';

describe('teacher summary', () => {
  const now = '2026-10-09T15:00:00'; // Friday
  it('summarises a week of use', () => {
    const ev = run([
      page('2026-10-05T10:00:00', 1), page('2026-10-05T10:05:00', 2),
      page('2026-10-07T10:00:00', 3, { verified: false }), page('2026-10-07T10:03:00', 3), page('2026-10-07T10:06:00', 4),
    ]);
    const s = summarise('7B-14', ev, now, []);
    expect(s).toMatchObject({ sessionsThisWeek: 2, status: 'behind', pagesThisWeek: 4, checksThisWeek: 5, failedThisWeek: 1 });
    expect(s.minutesThisWeek).toBe(3); // 4 pages x 50s
    expect(s.weeks.at(-1)).toMatchObject({ week: '2026-10-05', sessions: 2 });
  });
  it('flags pupils who have not started or keep failing checks, and marks holiday weeks', () => {
    expect(summarise('A', [], now, []).needsAttention).toBe(true);
    expect(summarise('A', [], now, ['2026-10-05'])).toMatchObject({ status: 'holiday', needsAttention: false });
    const fails = run([1, 2, 3, 4].map(p => page('2026-10-06T10:00:00', p, { verified: p > 2 })));
    expect(summarise('B', fails, now, []).needsAttention).toBe(true);
  });
  it('sorts pupils needing attention first', () => {
    const list = sortForTeacher([summarise('ON', run([1, 2, 3, 4, 5, 6].map(p => page(`2026-10-0${5 + (p % 3) * 2}T10:0${p}:00`, p))), now, []), summarise('NONE', [], now, [])]);
    expect(list.map(s => s.code)).toEqual(['NONE', 'ON']);
  });
  it('builds a consistent example class', () => {
    const c = exampleClass(new Date('2026-10-09T15:00:00'));
    expect(c).toHaveLength(6);
    const ex1 = summarise('EX-01', c[0].events, now, []);
    expect(ex1.weeks.slice(0, 7).every(w => w.sessions === 3)).toBe(true);
    expect(ex1.power).toBeGreaterThan(0);
  });
});
