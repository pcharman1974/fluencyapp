import { describe, expect, it } from 'vitest';
import { compare, summarise } from './review';
import type { RecordMark } from './verify';

const rec: RecordMark[] = [
  { kind: 'ok', word: 'The' },
  { kind: 'ins', said: 'um' },
  { kind: 'sub', word: 'stones', said: 'stone' },
  { kind: 'ok', word: 'were' },
  { kind: 'omit', word: 'very' },
  { kind: 'ok', word: 'old' },
  { kind: 'unread', word: 'indeed' },
];

describe('marking review', () => {
  it('compares word by word over the words reached, ignoring added words', () => {
    // Adult: "stones" was fine (accent), "were" was wrong, "very" missed.
    expect(compare(rec, { wrong: [2, 3] })).toEqual({ words: 5, bothRight: 2, bothWrong: 1, falseAlarms: 1, missed: 1 });
  });

  it("uses the adult's view of where the pupil stopped", () => {
    expect(compare(rec, { wrong: [], stoppedAt: 5 }).words).toBe(6);
    expect(compare(rec, { wrong: [], stoppedAt: 1 })).toEqual({ words: 2, bothRight: 1, bothWrong: 0, falseAlarms: 1, missed: 0 });
  });

  it('summarises agreement and page decisions', () => {
    const s = summarise([
      { record: rec, review: { wrong: [1, 3], counted: true, date: '' }, appCounted: true, type: 'page' },
      { record: rec, review: { wrong: [], counted: true, date: '' }, appCounted: false, type: 'page' },
    ]);
    expect(s.reviewed).toBe(2);
    expect(s.agree.words).toBe(10);
    expect(s.agreement).toBeCloseTo(8 / 10); // first agrees on all 5; second has 2 false alarms
    expect(s.falseAlarmRate).toBeCloseTo(2 / 8);
    expect(s.missRate).toBe(0);
    expect(s.pages).toBe(2);
    expect(s.pageAgree).toBe(1);
    expect(s.tooStrict).toBe(1);
    expect(s.tooLenient).toBe(0);
  });
});
