import { describe, expect, it } from 'vitest';
import { byPeriod, milestonesReached, nextMilestone, totals, wordsRead } from './milestones';
import { award, type ReadingEvent } from './rewards';

const page = (date: string, words: number, secs: number, verified = true, coverage = 1) =>
  ({ type: 'page', date, storyId: 's', page: 1, verified, coverage, accuracy: 1, words, durationSec: secs, misread: [] }) as ReadingEvent;

describe('reading counters', () => {
  it('counts words and seconds from accepted reads only', () => {
    expect(wordsRead(page('2026-10-06T10:00:00Z', 100, 60))).toBe(100);
    expect(wordsRead(page('2026-10-06T10:00:00Z', 100, 60, true, 0.9))).toBe(90);
    expect(wordsRead(page('2026-10-06T10:00:00Z', 100, 60, false))).toBe(0);
    expect(wordsRead({ type: 'timed', date: '2026-10-06T10:00:00Z', storyId: 's', wcpm: 90, errorWords: ['a', 'b'], seconds: 60 })).toBe(92);
    expect(wordsRead({ type: 'warmup', date: '2026-10-06T10:00:00Z', word: 'x', correct: true })).toBe(1);
    const ev = [page('2026-10-06T10:00:00Z', 100, 60), page('2026-10-06T10:05:00Z', 80, 50, false)];
    expect(totals(ev)).toEqual({ words: 100, seconds: 60 });
  });

  it('shows how far it is to the next milestone', () => {
    expect(nextMilestone({ words: 600, seconds: 0 }, 'words')).toMatchObject({ togo: 400, from: 250 });
    expect(nextMilestone({ words: 0, seconds: 45 * 60 }, 'minutes').next?.id).toBe('total-minutes-60');
  });

  it('groups by week with empty weeks back to the first reading', () => {
    const ev = [page('2026-09-22T10:00:00', 100, 60), page('2026-10-06T10:00:00', 50, 30)];
    const rows = byPeriod(ev, 'week', '2026-10-06T12:00:00', 10);
    expect(rows.map(r => r.words)).toEqual([100, 0, 50]);
  });
});

describe('milestone badges', () => {
  it('awards a total milestone once, when it is crossed', () => {
    const before = [page('2026-10-06T10:00:00Z', 200, 120)];
    expect(milestonesReached(before, page('2026-10-06T10:05:00Z', 60, 40))).toContain('total-words-250');
    const withBadge = [...before, page('2026-10-06T10:05:00Z', 60, 40), { type: 'badge', date: '2026-10-06T10:05:00Z', id: 'total-words-250' } as ReadingEvent];
    expect(milestonesReached(withBadge, page('2026-10-06T10:10:00Z', 60, 40))).not.toContain('total-words-250');
  });

  it('awards week milestones again in a new week', () => {
    const wk1 = [page('2026-09-29T10:00:00', 1000, 600), { type: 'badge', date: '2026-09-29T10:00:00', id: 'week-words-1000' } as ReadingEvent];
    expect(milestonesReached(wk1, page('2026-09-30T10:00:00', 100, 60))).not.toContain('week-words-1000');
    const wk2 = [...wk1, page('2026-10-06T10:00:00', 950, 500)];
    expect(milestonesReached(wk2, page('2026-10-07T10:00:00', 100, 60))).toContain('week-words-1000');
  });

  it('comes through the normal award, so the toast and badge records pick it up', () => {
    const a = award([page('2026-10-06T10:00:00Z', 240, 150)], page('2026-10-06T10:05:00Z', 20, 15));
    expect(a.badges).toContain('total-words-250');
  });
});
