export interface StoryPage {
  page: number;
  heading: string;
  image: string;
  imageAlt: string;
  text: string;
  highlightedWords: string[];
  /** Harder words from this page, chosen by the content team, practised before reading it. */
  warmupWords?: string[];
}

export interface Story {
  id: string;
  title: string;
  author: string;
  coverImage: string;
  vocabulary: string[];
  glossary: Record<string, string>;
  pages: StoryPage[];
}

export interface Attempt {
  readerCode: string;
  storyId: string;
  date: string;      // ISO
  method: 'adult' | 'speech' | 'demo';
  seconds: number;
  wordsRead: number;
  errors: number;
  wcpm: number;
  accuracy: number;
  errorWords: string[];
  speechScores?: { fluency?: number; prosody?: number; pronunciation?: number };
}
