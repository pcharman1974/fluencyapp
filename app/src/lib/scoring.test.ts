import { describe, it, expect } from 'vitest';
import { scoreReading, alignHeard, errorsFromAlignment } from './scoring';
import { tokenise, normalise } from './text';

const ref = tokenise('Stonehenge is one of England’s most famous mysteries. Located in Wiltshire, it is made up of 5,000 stones.');
const heard = (s: string) => s.split(' ').map(text => ({ text }));

describe('normalise', () => {
  it('handles punctuation, curly apostrophes and numbers', () => {
    expect(normalise('England’s')).toBe('englands');
    expect(normalise('mysteries.')).toBe('mysteries');
    expect(normalise('5,000')).toBe('5000');
    expect(normalise('‘walked’')).toBe('walked');
  });
});

describe('scoreReading', () => {
  it('computes WCPM over one minute', () => {
    const r = scoreReading(89, [3, 10, 50], 60); // 90 words, 3 errors
    expect(r).toMatchObject({ wordsRead: 90, errors: 3, wordsCorrect: 87, wcpm: 87 });
    expect(r.accuracy).toBeCloseTo(87 / 90);
  });
  it('scales when the reader finishes early', () => {
    expect(scoreReading(59, [], 45).wcpm).toBe(80);
  });
  it('ignores errors marked after the last word read and duplicates', () => {
    expect(scoreReading(9, [2, 2, 15], 60).errors).toBe(1);
  });
  it('handles nothing read', () => {
    expect(scoreReading(-1, [], 60)).toMatchObject({ wordsRead: 0, wcpm: 0, accuracy: 0 });
  });
});

describe('alignHeard', () => {
  it('scores a perfect partial reading without charging for the unread rest', () => {
    const a = alignHeard(ref, heard('stonehenge is one of englands most'));
    expect(a.lastWordIndex).toBe(5);
    expect(errorsFromAlignment(a)).toEqual([]);
  });
  it('finds a misread word and a skipped word', () => {
    const a = alignHeard(ref, heard('stonehenge is one of english famous mysteries'));
    // "England's" misread as "english", "most" skipped
    const errs = a.words.filter(w => w.status !== 'correct').map(w => [w.refIndex, w.status]);
    expect(errs).toEqual([[4, 'misread'], [5, 'skipped']]);
    expect(a.lastWordIndex).toBe(7);
  });
  it('does not count an extra word as an error', () => {
    const a = alignHeard(ref, heard('stonehenge is um one of'));
    expect(a.insertions).toEqual(['um']);
    expect(errorsFromAlignment(a)).toEqual([]);
    expect(a.lastWordIndex).toBe(3);
  });
  it('flags low-confidence correct words for checking without counting them', () => {
    const a = alignHeard(ref, [{ text: 'stonehenge', accuracyScore: 40 }, { text: 'is', accuracyScore: 95 }]);
    expect(a.words[0]).toMatchObject({ status: 'correct', check: true });
    expect(a.words[1].check).toBe(false);
  });
  it('returns nothing read for silence', () => {
    expect(alignHeard(ref, []).lastWordIndex).toBe(-1);
  });
});
