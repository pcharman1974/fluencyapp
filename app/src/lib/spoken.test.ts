import { describe, it, expect } from 'vitest';
import { sayNumber, mergeSpoken } from './spoken';
import { checkPage } from './verify';
import { tokenise } from './text';
import storyJson from '../../../content/secret-stones/story.json?raw';
import footballJson from '../../../content/womens-football/story.json?raw';
import inclusiveJson from '../../../content/inclusive-design/story.json?raw';
import queenJson from '../../../content/once-and-future-queen/story.json?raw';
import inventionsJson from '../../../content/inventions/story.json?raw';
import windrushJson from '../../../content/windrush/story.json?raw';
import carrotJson from '../../../content/carrot-girl/story.json?raw';
import homeJson from '../../../content/home-invasion/story.json?raw';

const heard = (t: string) => ({ words: t.split(' ').map(text => ({ text })), durationSec: 5, provider: 'azure' });
const misread = (text: string, said: string) => checkPage(text, heard(said), 5).misread;

describe('saying numbers', () => {
  it('knows British, American and year forms', () => {
    expect(sayNumber(250)).toEqual(expect.arrayContaining(['two hundred and fifty', 'two hundred fifty']));
    expect(sayNumber(1500)).toEqual(expect.arrayContaining(['one thousand five hundred', 'one thousand and five hundred', 'fifteen hundred']));
    expect(sayNumber(1996)).toContain('nineteen ninety six');
    expect(sayNumber(1906)).toContain('nineteen oh six');
    expect(sayNumber(11000)).toContain('eleven thousand');
    expect(sayNumber(2000)).toContain('two thousand');
  });
});

describe('marking spoken forms as correct', () => {
  it('accepts numbers said in words', () => {
    expect(misread('In the 1960s, archaeologists', 'in the nineteen sixties archaeologists')).toEqual([]);
    expect(misread('about 11,000 years old', 'about eleven thousand years old')).toEqual([]);
    expect(misread('took about 1,500 years', 'took about fifteen hundred years')).toEqual([]);
    expect(misread('In 1996, divers', 'in nineteen ninety-six divers')).toEqual([]);
    expect(misread('over 4m tall', 'over four metres tall')).toEqual([]);
    expect(misread('weigh 40 tonnes', 'weigh forty tonnes')).toEqual([]);
    expect(misread('over 200 miles', 'over two hundred miles')).toEqual([]);
  });
  it('accepts hyphenated words said as two', () => {
    expect(misread('In modern-day Turkey', 'in modern day turkey')).toEqual([]);
    expect(misread('in north-west France', 'in north-west france')).toEqual([]);
  });
  it('still marks a wrong number wrong', () => {
    expect(misread('about 11,000 years', 'about eleven hundred years').length).toBeGreaterThan(0);
  });
  it('keeps the first word time when merging', () => {
    const ref = tokenise('the 1960s were');
    const m = mergeSpoken(ref, [{ text: 'the', startSec: 0 }, { text: 'nineteen', startSec: 1 }, { text: 'sixties', startSec: 1.5 }, { text: 'were', startSec: 2 }]);
    expect(m.map(w => w.text)).toEqual(['the', '1960s', 'were']);
    expect(m[1].startSec).toBe(1);
  });
});

describe('Secret Stones read aloud perfectly, as a speech service writes it down', () => {
  it('marks every page 100% correct', async () => {
    const story = JSON.parse(storyJson);
    const { spokenForms } = await import('./spoken');
    for (const p of story.pages) {
      // How Azure's word list looks: numbers in words, hyphenated words split, no punctuation.
      const said = (p.text as string).split(/\s+/).flatMap((w: string) => {
        const f = spokenForms(w)[0];
        if (f) return f;
        const n = w.replace(/[^0-9]/g, '');
        if (n && /^[\d,.]+$/.test(w.replace(/[^\d,.]/g, '')) && sayNumber(Number(n)).length) return sayNumber(Number(n))[0].split(' ');
        return [w.replace(/[‘’"“”.,!?;:()…]/g, '')];
      }).filter(Boolean).join(' ');
      const c = checkPage(p.text, heard(said), 40);
      expect({ page: p.page, misread: c.misread, accuracy: c.accuracy }).toEqual({ page: p.page, misread: [], accuracy: 1 });
    }
  });
});

describe("The History of Women's Football read aloud perfectly", () => {
  // How a speech service writes down a good reading: numbers, money, letters and abbreviations in words.
  const SAID: Record<string, string> = {
    '2022': 'twenty twenty two', '80,000': 'eighty thousand', '20': 'twenty', '17': 'seventeen', '1': 'one',
    '1966': 'nineteen sixty six', '56': 'fifty six', '1895.': 'eighteen ninety five', '30': 'thirty', '11,000': 'eleven thousand',
    'F.C.': 'f c', '800': 'eight hundred', '50': 'fifty', '746!': 'seven hundred and forty six', '900': 'nine hundred',
    '30-year': 'thirty year', '10,000': 'ten thousand', '£600': 'six hundred pounds', '£43,000': 'forty three thousand pounds',
    '2': 'two', '1920': 'nineteen twenty', '£3,000': 'three thousand pounds', '(approx.': 'approximately',
    '£140,000': 'a hundred and forty thousand pounds', '53,000': 'fifty three thousand', '(FA)': 'f a', 'FA': 'f a', 'FA.': 'f a',
    'FA’s': "f a's", '1921': 'nineteen twenty one', 'II': 'two', '1964,': 'nineteen sixty four', '13': 'thirteen',
    '1969,': 'nineteen sixty nine', '(WFA).': 'w f a', 'WFA': 'w f a', '1971,': 'nineteen seventy one', '1991.': 'nineteen ninety one',
    '12': 'twelve', '6': 'six', 'USA': 'u s a', '2005,': 'two thousand and five', 'TV': 't v', '2011,': 'twenty eleven',
    '2023.': 'twenty twenty three', 'Ms': 'miss',
  };
  it('marks every page 100% correct', () => {
    const story = JSON.parse(footballJson);
    for (const p of story.pages) {
      const said = (p.text as string).split(/\s+/).map((w: string) => SAID[w] ?? SAID[w.replace(/[,.]$/, '')] ?? w.replace(/’/g, "'").replace(/[‘"“”.,!?;:()…–-]/g, ' ')).join(' ').split(/\s+/).filter(Boolean).join(' ');
      const c = checkPage(p.text, heard(said), 40);
      expect({ page: p.page, misread: c.misread, accuracy: c.accuracy }).toEqual({ page: p.page, misread: [], accuracy: 1 });
    }
  });
});

describe.each([['Inclusive Design', inclusiveJson], ['The Once and Future Queen', queenJson], ['Inventions That Changed The World', inventionsJson], ['The Windrush Generation', windrushJson], ['Carrot Girl', carrotJson], ['Home Invasion!', homeJson]])('%s read aloud perfectly', (_name, json) => {
  it('marks every page 100% correct', () => {
    for (const p of JSON.parse(json).pages) {
      const said = (p.text as string).replace('COVID-19', 'covid nineteen').replace(/\b12\b/, 'twelve').replace(/\b10\b/, 'ten').replace(/\b15\b/, 'fifteen').replace(/\b20\b/, 'twenty').replace(/\b150\b/g, 'a hundred and fifty').replace('1873', 'eighteen seventy three').replace('1968', 'nineteen sixty eight').replace('1980,', 'nineteen eighty').replace('1948', 'nineteen forty eight').replace('1965', 'nineteen sixty five').replace('1930s', 'nineteen thirties').replace('1980s', 'nineteen eighties').replace('1990s', 'nineteen nineties').replace('2000s', 'two thousands').replace(' UK ', ' u k ').replace(' TV ', ' t v ').replace(/®/g, '').replace('HMT', 'h m t').replace('DIY', 'd i y').replace(/OK,/g, 'okay').replace(/\b1948\b/g, 'nineteen forty eight').replace(/\b22\b/, 'twenty two').replace('£28,', 'twenty eight pounds').replace('£850', 'eight hundred and fifty pounds').replace('8,000', 'eight thousand').replace(/ UK([ .])/g, ' u k$1').replace(' II,', ' two').replace('1940s', 'nineteen forties').replace('1971', 'nineteen seventy one').replace('1983', 'nineteen eighty three').replace('1955', 'nineteen fifty five').replace('1958', 'nineteen fifty eight').replace(/’/g, "'").replace(/[‘"“”.,!?;:()…–-]/g, ' ').split(/\s+/).filter(Boolean).join(' ');
      const c = checkPage(p.text, heard(said), 40);
      expect({ page: p.page, misread: c.misread, accuracy: c.accuracy }).toEqual({ page: p.page, misread: [], accuracy: 1 });
    }
  });
});
