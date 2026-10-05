// Splitting story text into words for reading, marking and scoring.

export interface Token {
  index: number;
  display: string; // exactly as printed, punctuation included
  norm: string;    // lower case, punctuation removed, for matching speech
  page: number;
}

export function normalise(word: string): string {
  return word
    .toLowerCase()
    .replace(/[’‘`]/g, "'")
    .replace(/(\d),(\d)/g, '$1$2')       // 5,000 -> 5000
    .replace(/^[^a-z0-9]+|[^a-z0-9]+$/g, '') // strip leading/trailing punctuation
    .replace(/'s$/, 's')
    .replace(/'/g, '');
}

export function tokenise(text: string, page = 0, startIndex = 0): Token[] {
  return text
    .split(/\s+/)
    .filter(Boolean)
    .map((display, i) => ({ index: startIndex + i, display, norm: normalise(display), page }));
}

export function tokenisePages(pages: { page: number; text: string }[]): Token[] {
  const out: Token[] = [];
  for (const p of pages) out.push(...tokenise(p.text, p.page, out.length));
  return out;
}
