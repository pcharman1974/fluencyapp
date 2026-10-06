// Splitting story text into words for reading, marking and scoring.

export interface Token {
  index: number;
  display: string; // exactly as printed, punctuation included
  norm: string;    // lower case, punctuation removed, for matching speech
  page: number;
}

export function normalise(word: string): string {
  const n = word
    .toLowerCase()
    .replace(/[’‘`]/g, "'")
    .replace(/(\d),(\d)/g, '$1$2')       // 5,000 -> 5000
    .replace(/^[^a-z0-9]+|[^a-z0-9]+$/g, '') // strip leading/trailing punctuation
    .replace(/([a-z])\.(?=[a-z])/g, '$1')  // F.C. -> fc
    .replace(/'s$/, 's')
    .replace(/'/g, '');
  return n === 'ok' ? 'okay' : n; // printed "OK" and "okay" are the same word read aloud
}

export function tokenise(text: string, page = 0, startIndex = 0): Token[] {
  // A dash or other punctuation standing on its own isn't read aloud: it joins the word before it.
  const parts: string[] = [];
  for (const w of text.split(/\s+/).filter(Boolean)) {
    if (!normalise(w) && parts.length) parts[parts.length - 1] += ' ' + w;
    else parts.push(w);
  }
  return parts.map((display, i) => ({ index: startIndex + i, display, norm: normalise(display), page }));
}

export function tokenisePages(pages: { page: number; text: string }[]): Token[] {
  const out: Token[] = [];
  for (const p of pages) out.push(...tokenise(p.text, p.page, out.length));
  return out;
}
