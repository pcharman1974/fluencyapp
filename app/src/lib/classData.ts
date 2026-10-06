// Whole-class data for the teacher view: everything saved on the server, plus anything on this
// device that hasn't uploaded yet, with duplicates removed.
import type { Attempt } from '../types';
import type { ReadingEvent } from './rewards';

export interface PupilData { events: ReadingEvent[]; attempts: Attempt[] }

const EVENT_TYPES = new Set(['page', 'reread', 'timed', 'warmup', 'points', 'badge', 'selfcheck']);
const SERVER_ONLY = new Set(['kind', 'receivedAt', 'batchId', 'readerCode']);

/** Same record whichever copy it came from (server rows carry extra bookkeeping fields). */
function key(r: Record<string, unknown>): string {
  const clean: Record<string, unknown> = {};
  for (const k of Object.keys(r).sort()) if (!SERVER_ONLY.has(k)) clean[k] = r[k];
  return JSON.stringify(clean);
}
const strip = (r: Record<string, unknown>) => {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(r)) if (!SERVER_ONLY.has(k) || k === 'readerCode') out[k] = v;
  return out;
};

/** Server rows ({ code: rows }) into events and timed-read markings per pupil. */
export function fromServer(raw: Record<string, Record<string, unknown>[]>): Record<string, PupilData> {
  const out: Record<string, PupilData> = {};
  for (const [code, rows] of Object.entries(raw)) {
    out[code] = {
      events: rows.filter(r => r.kind === 'event' && EVENT_TYPES.has(String(r.type))).map(r => { const e = strip(r); delete e.readerCode; return e as unknown as ReadingEvent; }),
      attempts: rows.filter(r => r.kind === 'attempt').map(r => ({ ...strip(r), readerCode: code }) as unknown as Attempt),
    };
  }
  return out;
}

/** Combines server and device copies for every pupil, without duplicates, oldest first. */
export function mergeClass(server: Record<string, PupilData>, local: Record<string, PupilData>): Record<string, PupilData> {
  const out: Record<string, PupilData> = {};
  for (const code of new Set([...Object.keys(server), ...Object.keys(local)])) {
    const merge = <T,>(a: T[] = [], b: T[] = []) => {
      const seen = new Set<string>(), all: T[] = [];
      for (const r of [...a, ...b]) { const k = key(r as Record<string, unknown>); if (!seen.has(k)) { seen.add(k); all.push(r); } }
      return all.sort((x, y) => String((x as { date: string }).date).localeCompare(String((y as { date: string }).date)));
    };
    out[code] = { events: merge(server[code]?.events, local[code]?.events), attempts: merge(server[code]?.attempts, local[code]?.attempts) };
  }
  return out;
}
