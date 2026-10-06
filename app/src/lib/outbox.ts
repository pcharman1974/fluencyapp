// Outbox for test data: every upload waits here (in the browser's IndexedDB) until the server confirms
// it, so a dropped school Wi-Fi connection doesn't lose a pupil's reading. Retried when the app opens,
// when the connection comes back and every 30 seconds. Each item has its own id, so the server can
// ignore a retry of something it already saved.

type RecordsItem = { key: string; kind: 'records'; body: Record<string, unknown> };
type RecordingItem = { key: string; kind: 'recording'; meta: Record<string, unknown>; audio: Blob | null; id?: string };
export type OutboxItem = RecordsItem | RecordingItem;

const DB = 'btc-outbox', STORE = 'items';
let dbp: Promise<IDBDatabase | null> | null = null;
function db(): Promise<IDBDatabase | null> {
  dbp ??= new Promise(resolve => {
    try {
      const r = indexedDB.open(DB, 1);
      r.onupgradeneeded = () => r.result.createObjectStore(STORE, { keyPath: 'key' });
      r.onsuccess = () => resolve(r.result);
      r.onerror = () => resolve(null);
    } catch { resolve(null); }
  });
  return dbp;
}
function tx<T>(mode: IDBTransactionMode, run: (s: IDBObjectStore) => IDBRequest<T>): Promise<T | undefined> {
  return db().then(d => !d ? undefined : new Promise<T | undefined>(resolve => {
    try {
      const req = run(d.transaction(STORE, mode).objectStore(STORE));
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(undefined);
    } catch { resolve(undefined); }
  }));
}

/** A sortable, unique id that the server accepts (lower-case letters and digits). */
export const newKey = () => Date.now().toString(36).padStart(9, '0') + Math.random().toString(36).slice(2, 10).padEnd(8, '0');

let listeners: ((n: number) => void)[] = [];
/** Number of uploads still waiting, for the footnote. */
export async function pendingCount(): Promise<number> { return (await tx('readonly', s => s.count())) ?? 0; }
export function onPendingChange(f: (n: number) => void) { listeners.push(f); return () => { listeners = listeners.filter(x => x !== f); }; }
const notify = async () => { const n = await pendingCount(); listeners.forEach(f => f(n)); };

/** Adds an upload; it's sent straight away if possible, otherwise kept until it can be. */
export async function enqueue(item: OutboxItem, send: (i: OutboxItem) => Promise<'done' | 'retry' | 'drop'>) {
  sender = send;
  const saved = await tx('readwrite', s => s.put(item));
  if (saved === undefined) { await send(item); return; } // no IndexedDB (private mode): one try, as before
  notify(); flush();
}

let sender: ((i: OutboxItem) => Promise<'done' | 'retry' | 'drop'>) | null = null;
let flushing = false;
/** Sends waiting uploads in order; stops at the first one that can't go yet. */
export async function flush() {
  if (flushing || !sender) return;
  flushing = true;
  try {
    const items = ((await tx<OutboxItem[]>('readonly', s => s.getAll())) ?? []).sort((a, b) => a.key.localeCompare(b.key));
    for (const item of items) {
      const r = await sender(item).catch(() => 'retry' as const);
      if (r === 'retry') break;
      await tx('readwrite', s => s.delete(item.key));
    }
  } finally { flushing = false; notify(); }
}
/** Saves progress on an item (e.g. the server's id once a recording's details are saved). */
export const update = (item: OutboxItem) => tx('readwrite', s => s.put(item));

let started = false;
/** Retries waiting uploads now, when the connection returns and every 30 seconds. */
export function startOutbox(send: (i: OutboxItem) => Promise<'done' | 'retry' | 'drop'>) {
  sender = send;
  if (started) return;
  started = true;
  flush();
  window.addEventListener('online', flush);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') flush(); });
  setInterval(flush, 30_000);
}
