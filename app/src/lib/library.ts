// The story shelf. Pupils choose what to read next; nothing is locked or in a set order.
import type { ReadingEvent } from './rewards';

export interface StoryInfo { id: string; title: string; author: string; pages: number; cover?: string; colour: string; topic: string }

/** Stories in /content (paths are relative, so they work on any host). The first is the default. */
export const STORIES: StoryInfo[] = [
  { id: 'secret-stones', title: 'Secret Stones', author: 'Elizabeth Charman', pages: 10, cover: 'images/00-cover.jpg', colour: '#7A5C3E', topic: 'History · Mysteries' },
  { id: 'womens-football', title: 'The History of Women’s Football', author: 'Latoyah Innerarity', pages: 15, colour: '#B4232A', topic: 'Sport · History' },
  { id: 'inclusive-design', title: 'Inclusive Design', author: 'Catherine Baker', pages: 14, colour: '#1D6FB0', topic: 'Design · Everyday life' },
  { id: 'inventions', title: 'Inventions That Changed The World', author: 'Catherine Baker', pages: 10, colour: '#2F6B3A', topic: 'Science · Inventions' },
  { id: 'windrush', title: 'The Windrush Generation', author: 'Latoyah Innerarity', pages: 14, colour: '#8A5A00', topic: 'History · People' },
  { id: 'carrot-girl', title: 'Carrot Girl', author: 'Catherine Baker', pages: 21, colour: '#D9631E', topic: 'Superheroes · Family' },
  { id: 'home-invasion', title: 'Home Invasion!', author: 'Ewan Shepherd', pages: 16, colour: '#2B4C7E', topic: 'Technology · Friendship' },
  { id: 'once-and-future-queen', title: 'The Once and Future Queen', author: 'Joel Pollen', pages: 20, colour: '#5B3A7A', topic: 'Legend · Adventure' },
];

export interface ShelfStatus { read: number; finished: boolean; started: boolean }

/** How far a reader has got: pages read aloud and checked (each unlocks a story card). */
export function shelfStatus(events: ReadingEvent[], info: StoryInfo): ShelfStatus {
  const read = new Set(events.filter(e => e.type === 'page' && e.verified && e.storyId === info.id).map(e => (e as { page: number }).page)).size;
  return { read, finished: read >= info.pages, started: read > 0 };
}
