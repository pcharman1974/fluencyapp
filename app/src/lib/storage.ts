// Prototype storage: this device only. A real release needs a school-managed back end.
import type { Attempt } from '../types';
import type { ReadingEvent } from './rewards';
import { sendRecords } from './qa';

const KEY_ATTEMPTS = 'btc.attempts.v1';
const KEY_READER = 'btc.reader.v1';
const KEY_EVENTS = 'btc.events.v1';
const KEY_HOLIDAYS = 'btc.holidays.v1';

function read<T>(key: string, fallback: T): T {
  try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; } catch { return fallback; }
}
function write(key: string, value: unknown) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* storage blocked */ }
}

export const getReaderCode = () => read<string>(KEY_READER, '');
export const setReaderCode = (code: string) => write(KEY_READER, code);
export const getAttempts = (readerCode: string) =>
  read<Attempt[]>(KEY_ATTEMPTS, []).filter(a => a.readerCode === readerCode);
export const saveAttempt = (a: Attempt) => { write(KEY_ATTEMPTS, [...read<Attempt[]>(KEY_ATTEMPTS, []), a]); sendRecords(a.readerCode, { attempts: [a] }); };

type Stored = ReadingEvent & { readerCode: string };
export const getEvents = (readerCode: string): ReadingEvent[] =>
  read<Stored[]>(KEY_EVENTS, []).filter(e => e.readerCode === readerCode);
export const addEvents = (readerCode: string, events: ReadingEvent[]) => {
  write(KEY_EVENTS, [...read<Stored[]>(KEY_EVENTS, []), ...events.map(e => ({ ...e, readerCode }))]);
  sendRecords(readerCode, { events });
};
export const getHolidays = () => read<string[]>(KEY_HOLIDAYS, []);
export const setHolidays = (weeks: string[]) => write(KEY_HOLIDAYS, weeks);
/** Every reader code that has used this device. */
export const getAllReaderCodes = (): string[] => [...new Set([
  ...read<Stored[]>(KEY_EVENTS, []).map(e => e.readerCode),
  ...read<Attempt[]>(KEY_ATTEMPTS, []).map(a => a.readerCode),
])].filter(Boolean).sort();

/** Merges a reader's records from the server into this device (no duplicates; nothing is re-sent). */
export function importRecords(readerCode: string, events: ReadingEvent[], attempts: Attempt[]) {
  const key = (r: object) => JSON.stringify(r, Object.keys(r).filter(k => k !== 'readerCode').sort());
  const evs = read<Stored[]>(KEY_EVENTS, []), have = new Set(evs.filter(e => e.readerCode === readerCode).map(({ readerCode: _, ...e }) => key(e)));
  const newEvents = events.filter(e => !have.has(key(e)));
  if (newEvents.length) write(KEY_EVENTS, [...evs, ...newEvents.map(e => ({ ...e, readerCode }))].sort((a, b) => a.date.localeCompare(b.date)));
  const ats = read<Attempt[]>(KEY_ATTEMPTS, []), haveA = new Set(ats.filter(a => a.readerCode === readerCode).map(a => key(a)));
  const newAttempts = attempts.map(a => ({ ...a, readerCode })).filter(a => !haveA.has(key(a)));
  if (newAttempts.length) write(KEY_ATTEMPTS, [...ats, ...newAttempts].sort((a, b) => a.date.localeCompare(b.date)));
  return newEvents.length + newAttempts.length;
}
