import { describe, expect, it } from 'vitest';
import { nextPassage, PASSAGES } from './passages';

const list = [{ id: 'a', title: '', status: '', text: '' }, { id: 'b', title: '', status: '', text: '' }, { id: 'c', title: '', status: '', text: '' }];

describe('timed-read passages', () => {
  it('gives each pupil a passage they have not read', () => {
    expect(nextPassage([], list).id).toBe('a');
    expect(nextPassage([undefined, 'a'], list).id).toBe('b');
    expect(nextPassage(['b', 'a'], list).id).toBe('c');
  });
  it('once all are read, repeats the one read longest ago', () => {
    expect(nextPassage(['a', 'b', 'c'], list).id).toBe('a');
    expect(nextPassage(['a', 'b', 'c', 'a'], list).id).toBe('b');
  });
  it('has drafts long enough for a minute of fast reading', () => {
    expect(PASSAGES.length).toBeGreaterThanOrEqual(6);
    for (const p of PASSAGES) expect(p.text.split(/\s+/).length).toBeGreaterThanOrEqual(230);
  });
});
