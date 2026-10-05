import { describe, it, expect } from 'vitest';
// @ts-ignore plain JS module shared with the generation script
import { fromCharacterTimes, fromWordBoundaries } from '../../scripts/audio-align.mjs';

const text = 'Easter Island lies in the Pacific Ocean.';

describe('fromCharacterTimes (ElevenLabs)', () => {
  it('gives one time per word', () => {
    const characters = [...text];
    const t = characters.map((_, i) => i * 0.05);
    const w = fromCharacterTimes(text, { characters, character_start_times_seconds: t, character_end_times_seconds: t.map(x => x + 0.05) });
    expect(w).toHaveLength(7);
    expect(w[0]).toEqual({ start: 0, end: 0.3 });     // "Easter" = chars 0-5
    expect(w[1].start).toBeCloseTo(0.35);             // "Island" starts at char 7
    expect(w[6].end).toBeCloseTo(2);                  // "Ocean." ends at char 39
  });
  it('refuses timing that does not match the text', () => {
    expect(() => fromCharacterTimes(text, { characters: ['a'], character_start_times_seconds: [0], character_end_times_seconds: [0.1] })).toThrow();
  });
});

describe('fromWordBoundaries (Azure)', () => {
  it('maps boundaries to words and fills a skipped word', () => {
    const b = [
      { textOffset: 0, start: 0, duration: 0.4 }, { textOffset: 7, start: 0.45, duration: 0.4 },
      { textOffset: 14, start: 0.9, duration: 0.3 }, /* "in" skipped */ { textOffset: 22, start: 1.4, duration: 0.2 },
      { textOffset: 26, start: 1.65, duration: 0.5 }, { textOffset: 34, start: 2.2, duration: 0.5 },
      { textOffset: 39, start: 2.7, duration: 0.05 }, // the full stop: part of "Ocean."
    ];
    const w = fromWordBoundaries(text, b);
    expect(w).toHaveLength(7);
    expect(w[3]).toEqual({ start: 1.2, end: 1.4 });   // gap between "lies" and "the"
    expect(w[6]).toEqual({ start: 2.2, end: 2.75 });
  });
});

// @ts-ignore plain JS module
import { spokenVersion, groupToPageWords } from '../../scripts/audio-align.mjs';
describe('spoken replacements', () => {
  it('says "4m" as "4 metres" and maps both spoken words back to the page word', () => {
    const v = spokenVersion('over 4m tall!', { '4m': '4 metres' });
    expect(v).toEqual({ text: 'over 4 metres tall!', counts: [1, 2, 1] });
    const times = [{ start: 0, end: .3 }, { start: .3, end: .5 }, { start: .5, end: .9 }, { start: .9, end: 1.2 }];
    expect(groupToPageWords(times, v.counts)).toEqual([{ start: 0, end: .3 }, { start: .3, end: .9 }, { start: .9, end: 1.2 }]);
  });
});

import { wordAt } from './pageAudio';
describe('wordAt', () => {
  const w = [{ start: 0.2, end: 0.5 }, { start: 0.6, end: 0.9 }, { start: 1.0, end: 1.4 }];
  it('finds the word being said', () => {
    expect(wordAt(w, 0.1)).toBe(-1);
    expect(wordAt(w, 0.2)).toBe(0);
    expect(wordAt(w, 0.95)).toBe(1); // in a gap: keep the last word lit
    expect(wordAt(w, 5)).toBe(2);
  });
});
