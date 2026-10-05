import { describe, it, expect } from 'vitest';
import { checkPage } from './verify';

const heard = (text: string) => ({ words: text.split(' ').map(t => ({ text: t })), durationSec: 5, provider: 'demo' });
const marks = (text: string, said: string) => checkPage(text, heard(said), 5).record
  .map(m => m.kind === 'ok' ? m.word : m.kind === 'sub' ? `${m.word}[said ${m.said}]` : m.kind === 'ins' ? `+${m.said}` : `${m.word}[${m.kind}]`).join(' ');

describe('running record', () => {
  it('marks substitutions, omissions and insertions in place', () => {
    expect(marks('The stones stood in a long row', 'The big stones in a lung row'))
      .toBe('The +big stones stood[omit] in a long[said lung] row');
  });
  it('marks words not reached when the reader stops early', () => {
    expect(marks('The stones stood in a long row', 'The stones stood')).toBe('The stones stood in[unread] a[unread] long[unread] row[unread]');
  });
  it('ignores chatter after the last word reached', () => {
    expect(marks('The stones stood', 'The stones stood okay done')).toBe('The stones stood');
  });
});
