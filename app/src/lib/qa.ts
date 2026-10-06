import type { Profile } from './profile';
// Testing data store (client side). While the app is a test version, every record saved on the
// device is also sent to the server, with a recording of each read and what the speech check heard.
// Switched on only when the server says so (it needs the site password and a disk); otherwise the
// app works device-only, as in the Claude artifact.
import { dropPending, enqueue, newKey, startOutbox, update, type OutboxItem } from './outbox';
import type { Review } from './review';

export interface QaContext { type: 'page' | 'reread' | 'warmup' | 'timed'; storyId?: string; page?: number; word?: string }

let status: Promise<boolean> | null = null;
/** True when the server is saving test data. Asked once per visit. */
export function qaEnabled(): Promise<boolean> {
  status ??= fetch('api/qa/status').then(r => (r.ok ? r.json() : { enabled: false })).then(j => Boolean(j.enabled)).catch(() => false);
  return status;
}

/** Sends records (events and timed-read markings) to the server, via the outbox so nothing is lost offline. */
export function sendRecords(readerCode: string, records: { events?: unknown[]; attempts?: unknown[] }) {
  if (!readerCode) return;
  qaEnabled().then(on => {
    if (!on) return;
    enqueue({ key: newKey(), kind: 'records', body: { readerCode, ...records } }, send);
  });
}

export interface QaRecorder { stop(): Promise<Blob | null>; cancel(): void }

/** Records the microphone alongside the speech check, if test data is being saved. */
export async function startRecording(): Promise<QaRecorder | null> {
  if (!(await qaEnabled()) || typeof MediaRecorder === 'undefined' || !navigator.mediaDevices) return null;
  let stream: MediaStream;
  try { stream = await navigator.mediaDevices.getUserMedia({ audio: true }); } catch { return null; }
  const mime = ['audio/webm;codecs=opus', 'audio/mp4', 'audio/webm', 'audio/ogg'].find(t => MediaRecorder.isTypeSupported(t));
  let rec: MediaRecorder;
  try { rec = new MediaRecorder(stream, mime ? { mimeType: mime, audioBitsPerSecond: 32000 } : undefined); } catch { stream.getTracks().forEach(t => t.stop()); return null; }
  const chunks: Blob[] = [];
  rec.ondataavailable = e => { if (e.data.size) chunks.push(e.data); };
  rec.start(1000);
  const release = () => stream.getTracks().forEach(t => t.stop());
  return {
    stop: () => new Promise(resolve => {
      if (rec.state === 'inactive') { release(); resolve(chunks.length ? new Blob(chunks, { type: rec.mimeType || mime }) : null); return; }
      rec.onstop = () => { release(); resolve(chunks.length ? new Blob(chunks, { type: rec.mimeType || mime }) : null); };
      rec.stop();
    }),
    cancel: () => { try { rec.stop(); } catch { /* already stopped */ } release(); },
  };
}

/** Saves a read's check result, what was heard, and its recording on the server (via the outbox). */
export async function sendRecording(readerCode: string, ctx: QaContext, detail: Record<string, unknown>, audio: Blob | null) {
  if (!readerCode || !(await qaEnabled())) return;
  await enqueue({ key: newKey(), kind: 'recording', meta: { readerCode, ...ctx, date: new Date().toISOString(), ...detail }, audio }, send);
}

/** Sends one outbox item. 'retry' keeps it for later (no connection, server busy); 'drop' discards a bad one. */
async function send(item: OutboxItem): Promise<'done' | 'retry' | 'drop'> {
  const outcome = (r: Response) => (r.ok || r.status === 409 ? 'done' : r.status === 400 || r.status === 413 ? 'drop' : 'retry');
  if (item.kind === 'records') {
    const r = await fetch('api/qa/records', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...item.body, batchId: item.key }) });
    return outcome(r);
  }
  if (!item.id) {
    const r = await fetch('api/qa/recordings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...item.meta, clientId: item.key }) });
    if (!r.ok) return outcome(r);
    item.id = (await r.json()).id as string;
    await update(item);
  }
  if (!item.audio) return 'done';
  const r = await fetch(`api/qa/recordings/${item.id}/audio`, { method: 'PUT', headers: { 'Content-Type': item.audio.type || 'application/octet-stream' }, body: item.audio });
  return outcome(r);
}

/** Starts retrying any uploads left from earlier (call once when the app opens). */
export function startUploads() { qaEnabled().then(on => { if (on) startOutbox(send); }); }

export interface QaRecording {
  id: string; readerCode: string; type: QaContext['type']; date: string; page?: number; word?: string;
  heard?: string; provider?: string; check?: Record<string, unknown>; attempt?: Record<string, unknown>;
  audio?: string; audioBytes?: number; userAgent?: string; text?: string; review?: Review;
}
export const saveReview = (id: string, review: Omit<Review, 'date'>): Promise<Review> =>
  fetch(`api/qa/recordings/${id}/review`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(review) })
    .then(r => { if (!r.ok) throw new Error('Not saved'); return r.json(); }).then(j => j.review);
export const listRecordings = (): Promise<QaRecording[]> => fetch('api/qa/recordings').then(r => (r.ok ? r.json() : []));
export const listRecords = (): Promise<Record<string, Record<string, unknown>[]>> => fetch('api/qa/records').then(r => (r.ok ? r.json() : {}));
export const deleteRecording = (id: string) => fetch(`api/qa/recordings/${id}`, { method: 'DELETE' });

export interface ServerReader { code: string; records: number; lastActive?: string; profile?: Profile }
export const listReaders = (): Promise<ServerReader[]> =>
  qaEnabled().then(on => (on ? fetch('api/qa/readers').then(r => (r.ok ? r.json() : [])) : [])).catch(() => []);
export const fetchReader = (code: string): Promise<{ events: unknown[]; attempts: unknown[] }> =>
  fetch(`api/qa/records/${encodeURIComponent(code)}`).then(r => (r.ok ? r.json() : { events: [], attempts: [] }));

/** Deletes all of a pupil's records and recordings from the server, and any of their uploads still waiting on this device. */
export async function removeReader(code: string): Promise<boolean> {
  await dropPending(i => (i.kind === 'records' ? i.body.readerCode : i.meta.readerCode) === code);
  return fetch(`api/qa/readers/${encodeURIComponent(code)}`, { method: 'DELETE' }).then(r => r.ok).catch(() => false);
}

/** Claims a new reader number on the server. 'taken' if someone already has it; 'offline' when there is no server to ask. */
export async function claimReader(code: string): Promise<'ok' | 'taken' | 'offline'> {
  if (!(await qaEnabled())) return 'offline';
  try {
    const r = await fetch('api/qa/readers', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code }) });
    return r.status === 409 ? 'taken' : r.ok ? 'ok' : 'offline';
  } catch { return 'offline'; }
}
