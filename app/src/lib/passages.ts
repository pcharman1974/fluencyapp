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
 * Next passage for a pupil: the first one they haven't read; once they've read them all, the one
 * read longest ago. `used` is the passage ids of their earlier timed reads, oldest first.
 */
export function nextPassage(used: (string | undefined)[], list: Passage[] = PASSAGES): Passage {
  const last = new Map<string, number>();
  used.forEach((id, i) => { if (id) last.set(id, i); });
  const fresh = list.find(p => !last.has(p.id));
  if (fresh) return fresh;
  return [...list].sort((a, b) => last.get(a.id)! - last.get(b.id)!)[0];
}
