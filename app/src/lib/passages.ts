// Unseen passages for the one-minute timed read. Reading a page you have practised gives a higher
// score than reading new text, so the timed read uses a short passage the pupil hasn't read before.
// The passages are drafts until the content team has checked and levelled them (see HANDOFF.md).
import data from '../../../content/timed-passages/passages.json';
import type { Story } from '../types';

export interface Passage { id: string; title: string; status: string; text: string }

export const PASSAGES: Passage[] = data.passages;
export const PASSAGES_STATUS: string = data.status;

/** The passage as a one-page story, so the reading screens can use it as they are. */
export const asStory = (p: Passage, from: Story): Story =>
  ({ ...from, id: p.id, title: p.title, vocabulary: [], glossary: {}, pages: [{ ...from.pages[0], page: 1, text: p.text }] });

/**
 * Next passage for a pupil, chosen at random from those they haven't read. Once they've read them all,
 * any passage except the one they read last time. `used` is the passage ids of their earlier timed
 * reads, oldest first.
 */
export function nextPassage(used: (string | undefined)[], list: Passage[] = PASSAGES, random: () => number = Math.random): Passage {
  const seen = new Set(used.filter(Boolean));
  const last = [...used].reverse().find(Boolean);
  let pool = list.filter(p => !seen.has(p.id));
  if (!pool.length) pool = list.filter(p => p.id !== last);
  if (!pool.length) pool = list;
  return pool[Math.floor(random() * pool.length) % pool.length];
}
