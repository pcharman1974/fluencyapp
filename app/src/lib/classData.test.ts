import { describe, it, expect } from 'vitest';
import { fromServer, mergeClass } from './classData';
import type { ReadingEvent } from './rewards';

const page = (date: string): ReadingEvent => ({ type: 'page', date, storyId: 's', page: 1, verified: true, coverage: 1, accuracy: 1, words: 80, durationSec: 60, misread: [] });

describe('whole-class data', () => {
  const raw = {
    '1234': [
      { kind: 'created', readerCode: '1234', date: '2026-10-05T08:00:00Z' },
      { kind: 'event', ...page('2026-10-05T09:00:00Z'), readerCode: '1234', receivedAt: 'x', batchId: 'abc12345' },
      { kind: 'event', type: 'diag', what: 'model-reading-fallback', date: '2026-10-05T09:01:00Z', readerCode: '1234' },
      { kind: 'attempt', readerCode: '1234', storyId: 's', date: '2026-10-05T09:05:00Z', method: 'speech', seconds: 60, wordsRead: 80, errors: 2, wcpm: 78, accuracy: 0.975, errorWords: [] },
    ],
  };
  it('reads server rows as events and markings, skipping bookkeeping', () => {
    const s = fromServer(raw as never);
    expect(s['1234'].events).toEqual([page('2026-10-05T09:00:00Z')]);
    expect(s['1234'].attempts).toHaveLength(1);
  });
  it('merges device and server copies without duplicates, and keeps pupils seen only on one side', () => {
    const local = { '1234': { events: [page('2026-10-05T09:00:00Z'), page('2026-10-06T09:00:00Z')], attempts: [] }, '9999': { events: [page('2026-10-06T10:00:00Z')], attempts: [] } };
    const m = mergeClass(fromServer(raw as never), local);
    expect(m['1234'].events.map(e => e.date)).toEqual(['2026-10-05T09:00:00Z', '2026-10-06T09:00:00Z']);
    expect(m['1234'].attempts).toHaveLength(1);
    expect(Object.keys(m).sort()).toEqual(['1234', '9999']);
  });
});
