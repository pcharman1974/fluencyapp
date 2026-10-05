import { describe, it, expect } from 'vitest';
import { fluencyByDay, fluencySummary, levelLines, pageWcpm, powerByDay } from './progress';
import type { ReadingEvent } from './rewards';

const page = (date: string, extra: Partial<ReadingEvent> = {}): ReadingEvent =>
  ({ type: 'page', date, storyId: 's', page: 1, verified: true, coverage: 1, accuracy: 1, words: 60, durationSec: 60, misread: [], ...extra } as ReadingEvent);

describe('page WCPM', () => {
  it('uses the stored value when there is one', () => {
    expect(pageWcpm(page('2026-10-05T10:00:00', { wcpm: 71 }) as Extract<ReadingEvent, { type: 'page' }>)).toBe(71);
  });
  it('estimates older reads from words heard and read correctly', () => {
    // 100 words, 90% heard, 90% of those correct, in 60 seconds: 81 correct a minute.
    const e = page('2026-10-05T10:00:00', { words: 100, coverage: 0.9, accuracy: 0.9, durationSec: 60 }) as Extract<ReadingEvent, { type: 'page' }>;
    expect(pageWcpm(e)).toBe(81);
  });
});

describe('fluency by day', () => {
  const ev: ReadingEvent[] = [
    page('2026-10-05T10:00:00', { wcpm: 60 }),
    page('2026-10-05T10:05:00', { wcpm: 70 }),
    page('2026-10-05T10:10:00', { wcpm: 10, verified: false }), // failed checks don't count
    { type: 'reread', date: '2026-10-05T10:20:00', storyId: 's', page: 1, verified: true, wcpm: 80 },
    { type: 'reread', date: '2026-10-05T10:25:00', storyId: 's', page: 2, verified: true, wcpm: 84 },
    { type: 'timed', date: '2026-10-07T10:00:00', storyId: 's', wcpm: 66, errorWords: [] },
    page('2026-10-07T10:00:00', { wcpm: 50, storyId: 'other' }),
    { type: 'points', date: '2026-10-07T10:00:00', amount: 10, reason: 'Timed read' },
  ];
  it('averages checked page reads and keeps the best re-read per day', () => {
    expect(fluencyByDay(ev, 's')).toEqual([
      { day: '2026-10-05', pages: 2, pageAvg: 65, reread: 84, timed: undefined },
      { day: '2026-10-07', pages: 0, pageAvg: undefined, reread: undefined, timed: 66 },
    ]);
  });
  it('summarises best and latest', () => {
    const s = fluencySummary(fluencyByDay(ev, 's'));
    expect(s).toMatchObject({ firstTimed: 66, latestTimed: 66, bestTimed: 66, bestReread: 84 });
    expect(s.pageChange).toBeUndefined(); // not enough weeks yet
  });
  it('compares the first and latest week of page reads once there are two weeks or more', () => {
    const many = [0, 2, 4, 14, 16, 18].map((d, i) => page(new Date(2026, 9, 5 + d, 10).toISOString(), { wcpm: i < 3 ? 60 : 72 }));
    expect(fluencySummary(fluencyByDay(many)).pageChange).toEqual({ from: 60, to: 72 });
  });
});

describe('power by day', () => {
  it('totals Power per day with a running total and level', () => {
    const ev: ReadingEvent[] = [
      { type: 'points', date: '2026-10-05T10:00:00', amount: 60, reason: 'a' },
      { type: 'points', date: '2026-10-05T11:00:00', amount: 30, reason: 'b' },
      { type: 'points', date: '2026-10-06T10:00:00', amount: 20, reason: 'c' },
    ];
    expect(powerByDay(ev)).toEqual([
      { day: '2026-10-05', earned: 90, total: 90, level: 1 },
      { day: '2026-10-06', earned: 20, total: 110, level: 2 },
    ]);
  });
  it('draws the levels reached plus the next one', () => {
    expect(levelLines(110).map(l => l.name)).toEqual(['Charge', 'Boost']);
    expect(levelLines(0).map(l => l.name)).toEqual(['Charge']);
  });
});
