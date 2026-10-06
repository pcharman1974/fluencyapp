// Pages for today's session. Stories have different page lengths (about 50 to 170 words), so a
// session is a set amount of reading, not a set number of pages: pages are taken in order until
// they add up to about SESSION_WORDS (three Secret Stones pages), never going more than 20% over.
import type { Story } from '../types';

export const SESSION_WORDS = 240;
const MAX_PAGES = 5;
const words = (text: string) => text.split(/\s+/).filter(w => /[\p{L}\p{N}]/u.test(w)).length;

/** Next unread pages (or the whole story again once it's finished), about SESSION_WORDS long. */
export function sessionPages(story: Story, read: Set<number>, target = SESSION_WORDS): number[] {
  const unread = story.pages.filter(p => !read.has(p.page));
  const queue = unread.length ? unread : story.pages;
  const out: number[] = [];
  let total = 0;
  for (const p of queue) {
    const n = words(p.text);
    if (out.length && (total + n > target * 1.2 || out.length >= MAX_PAGES)) break;
    out.push(p.page);
    total += n;
    if (total >= target) break;
  }
  return out;
}
