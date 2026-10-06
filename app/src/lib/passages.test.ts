import { describe, expect, it } from 'vitest';
import { nextPassage, PASSAGES } from './passages';

const list = ['a', 'b', 'c'].map(id => ({ id, title: '', status: '', text: '' }));
const ids = (used: (string | undefined)[], n = 300) => new Set(Array.from({ length: n }, () => nextPassage(used, list).id));

describe('bonus-read passages', () => {
  it('picks at random from the passages the pupil has not read', () => {
    expect(ids([])).toEqual(new Set(['a', 'b', 'c']));
    expect(ids([undefined, 'a'])).toEqual(new Set(['b', 'c']));
    expect(ids(['b', 'a'])).toEqual(new Set(['c']));
  });
  it('once all are read, picks at random but never the one just read', () => {
    expect(ids(['a', 'b', 'c'])).toEqual(new Set(['a', 'b']));
    expect(nextPassage(['a', 'b', 'c'], list, () => 0).id).toBe('a');
    expect(nextPassage(['a', 'b', 'c'], list, () => 0.99).id).toBe('b');
  });
  it('has ten passages of about 250 words', () => {
    expect(PASSAGES).toHaveLength(10);
    for (const p of PASSAGES) expect(p.text.split(/\s+/).length).toBeGreaterThanOrEqual(240);
    for (const p of PASSAGES) expect(p.text.split(/\s+/).length).toBeLessThanOrEqual(260);
  });
});
