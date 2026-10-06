// What to read in today's session. The daily goal is time (DAILY_TARGET_MIN minutes of reading aloud),
// so the Read step keeps going page by page until the pupil has read for long enough, and then moves on to
// "Your best reading", which normally fills the bar. A slow reader reads fewer pages, a quick reader more:
// both read for the same time. If today's bar is already full, a session is a set amount of text instead.
import type { Story } from '../types';
import { DAILY_TARGET_MIN } from './rewards';

export const SESSION_WORDS = 240;
/** The Read step stops once today's reading reaches this: about a minute short of the bar, left for "Your best reading". */
export const READ_STEP_SECONDS = Math.max(30, (DAILY_TARGET_MIN - 1) * 60);
export const MAX_SESSION_PAGES = 6;
const MAX_WORD_PAGES = 5;
const words = (text: string) => text.split(/\s+/).filter(w => /[\p{L}\p{N}]/u.test(w)).length;

/** The pages a session may use, in order: unread first (or the whole story again once finished). */
export function sessionQueue(story: Story, read: Set<number>): number[] {
  const unread = story.pages.filter(p => !read.has(p.page));
  return (unread.length ? unread : story.pages).map(p => p.page);
}

/** Next unread pages (or the whole story again once it's finished), about SESSION_WORDS long. */
export function sessionPages(story: Story, read: Set<number>, target = SESSION_WORDS): number[] {
  const out: number[] = [];
  let total = 0;
  for (const n of sessionQueue(story, read)) {
    const w = words(story.pages[n - 1].text);
    if (out.length && (total + w > target * 1.2 || out.length >= MAX_WORD_PAGES)) break;
    out.push(n);
    total += w;
    if (total >= target) break;
  }
  return out;
}

/** Plan for a session: time-based (keep reading until about 4 minutes today) or, if the bar is already full, word-based. */
export function planSession(story: Story, read: Set<number>, secondsToday: number): { pages: number[]; byTime: boolean } {
  if (secondsToday >= DAILY_TARGET_MIN * 60) return { pages: sessionPages(story, read), byTime: false };
  return { pages: sessionQueue(story, read).slice(0, MAX_SESSION_PAGES), byTime: true };
}

/** After a page is accepted: is that enough reading for the Read step? */
export const readStepDone = (secondsToday: number, pagesDone: number, pagesPlanned: number) =>
  pagesDone >= pagesPlanned || secondsToday >= READ_STEP_SECONDS;
