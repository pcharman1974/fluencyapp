import { describe, expect, it } from 'vitest';
import { shelfStatus, STORIES } from './library';
import type { ReadingEvent } from './rewards';

const page = (storyId: string, p: number, verified = true) => ({ type: 'page', date: '2026-10-06T10:00:00Z', storyId, page: p, verified, coverage: 1, accuracy: 1, words: 80, durationSec: 40, misread: [] }) as ReadingEvent;

describe('library shelf', () => {
  it('counts checked pages once each, per story', () => {
    const info = STORIES[0];
    const ev = [page(info.id, 1), page(info.id, 1), page(info.id, 2), page(info.id, 3, false), page('other', 4)];
    expect(shelfStatus(ev, info)).toEqual({ read: 2, finished: false, started: true });
  });
  it('is finished when every page has been read', () => {
    const info = STORIES[0];
    const ev = Array.from({ length: info.pages }, (_, i) => page(info.id, i + 1));
    expect(shelfStatus(ev, info).finished).toBe(true);
  });
  it('lists page counts that match the story files', async () => {
    for (const s of STORIES) {
      const story = (await import(`../../../content/${s.id}/story.json`)).default;
      expect([s.id, story.pages.length, story.title]).toEqual([s.id, s.pages, s.title]);
    }
  });
});
