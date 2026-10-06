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
