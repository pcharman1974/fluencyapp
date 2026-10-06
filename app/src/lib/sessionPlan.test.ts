import { describe, expect, it } from 'vitest';
import { sessionPages } from './sessionPlan';
import type { Story } from '../types';

const story = (lengths: number[]) => ({ pages: lengths.map((n, i) => ({ page: i + 1, text: Array(n).fill('word').join(' ') })) }) as unknown as Story;

describe('session plan by words, not pages', () => {
  it('takes about 240 words of unread pages', () => {
    expect(sessionPages(story([80, 80, 80, 80]), new Set())).toEqual([1, 2, 3]);
    expect(sessionPages(story([116, 116, 116]), new Set())).toEqual([1, 2]); // a third would be 348 words
    expect(sessionPages(story([55, 100, 120, 60]), new Set())).toEqual([1, 2, 3]);
  });
  it('always gives at least one page, even a long one', () => {
    expect(sessionPages(story([400, 50]), new Set())).toEqual([1]);
  });
  it('skips pages already read, and starts again once all are read', () => {
    expect(sessionPages(story([80, 80, 80, 80]), new Set([1, 2]))).toEqual([3, 4]);
    expect(sessionPages(story([80, 80]), new Set([1, 2]))).toEqual([1, 2]);
  });
  it('never gives more than five short pages', () => {
    expect(sessionPages(story([30, 30, 30, 30, 30, 30, 30]), new Set())).toHaveLength(5);
  });
});

import { planSession, readStepDone, READ_STEP_SECONDS } from './sessionPlan';

describe('session plan by time', () => {
  it('plans up to six unread pages when today\'s bar is not full, and words when it is', () => {
    const s = story([80, 80, 80, 80, 80, 80, 80, 80]);
    expect(planSession(s, new Set([1]), 0)).toEqual({ pages: [2, 3, 4, 5, 6, 7], byTime: true });
    expect(planSession(s, new Set(), 5 * 60)).toEqual({ pages: [1, 2, 3], byTime: false });
  });
  it('ends the Read step after about four minutes, or when the planned pages run out', () => {
    expect(READ_STEP_SECONDS).toBe(240);
    expect(readStepDone(239, 2, 6)).toBe(false);
    expect(readStepDone(240, 2, 6)).toBe(true);
    expect(readStepDone(100, 6, 6)).toBe(true);
  });
});
