// Prototype storage: this device only. A real release needs a school-managed back end.
import type { Attempt } from '../types';

const KEY_ATTEMPTS = 'btc.attempts.v1';
const KEY_READER = 'btc.reader.v1';

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
