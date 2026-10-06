// Marking review: an adult listens to a recording and taps the words the pupil got wrong, without
// seeing the app's marks. Comparing the two shows how far the speech check can be trusted, and which
// way it errs, before its thresholds are tuned. Data for FFT's calibration, not shown to pupils.
import type { RecordMark } from './verify';

export interface Review {
  wrong: number[];          // word positions (0 = first word of the text) the adult marked wrong or missed
  stoppedAt?: number;       // last word position the pupil reached, if they didn't finish
  counted?: boolean | null; // page reads: would the adult count the page as read? (null = not asked)
  note?: string;
  reviewer?: string;
  date: string;
}

/** The app's mark for each word of the text, in order (added words left out). */
export const appWords = (record: RecordMark[]) => record.filter((m): m is Exclude<RecordMark, { kind: 'ins' }> => m.kind !== 'ins');

export interface Agreement {
  words: number;       // words both judged (reached by the pupil)
  bothRight: number;
  bothWrong: number;
  falseAlarms: number; // app said wrong, adult heard it right: unfair on the pupil
  missed: number;      // adult heard an error the app accepted
}

/** Word-by-word comparison of the app's marking with the adult's, over the words the pupil reached. */
export function compare(record: RecordMark[], review: Pick<Review, 'wrong' | 'stoppedAt'>): Agreement {
  const words = appWords(record);
  const wrong = new Set(review.wrong);
  // Where the pupil got to: the adult's judgement if given, otherwise the app's.
  let last = review.stoppedAt ?? words.reduce((l, m, i) => (m.kind !== 'unread' ? i : l), -1);
  last = Math.min(last, words.length - 1);
  const out: Agreement = { words: 0, bothRight: 0, bothWrong: 0, falseAlarms: 0, missed: 0 };
  for (let i = 0; i <= last; i++) {
    const app = words[i].kind !== 'ok', adult = wrong.has(i);
    out.words++;
    if (app && adult) out.bothWrong++;
    else if (!app && !adult) out.bothRight++;
    else if (app) out.falseAlarms++;
    else out.missed++;
  }
  return out;
}

export interface ReviewItem { record: RecordMark[]; review: Review; appCounted?: boolean; provider?: string; type: string }

export interface Summary {
  reviewed: number;
  agree: Agreement;
  agreement: number;      // share of words where app and adult agreed
  falseAlarmRate: number; // of words the adult heard right, share the app marked wrong
  missRate: number;       // of errors the adult heard, share the app missed
  pages: number;          // page reads where the adult said whether they'd count it
  pageAgree: number;
  tooStrict: number;      // app refused a page the adult would count
  tooLenient: number;     // app counted a page the adult wouldn't
}

/** Totals across reviewed recordings. */
export function summarise(items: ReviewItem[]): Summary {
  const agree: Agreement = { words: 0, bothRight: 0, bothWrong: 0, falseAlarms: 0, missed: 0 };
  let pages = 0, pageAgree = 0, tooStrict = 0, tooLenient = 0;
  for (const it of items) {
    const a = compare(it.record, it.review);
    for (const k of Object.keys(agree) as (keyof Agreement)[]) agree[k] += a[k];
    if (typeof it.review.counted === 'boolean' && typeof it.appCounted === 'boolean') {
      pages++;
      if (it.review.counted === it.appCounted) pageAgree++;
      else if (it.review.counted) tooStrict++;
      else tooLenient++;
    }
  }
  const ratio = (a: number, b: number) => (b ? a / b : 0);
  return {
    reviewed: items.length, agree,
    agreement: ratio(agree.bothRight + agree.bothWrong, agree.words),
    falseAlarmRate: ratio(agree.falseAlarms, agree.bothRight + agree.falseAlarms),
    missRate: ratio(agree.missed, agree.bothWrong + agree.missed),
    pages, pageAgree, tooStrict, tooLenient,
  };
}
