// Prototype storage: this device only. A real release needs a school-managed back end.
import type { Attempt } from '../types';
import type { ReadingEvent } from './rewards';

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
export const saveAttempt = (a: Attempt) => write(KEY_ATTEMPTS, [...read<Attempt[]>(KEY_ATTEMPTS, []), a]);

type Stored = ReadingEvent & { readerCode: string };
export const getEvents = (readerCode: string): ReadingEvent[] =>
  read<Stored[]>(KEY_EVENTS, []).filter(e => e.readerCode === readerCode);
export const addEvents = (readerCode: string, events: ReadingEvent[]) =>
  write(KEY_EVENTS, [...read<Stored[]>(KEY_EVENTS, []), ...events.map(e => ({ ...e, readerCode }))]);
export const getHolidays = () => read<string[]>(KEY_HOLIDAYS, []);
export const setHolidays = (weeks: string[]) => write(KEY_HOLIDAYS, weeks);
/** Every reader code that has used this device. */
export const getAllReaderCodes = (): string[] => [...new Set([
  ...read<Stored[]>(KEY_EVENTS, []).map(e => e.readerCode),
  ...read<Attempt[]>(KEY_ATTEMPTS, []).map(a => a.readerCode),
])].filter(Boolean).sort();
