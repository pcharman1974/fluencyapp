// Testing data store (client side). While the app is a test version, every record saved on the
// device is also sent to the server, with a recording of each read and what the speech check heard.
// Switched on only when the server says so (it needs the site password and a disk); otherwise the
// app works device-only, as in the Claude artifact.

export interface QaContext { type: 'page' | 'reread' | 'warmup' | 'timed'; storyId?: string; page?: number; word?: string }

let status: Promise<boolean> | null = null;
/** True when the server is saving test data. Asked once per visit. */
export function qaEnabled(): Promise<boolean> {
  status ??= fetch('api/qa/status').then(r => (r.ok ? r.json() : { enabled: false })).then(j => Boolean(j.enabled)).catch(() => false);
  return status;
}

/** Sends records (events and timed-read markings) to the server. Never blocks or breaks the app. */
export function sendRecords(readerCode: string, records: { events?: unknown[]; attempts?: unknown[] }) {
  if (!readerCode) return;
  qaEnabled().then(on => {
    if (!on) return;
    fetch('api/qa/records', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ readerCode, ...records }), keepalive: true })
      .catch(() => { /* testing data only: the device copy is still saved */ });
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

/** Saves a read's check result, what was heard, and its recording on the server. */
export async function sendRecording(readerCode: string, ctx: QaContext, detail: Record<string, unknown>, audio: Blob | null) {
  if (!readerCode || !(await qaEnabled())) return;
  try {
    const r = await fetch('api/qa/recordings', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ readerCode, ...ctx, date: new Date().toISOString(), ...detail }) });
    if (!r.ok || !audio) return;
    const { id } = await r.json();
    await fetch(`api/qa/recordings/${id}/audio`, { method: 'PUT', headers: { 'Content-Type': audio.type || 'application/octet-stream' }, body: audio });
  } catch { /* testing data only */ }
}

export interface QaRecording {
  id: string; readerCode: string; type: QaContext['type']; date: string; page?: number; word?: string;
  heard?: string; provider?: string; check?: Record<string, unknown>; attempt?: Record<string, unknown>;
  audio?: string; audioBytes?: number; userAgent?: string;
}
export const listRecordings = (): Promise<QaRecording[]> => fetch('api/qa/recordings').then(r => (r.ok ? r.json() : []));
export const listRecords = (): Promise<Record<string, Record<string, unknown>[]>> => fetch('api/qa/records').then(r => (r.ok ? r.json() : {}));
export const deleteRecording = (id: string) => fetch(`api/qa/recordings/${id}`, { method: 'DELETE' });

export interface ServerReader { code: string; records: number; lastActive?: string }
export const listReaders = (): Promise<ServerReader[]> =>
  qaEnabled().then(on => (on ? fetch('api/qa/readers').then(r => (r.ok ? r.json() : [])) : [])).catch(() => []);
export const fetchReader = (code: string): Promise<{ events: unknown[]; attempts: unknown[] }> =>
  fetch(`api/qa/records/${encodeURIComponent(code)}`).then(r => (r.ok ? r.json() : { events: [], attempts: [] }));
