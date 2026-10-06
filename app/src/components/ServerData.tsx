import { useEffect, useState } from 'react';
import { deleteRecording, listRecordings, listRecords, qaEnabled, type QaRecording } from '../lib/qa';
import { download } from '../lib/dataLog';
import RunningRecord from './RunningRecord';
import type { RecordMark } from '../lib/verify';
import ReviewMarking, { ReviewSummary, reviewable } from './ReviewMarking';

const TYPE = { page: 'Page read', reread: 'Re-read', warmup: 'Warm-up word', timed: 'Timed read' } as const;
const stamp = (iso: string) => new Date(iso).toLocaleString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', second: '2-digit' });
const pct = (v: unknown) => (typeof v === 'number' ? `${Math.round(v * 100)}%` : '–');

/** Teacher view: every recording and record saved on the server while the app is a test version. */
export default function ServerData() {
  const [on, setOn] = useState<boolean | null>(null);
  const [list, setList] = useState<QaRecording[] | null>(null);
  const [reader, setReader] = useState('');
  const [busy, setBusy] = useState(false);
  const [show, setShow] = useState<'all' | 'todo' | 'done'>('all');
  const [open, setOpen] = useState<string | null>(null);
  const load = () => listRecordings().then(setList).catch(() => setList([]));
  useEffect(() => { qaEnabled().then(e => { setOn(e); if (e) load(); }); }, []);
  if (!on) return null;

  const readers = [...new Set((list ?? []).map(r => r.readerCode))].sort();
  const shown = (list ?? []).filter(r => (!reader || r.readerCode === reader)
    && (show === 'all' || (show === 'done' ? !!r.review : reviewable(r) && !!r.audio && !r.review)));
  const downloadAll = async () => {
    setBusy(true);
    try {
      const records = await listRecords();
      download(`power-reader-server-data-${new Date().toISOString().slice(0, 10)}.json`,
        JSON.stringify({ exportedAt: new Date().toISOString(), app: __BUILD_INFO__, records, recordings: list }, null, 2), 'application/json');
    } finally { setBusy(false); }
  };
  const remove = async (r: QaRecording) => {
    if (!confirm(`Delete this ${TYPE[r.type].toLowerCase()} recording for ${r.readerCode}? This can't be undone.`)) return;
    await deleteRecording(r.id); load();
  };

  return (
    <section className="panel serverdata">
      <div className="row wrap between">
        <h2>Saved on the server (testing)</h2>
        <div className="row wrap">
          <label className="check">Reader{' '}
            <select value={reader} onChange={e => setReader(e.target.value)}>
              <option value="">All ({list?.length ?? 0})</option>
              {readers.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </label>
          <label className="check">Show{' '}
            <select value={show} onChange={e => setShow(e.target.value as typeof show)}>
              <option value="all">All reads</option>
              <option value="todo">Waiting for review</option>
              <option value="done">Reviewed</option>
            </select>
          </label>
          <button className="btn btn-ghost" onClick={load}>Refresh</button>
          <button className="btn btn-navy" disabled={busy} onClick={downloadAll}>{busy ? 'Preparing…' : 'Download all data (JSON)'}</button>
        </div>
      </div>
      <p className="hint">This test version saves every reader's records on FFT's server, with a recording of each read and the words the speech check heard. Listen and compare with the result to check the speech check. Newest first; the latest 500 recordings are shown.</p>
      {list && <ReviewSummary list={list} />}
      {list === null ? <p className="hint">Loading…</p> : shown.length === 0 ? <p className="hint">No recordings yet.</p> : (
        <ol className="datalog-list">
          {shown.map(r => {
            const c = (r.check ?? {}) as Record<string, unknown>, a = r.attempt as Record<string, unknown> | undefined;
            const ok = r.type === 'warmup' ? c.accuracy === 1 && c.coverage === 1 : (c.verified as boolean | undefined);
            return (
              <li key={r.id}>
                <div className="dl-head">
                  <span className="dl-time">{stamp(r.date)}</span>
                  <span className="dl-kind">{TYPE[r.type]}</span>
                  <strong className="dl-what">{[r.readerCode, r.word ?? (r.page ? `Page ${r.page}` : '')].filter(Boolean).join(' · ')}</strong>
                  {ok !== undefined && r.type !== 'timed' && <span className={'status ' + (ok ? 'on-track' : 'behind')}>{ok ? '✓ Counted' : '✗ Not counted'}</span>}
                  {r.review && <span className="dl-reviewed">Reviewed{r.review.reviewer ? ` by ${r.review.reviewer}` : ''}</span>}
                  <button className="link dl-del" onClick={() => remove(r)}>Delete</button>
                </div>
                <p className="dl-details">
                  {a ? `${a.wcpm} WCPM · ${a.wordsRead} words read · ${a.errors} errors · marked by ${a.method}`
                    : `Heard ${pct(c.coverage)} · Correct ${pct(c.accuracy)} · ${c.wcpm ?? '–'} WCPM · ${typeof c.durationSec === 'number' ? Math.round(c.durationSec) + 's' : ''}`}
                  {r.provider && ` · ${r.provider}`}
                </p>
                {r.heard !== undefined && <p className="dl-details"><b>Speech check heard:</b> {r.heard || '(nothing)'}</p>}
                {open === r.id ? (
                  <ReviewMarking r={r} onClose={() => setOpen(null)}
                    onSaved={rv => setList(l => (l ?? []).map(x => (x.id === r.id ? { ...x, review: rv } : x)))} />
                ) : <>
                {Array.isArray(c.record) && r.type !== 'timed' && <RunningRecord record={c.record as RecordMark[]} audience="teacher" />}
                {reviewable(r) && r.audio && <button className="btn btn-ghost" onClick={() => setOpen(r.id)}>{r.review ? 'See or change review' : 'Review marking'}</button>}
                {r.audio ? <audio controls preload="none" src={`api/qa/recordings/${r.id}/audio`} className="dl-audio" /> : <p className="hint">No recording (microphone recording not available on this device).</p>}
                </>}
                <details className="dl-raw"><summary>All fields</summary><pre>{JSON.stringify(r, null, 2)}</pre></details>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}

/** Shown to everyone on the home screen while test data is being saved. */
export function TestNotice() {
  const [on, setOn] = useState(false);
  useEffect(() => { qaEnabled().then(setOn); }, []);
  if (!on) return null;
  return <p className="banner demo test-notice">Test version: reading aloud is recorded and saved on FFT's server so the app can be checked.</p>;
}
