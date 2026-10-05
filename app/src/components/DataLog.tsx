import { useState } from 'react';
import type { Attempt } from '../types';
import type { ReadingEvent } from '../lib/rewards';
import { download, KIND_LABEL, logRows, toCsv, type LogKind } from '../lib/dataLog';

const FILTERS: { label: string; kinds: LogKind[] }[] = [
  { label: 'Everything', kinds: ['page', 'reread', 'warmup', 'timed', 'marking', 'points', 'badge'] },
  { label: 'Page reads', kinds: ['page'] },
  { label: 'Re-reads', kinds: ['reread'] },
  { label: 'Warm-up words', kinds: ['warmup'] },
  { label: 'Timed reads', kinds: ['timed', 'marking'] },
  { label: 'Power and badges', kinds: ['points', 'badge'] },
];

const stamp = (iso: string) => new Date(iso).toLocaleString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', second: '2-digit' });

/** QA view: every record stored on this device for one reader, newest first. */
export default function DataLog({ code, events, attempts, example }: { code: string; events: ReadingEvent[]; attempts: Attempt[]; example?: boolean }) {
  const [filter, setFilter] = useState(0);
  const all = logRows(events, attempts);
  const rows = all.filter(r => FILTERS[filter].kinds.includes(r.kind));
  const file = `power-reader-${code}-${new Date().toISOString().slice(0, 10)}`;
  const count = (kinds: LogKind[]) => all.filter(r => kinds.includes(r.kind)).length;

  return (
    <section className="panel datalog">
      <div className="row wrap between">
        <h3>Data log (QA)</h3>
        <div className="row wrap">
          <button className="btn btn-ghost" onClick={() => download(file + '.csv', toCsv(all.map(row => ({ readerCode: code, row }))), 'text/csv')}>Download CSV</button>
          <button className="btn btn-ghost" onClick={() => download(file + '.json', JSON.stringify({ readerCode: code, exportedAt: new Date().toISOString(), app: __BUILD_INFO__, events, attempts }, null, 2), 'application/json')}>Download JSON</button>
        </div>
      </div>
      <p className="hint">
        Every record saved for {code} on this device, exactly as stored{example ? ' (made-up example data)' : ''}. Nothing is stored online.
        No recordings of the pupil's voice are kept: only the results of each check.
      </p>
      <div className="seg datalog-filter" role="group" aria-label="Show">
        {FILTERS.map((f, i) => <button key={f.label} className={i === filter ? 'on' : ''} aria-pressed={i === filter} onClick={() => setFilter(i)}>{f.label} ({count(f.kinds)})</button>)}
      </div>
      {rows.length === 0 ? <p className="hint">Nothing recorded yet.</p> : (
        <ol className="datalog-list">
          {rows.map((r, i) => (
            <li key={i} className={'dl-' + r.kind}>
              <div className="dl-head">
                <span className="dl-time">{stamp(r.date)}</span>
                <span className="dl-kind">{KIND_LABEL[r.kind]}</span>
                <strong className="dl-what">{r.what}</strong>
                {r.result && <span className={'status ' + (r.result.ok ? 'on-track' : 'behind')}><span aria-hidden="true">{r.result.ok ? '✓' : '✗'}</span> {r.result.text}</span>}
              </div>
              {r.details.length > 0 && <p className="dl-details">{r.details.join(' · ')}</p>}
              <details className="dl-raw"><summary>All fields</summary><pre>{JSON.stringify(r.raw, null, 2)}</pre></details>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
