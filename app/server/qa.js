// Testing data store: every reader's records (page reads, re-reads, warm-ups, timed reads, Power,
// badges) plus a recording of each read with its check result, so the speech check can be checked.
// Stored on the server's disk (Render: the disk mounted at /var/data) and kept until deleted.
// The whole app is a test version at present: see HANDOFF.md.
import express from 'express';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';

const READER = /^[A-Z0-9-]{1,12}$/;
const TYPES = new Set(['page', 'reread', 'warmup', 'timed']);
const ID = /^[\w-]{10,120}$/;
const CLIENT_ID = /^[a-z0-9]{8,40}$/;
const AUDIO_EXT = { 'audio/webm': 'webm', 'audio/mp4': 'm4a', 'audio/ogg': 'ogg', 'audio/mpeg': 'mp3' };

/** Adds the /api/qa routes. Call after the password check, so data is never public. */
export function qaRoutes(app, { root, enabled }) {
  const dir = path.join(root, 'qa');
  const recDir = path.join(dir, 'recordings'), evDir = path.join(dir, 'records');
  let ok = false;
  if (enabled) {
    try {
      for (const d of [recDir, evDir]) { fs.mkdirSync(d, { recursive: true }); fs.accessSync(d, fs.constants.W_OK); }
      ok = true;
    } catch { ok = false; }
  }
  const metaFile = id => path.join(recDir, `${id}.json`);
  const readMeta = async id => JSON.parse(await fsp.readFile(metaFile(id), 'utf8'));
  const guard = (req, res, next) => (ok ? next() : res.status(404).json({ error: 'Test mode is off' }));
  const validId = (req, res, next) => (ID.test(req.params.id) ? next() : res.status(400).json({ error: 'Bad id' }));

  app.get('/api/qa/status', (_req, res) => res.json({ enabled: ok }));

  // 1. The check result and what was heard.
  app.post('/api/qa/recordings', guard, express.json({ limit: '300kb' }), async (req, res) => {
    const m = req.body || {};
    if (!READER.test(m.readerCode || '')) return res.status(400).json({ error: 'Bad reader code' });
    if (!TYPES.has(m.type)) return res.status(400).json({ error: 'Unknown type' });
    // A device's own id for the recording makes retries safe: the same upload gets the same record.
    const clientId = typeof m.clientId === 'string' && CLIENT_ID.test(m.clientId) ? m.clientId : crypto.randomBytes(6).toString('hex');
    const when = typeof m.date === 'string' && !Number.isNaN(Date.parse(m.date)) ? new Date(m.date) : new Date();
    const id = `${when.toISOString().replace(/[:.]/g, '-')}_${m.readerCode}_${m.type}_${clientId}`;
    try {
      await fsp.writeFile(metaFile(id), JSON.stringify({ ...m, id, savedAt: new Date().toISOString(), userAgent: req.get('user-agent') }, null, 2), { flag: 'wx' });
    } catch (e) {
      if (e.code !== 'EEXIST') throw e; // already saved by an earlier try
    }
    res.json({ id });
  });

  // 2. The audio for that record.
  app.put('/api/qa/recordings/:id/audio', guard, validId, express.raw({ type: () => true, limit: '30mb' }), async (req, res) => {
    let meta;
    try { meta = await readMeta(req.params.id); } catch { return res.status(404).json({ error: 'No such record' }); }
    if (meta.audio) return res.status(409).json({ error: 'Audio already saved' });
    const type = (req.get('content-type') || '').split(';')[0];
    const file = `${req.params.id}.${AUDIO_EXT[type] ?? 'bin'}`;
    await fsp.writeFile(path.join(recDir, file), req.body);
    await fsp.writeFile(metaFile(req.params.id), JSON.stringify({ ...meta, audio: file, audioType: type, audioBytes: req.body.length }, null, 2));
    res.json({ ok: true });
  });

  app.get('/api/qa/recordings', guard, async (_req, res) => {
    const names = (await fsp.readdir(recDir)).filter(n => n.endsWith('.json')).sort().reverse().slice(0, 500);
    const list = [];
    for (const n of names) { try { list.push(JSON.parse(await fsp.readFile(path.join(recDir, n), 'utf8'))); } catch { /* skip broken file */ } }
    res.json(list);
  });

  app.get('/api/qa/recordings/:id/audio', guard, validId, async (req, res) => {
    let meta;
    try { meta = await readMeta(req.params.id); } catch { return res.sendStatus(404); }
    if (!meta.audio) return res.sendStatus(404);
    res.type(meta.audioType || 'application/octet-stream').sendFile(path.join(recDir, meta.audio));
  });

  // An adult's marking of a recording, to compare with the app's (see src/lib/review.ts).
  app.put('/api/qa/recordings/:id/review', guard, validId, express.json({ limit: '50kb' }), async (req, res) => {
    let meta;
    try { meta = await readMeta(req.params.id); } catch { return res.status(404).json({ error: 'No such record' }); }
    const r = req.body || {};
    const ints = v => Array.isArray(v) && v.every(n => Number.isInteger(n) && n >= 0 && n < 5000);
    if (!ints(r.wrong) || (r.stoppedAt !== undefined && !ints([r.stoppedAt]))) return res.status(400).json({ error: 'Bad review' });
    const review = {
      wrong: [...new Set(r.wrong)].sort((a, b) => a - b),
      ...(r.stoppedAt !== undefined ? { stoppedAt: r.stoppedAt } : {}),
      counted: typeof r.counted === 'boolean' ? r.counted : null,
      note: typeof r.note === 'string' ? r.note.slice(0, 1000) : '',
      reviewer: typeof r.reviewer === 'string' ? r.reviewer.slice(0, 60) : '',
      date: new Date().toISOString(),
    };
    await fsp.writeFile(metaFile(req.params.id), JSON.stringify({ ...meta, review }, null, 2));
    res.json({ ok: true, review });
  });

  app.delete('/api/qa/recordings/:id', guard, validId, async (req, res) => {
    for (const n of await fsp.readdir(recDir)) if (n.startsWith(req.params.id + '.')) await fsp.rm(path.join(recDir, n), { force: true });
    res.json({ ok: true });
  });

  // Every record a device saves (events and timed-read markings), appended per reader.
  app.post('/api/qa/records', guard, express.json({ limit: '1mb' }), async (req, res) => {
    const { readerCode, events = [], attempts = [], batchId } = req.body || {};
    if (!READER.test(readerCode || '')) return res.status(400).json({ error: 'Bad reader code' });
    const file = path.join(evDir, `${readerCode}.jsonl`);
    // Devices retry uploads after a dropped connection: a batch already saved is not saved twice.
    const batch = typeof batchId === 'string' && CLIENT_ID.test(batchId) ? batchId : undefined;
    if (batch) {
      let existing = '';
      try { existing = await fsp.readFile(file, 'utf8'); } catch { /* new reader */ }
      if (existing.includes(`"batchId":"${batch}"`)) return res.json({ ok: true, duplicate: true });
    }
    const lines = [...events.map(e => ({ kind: 'event', ...e })), ...attempts.map(a => ({ kind: 'attempt', ...a }))]
      .map(r => JSON.stringify({ ...r, readerCode, receivedAt: new Date().toISOString(), ...(batch ? { batchId: batch } : {}) })).join('\n');
    if (lines) await fsp.appendFile(file, lines + '\n');
    res.json({ ok: true });
  });

  /** Claims a new reader number. Creating the file with 'wx' fails if it exists, so two devices can never both get it. */
  app.post('/api/qa/readers', guard, express.json({ limit: '2kb' }), async (req, res) => {
    const code = req.body?.code;
    if (!READER.test(code || '')) return res.status(400).json({ error: 'Bad reader code' });
    try {
      await fsp.writeFile(path.join(evDir, `${code}.jsonl`), JSON.stringify({ kind: 'created', readerCode: code, date: new Date().toISOString() }) + '\n', { flag: 'wx' });
      res.status(201).json({ ok: true });
    } catch (e) {
      if (e.code === 'EEXIST') return res.status(409).json({ error: 'taken' });
      throw e;
    }
  });

  /** Every reader the server has records for, most recently active first. */
  app.get('/api/qa/readers', guard, async (_req, res) => {
    const out = [];
    for (const n of (await fsp.readdir(evDir)).filter(n => n.endsWith('.jsonl'))) {
      const lines = (await fsp.readFile(path.join(evDir, n), 'utf8')).split('\n').filter(Boolean);
      // Last reading, not when the number was created.
      let last;
      for (let i = lines.length - 1; i >= 0 && !last; i--) { try { const r = JSON.parse(lines[i]); if (r.kind !== 'created') last = r.date; } catch { /* ignore */ } }
      out.push({ code: n.replace(/\.jsonl$/, ''), records: lines.filter(l => !l.includes('"kind":"created"')).length, lastActive: last });
    }
    res.json(out.sort((a, b) => String(b.lastActive ?? '').localeCompare(String(a.lastActive ?? ''))));
  });

  /** One reader's records, to load their history onto another device. */
  app.get('/api/qa/records/:code', guard, async (req, res) => {
    if (!READER.test(req.params.code)) return res.status(400).json({ error: 'Bad reader code' });
    let text = '';
    try { text = await fsp.readFile(path.join(evDir, `${req.params.code}.jsonl`), 'utf8'); } catch { /* none yet */ }
    const rows = text.split('\n').filter(Boolean).map(l => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
    const strip = ({ kind, receivedAt, ...r }) => r;
    res.json({ events: rows.filter(r => r.kind === 'event').map(strip), attempts: rows.filter(r => r.kind === 'attempt').map(strip) });
  });

  /** Everything stored, by reader: { readerCode: [records...] }. */
  app.get('/api/qa/records', guard, async (_req, res) => {
    const out = {};
    for (const n of (await fsp.readdir(evDir)).filter(n => n.endsWith('.jsonl')).sort()) {
      const text = await fsp.readFile(path.join(evDir, n), 'utf8');
      out[n.replace(/\.jsonl$/, '')] = text.split('\n').filter(Boolean).map(l => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
    }
    res.json(out);
  });

  return { enabled: ok, dir };
}
