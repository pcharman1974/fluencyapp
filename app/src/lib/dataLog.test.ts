import { describe, it, expect } from 'vitest';
import { logRows, toCsv } from './dataLog';
import { checkDetail, checkPage } from './verify';
import type { ReadingEvent } from './rewards';
import type { Attempt } from '../types';

const heard = (text: string, secs: number) => ({ words: text.split(' ').map(w => ({ text: w })), durationSec: secs, provider: 'demo' });

describe('QA data log', () => {
  const c = checkPage('The stones stood in a long row', heard('The stones stood in a lung row', 4), 4);
  const ev: ReadingEvent[] = [
    { type: 'reread', date: '2026-10-05T10:00:00.000Z', storyId: 's', page: 3, verified: c.verified, ...checkDetail(c, 'demo') },
    { type: 'points', date: '2026-10-05T10:00:00.000Z', amount: 5, reason: 'Re-read page 3' },
    { type: 'warmup', date: '2026-10-05T09:00:00.000Z', word: 'quarried', correct: true },
  ];
  const attempts: Attempt[] = [{ readerCode: 'A1', storyId: 's', date: '2026-10-05T11:00:00.000Z', method: 'adult', seconds: 60, wordsRead: 80, errors: 3, wcpm: 77, accuracy: 0.9625, errorWords: ['excavated', 'say "hi", then'] }];

  it('keeps the full check with a re-read', () => {
    expect(ev[0]).toMatchObject({ words: 7, coverage: c.coverage, accuracy: c.accuracy, wpm: c.wpm, wcpm: c.wcpm, misread: c.misread, checkedBy: 'demo', message: c.message });
    expect(c.misread).toContain('long');
  });
  it('lists newest first, reading before the Power it earned', () => {
    expect(logRows(ev, attempts).map(r => r.kind)).toEqual(['marking', 'reread', 'points', 'warmup']);
  });
  it('explains a read in plain English', () => {
    const r = logRows(ev, []).find(r => r.kind === 'reread')!;
    expect(r.what).toBe('Page 3');
    expect(r.details.join(' · ')).toContain('Misread long');
    expect(r.details.join(' · ')).toContain('demo check');
  });
  it('writes one CSV row per record, quoting awkward text', () => {
    const csv = toCsv(logRows(ev, attempts).map(row => ({ readerCode: 'A1', row })));
    const lines = csv.split('\n');
    expect(lines).toHaveLength(5);
    expect(lines[0].startsWith('readerCode,date,type')).toBe(true);
    expect(csv).toContain('timed-marking');
    expect(csv).toContain('"excavated; say ""hi"", then"');
  });
});
