// QA data log: every record saved for a reader, in plain English and as raw fields, plus CSV export.
// Shows exactly what is stored on this device; nothing here is sent anywhere.
import type { Attempt } from '../types';
import { BADGES, type ReadingEvent } from './rewards';
import { badgeInfo } from './milestones';

export type LogKind = 'page' | 'reread' | 'selfcheck' | 'warmup' | 'timed' | 'marking' | 'points' | 'badge';

export const KIND_LABEL: Record<LogKind, string> = {
  page: 'Page read', reread: 'Best reading', selfcheck: 'Self-check', warmup: 'Warm-up word', timed: 'Timed read',
  marking: 'Timed read marking', points: 'Power', badge: 'Badge',
};

export interface LogRow {
  date: string;
  kind: LogKind;
  what: string;              // e.g. "Page 3" or "excavated"
  result?: { ok: boolean; text: string };
  details: string[];         // short "label value" facts
  raw: Record<string, unknown>;
}

const pct = (v?: number) => (v === undefined ? undefined : `${Math.round(v * 100)}%`);
const facts = (pairs: [string, string | number | undefined][]) =>
  pairs.filter(([, v]) => v !== undefined && v !== '').map(([k, v]) => `${k} ${v}`);
const source = (id?: string) => (id === 'demo' ? 'demo check (made-up result)' : id === 'azure' ? 'Azure speech check' : id);

function eventRow(e: ReadingEvent): LogRow {
  const raw = e as unknown as Record<string, unknown>;
  switch (e.type) {
    case 'page':
    case 'reread':
      return {
        date: e.date, kind: e.type, what: `Page ${e.page}`, raw,
        result: { ok: e.verified, text: e.verified ? 'Counted' : 'Not counted' },
        details: [
          ...facts([['Heard', pct(e.coverage)], ['Correct', pct(e.accuracy)], ['WCPM', e.wcpm], ['Pace', e.wpm !== undefined ? `${e.wpm} words/min` : undefined],
            ['Words on page', e.words], ['Time', e.durationSec !== undefined ? `${Math.round(e.durationSec)}s` : undefined],
            ['Misread', e.misread?.length ? e.misread.join(', ') : undefined], ['Checked by', source(e.checkedBy)],
            ['Expression score', e.type === 'reread' ? e.scores?.prosody : undefined], ['Fluency score', e.type === 'reread' ? e.scores?.fluency : undefined]]),
          ...(e.message ? [`Pupil saw: "${e.message}"`] : []),
        ],
      };
    case 'selfcheck': {
      const say = { yes: 'yes', nearly: 'nearly', 'not-yet': 'not yet' } as const;
      return { date: e.date, kind: 'selfcheck', what: `Page ${e.page}`, raw,
        details: [`Smooth, like talking: ${say[e.smooth]}`, `Paused at full stops: ${say[e.pauses]}`, `Voice showed the meaning: ${say[e.meaning]}`] };
    }
    case 'warmup':
      return {
        date: e.date, kind: 'warmup', what: e.word, raw,
        result: { ok: e.correct, text: e.correct ? 'Right' : 'Not quite' },
        details: facts([['Heard', pct(e.coverage)], ['Correct', pct(e.accuracy)], ['Time', e.durationSec !== undefined ? `${Math.round(e.durationSec)}s` : undefined],
          ['Checked by', source(e.checkedBy)]]),
      };
    case 'timed':
      return {
        date: e.date, kind: 'timed', what: `${e.wcpm} WCPM`, raw,
        details: facts([['Errors', e.errorWords.length ? e.errorWords.join(', ') : 'none']]),
      };
    case 'points':
      return { date: e.date, kind: 'points', what: `+${e.amount}`, details: [e.reason], raw };
    case 'badge':
      return { date: e.date, kind: 'badge', what: badgeInfo(e.id, BADGES).name, details: [], raw };
  }
}

function attemptRow(a: Attempt): LogRow {
  return {
    date: a.date, kind: 'marking', what: `${a.wcpm} WCPM`, raw: a as unknown as Record<string, unknown>,
    details: [
      ...facts([['Words read', a.wordsRead], ['Errors', a.errors], ['Accuracy', pct(a.accuracy)], ['Time', `${Math.round(a.seconds)}s`],
        ['Marked by', a.method === 'adult' ? 'adult' : a.method === 'speech' ? 'speech check' : 'demo'],
        ['Error words', a.errorWords.length ? a.errorWords.join(', ') : undefined]]),
      ...(a.speechScores ? facts([['Fluency score', a.speechScores.fluency], ['Prosody score', a.speechScores.prosody], ['Pronunciation score', a.speechScores.pronunciation]]) : []),
    ],
  };
}

/** Every record, newest first. */
export function logRows(events: ReadingEvent[], attempts: Attempt[]): LogRow[] {
  return [...events.map(eventRow), ...attempts.map(attemptRow)]
    .sort((a, b) => b.date.localeCompare(a.date) || order(a.kind) - order(b.kind));
}
// Within the same moment: the reading first, then what it earned.
const order = (k: LogKind) => ['page', 'reread', 'selfcheck', 'warmup', 'timed', 'marking', 'points', 'badge'].indexOf(k);

const COLUMNS = ['readerCode', 'date', 'type', 'storyId', 'passageId', 'page', 'word', 'verified', 'correct', 'coverage', 'accuracy', 'words', 'durationSec',
  'wpm', 'wcpm', 'misread', 'message', 'checkedBy', 'errorWords', 'seconds', 'wordsRead', 'errors', 'method', 'speechScores', 'amount', 'reason', 'id'];

/** CSV with one row per record and one column per stored field. */
export function toCsv(rows: { readerCode: string; row: LogRow }[]): string {
  const cell = (v: unknown) => {
    if (v === undefined || v === null) return '';
    const s = Array.isArray(v) ? v.join('; ') : typeof v === 'object' ? JSON.stringify(v) : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = rows.map(({ readerCode, row }) => {
    const r: Record<string, unknown> = { ...row.raw, readerCode, type: row.kind === 'marking' ? 'timed-marking' : row.raw.type };
    return COLUMNS.map(c => cell(r[c])).join(',');
  });
  return [COLUMNS.join(','), ...lines].join('\n');
}

/** Saves text as a file in the browser. */
export function download(name: string, text: string, type: string) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = Object.assign(document.createElement('a'), { href: url, download: name });
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
