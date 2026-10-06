import { useState } from 'react';
import { saveReview, type QaRecording } from '../lib/qa';
import { appWords, compare, summarise, type Review, type ReviewItem, type Summary } from '../lib/review';
import type { RecordMark } from '../lib/verify';
import RunningRecord from './RunningRecord';

const REVIEWER = 'btc-reviewer';
const getReviewer = () => { try { return localStorage.getItem(REVIEWER) ?? ''; } catch { return ''; } };
const setReviewerStore = (v: string) => { try { localStorage.setItem(REVIEWER, v); } catch { /* not kept */ } };
const pct = (v: number) => `${Math.round(v * 100)}%`;

/** Recordings that can be reviewed: ones with the text the pupil read and the app's marks for it. */
export const reviewable = (r: QaRecording) => r.type !== 'warmup' && Array.isArray(r.check?.record) && (r.check!.record as RecordMark[]).length > 0;

/** App's page decision for a page read or re-read (undefined for timed reads). */
const appCounted = (r: QaRecording) => (r.type === 'timed' ? undefined : (r.check?.verified as boolean | undefined));

export const reviewItems = (list: QaRecording[]): ReviewItem[] =>
  list.filter(r => r.review && reviewable(r)).map(r => ({ record: r.check!.record as RecordMark[], review: r.review!, appCounted: appCounted(r), provider: r.provider, type: r.type }));

/**
 * The adult listens and taps the words the pupil got wrong or missed out, without seeing the app's
 * marks (so they aren't swayed by them). Saving shows where the two agreed.
 */
export default function ReviewMarking({ r, onSaved, onClose }: { r: QaRecording; onSaved: (rv: Review) => void; onClose: () => void }) {
  const record = r.check!.record as RecordMark[];
  const words = appWords(record).map(m => m.word);
  const [wrong, setWrong] = useState<Set<number>>(new Set(r.review?.wrong ?? []));
  const [stoppedAt, setStoppedAt] = useState<number | undefined>(r.review?.stoppedAt);
  const [settingStop, setSettingStop] = useState(false);
  const [counted, setCounted] = useState<boolean | null>(r.review?.counted ?? null);
  const [note, setNote] = useState(r.review?.note ?? '');
  const [reviewer, setReviewer] = useState(getReviewer);
  const [saved, setSaved] = useState<Review | null>(r.review ?? null);
  const [problem, setProblem] = useState('');
  const page = r.type !== 'timed';
  // Timed reads cover the whole story: show the first part (plenty for a minute's reading) unless asked.
  const [showAll, setShowAll] = useState(page);
  const shown = showAll ? words.length : Math.min(words.length, Math.max(260, (stoppedAt ?? 0) + 40));

  const tap = (i: number) => {
    if (settingStop) { setStoppedAt(i); setSettingStop(false); return; }
    if (stoppedAt !== undefined && i > stoppedAt) return;
    const next = new Set(wrong);
    next.has(i) ? next.delete(i) : next.add(i);
    setWrong(next);
  };
  const save = async () => {
    setProblem('');
    setReviewerStore(reviewer);
    const body = { wrong: [...wrong].filter(i => stoppedAt === undefined || i <= stoppedAt), stoppedAt, counted: page ? counted : null, note, reviewer };
    try { const rv = await saveReview(r.id, body); setSaved(rv); onSaved(rv); }
    catch { setProblem('Could not save the review. Check the connection and try again.'); }
  };
  const result = saved ? compare(record, saved) : null;
  const listOf = (pick: (app: boolean, adult: boolean) => boolean) => {
    const app = appWords(record), adult = new Set(saved?.wrong ?? []);
    const last = saved?.stoppedAt ?? app.reduce((l, m, i) => (m.kind !== 'unread' ? i : l), -1);
    return app.map((m, i) => ({ m, i })).filter(({ m, i }) => i <= last && pick(m.kind !== 'ok', adult.has(i))).map(({ m }) => m.word.replace(/[^\p{L}\p{N}'’-]/gu, '')).join(', ');
  };

  return (
    <div className="review">
      {r.audio ? <audio controls preload="auto" src={`api/qa/recordings/${r.id}/audio`} className="dl-audio" /> : <p className="hint">No recording for this read, so it can't be reviewed by ear.</p>}
      <p className="hint">
        Listen, then tap each word the pupil read wrongly or missed out (tap again to undo). Count a word as right if it was
        self-corrected or said in the pupil's own accent. Don't count added words.
        {!page && ' If the pupil did not reach the end, tap "Where they stopped", then the last word they read.'}
      </p>
      <div className="row wrap">
        <button className={'btn ' + (settingStop ? 'btn-navy' : 'btn-ghost')} onClick={() => setSettingStop(!settingStop)}>
          {settingStop ? 'Now tap the last word read' : 'Where they stopped'}
        </button>
        {stoppedAt !== undefined && <button className="link" onClick={() => setStoppedAt(undefined)}>Clear stopping point</button>}
        <span className="hint">{wrong.size} marked wrong</span>
      </div>
      <p className="review-words">
        {words.slice(0, shown).map((w, i) => (
          <button key={i} type="button" onClick={() => tap(i)}
            className={'rv-w' + (wrong.has(i) ? ' wrong' : '') + (stoppedAt !== undefined && i > stoppedAt ? ' after' : '') + (stoppedAt === i ? ' stop' : '')}
            aria-pressed={wrong.has(i)}>{w}</button>
        ))}
        {shown < words.length && <button type="button" className="link" onClick={() => setShowAll(true)}>Show the rest of the text…</button>}
      </p>
      {page && (
        <div className="row wrap">
          <span>Would you count this page as read?</span>
          <button className={'btn ' + (counted === true ? 'btn-navy' : 'btn-ghost')} onClick={() => setCounted(true)}>Yes</button>
          <button className={'btn ' + (counted === false ? 'btn-navy' : 'btn-ghost')} onClick={() => setCounted(false)}>No</button>
        </div>
      )}
      <div className="row wrap">
        <label className="check">Your initials <input value={reviewer} maxLength={60} onChange={e => setReviewer(e.target.value)} size={6} /></label>
        <label className="check grow">Note <input value={note} maxLength={1000} onChange={e => setNote(e.target.value)} placeholder="e.g. background noise, quiet voice" /></label>
      </div>
      <p className="hint">Notes are for testing the app: don't include the pupil's name.</p>
      <div className="row wrap">
        <button className="btn btn-orange" onClick={save}>{saved ? 'Save changes' : 'Save and compare with the app'}</button>
        <button className="btn btn-ghost" onClick={onClose}>Close</button>
      </div>
      {problem && <p className="banner retry">{problem}</p>}
      {saved && result && (
        <div className="review-result">
          <h4>You and the app</h4>
          <p>Agreed on <b>{result.bothRight + result.bothWrong} of {result.words}</b> words ({pct(result.words ? (result.bothRight + result.bothWrong) / result.words : 0)}).</p>
          <ul>
            <li>Both marked wrong: {result.bothWrong}{result.bothWrong ? ` (${listOf((a, b) => a && b)})` : ''}</li>
            <li>App marked wrong, you heard it right: {result.falseAlarms}{result.falseAlarms ? ` (${listOf((a, b) => a && !b)})` : ''}</li>
            <li>You heard an error the app accepted: {result.missed}{result.missed ? ` (${listOf((a, b) => !a && b)})` : ''}</li>
            {page && typeof saved.counted === 'boolean' && appCounted(r) !== undefined && (
              <li>Page decision: you said {saved.counted ? 'count it' : "don't count it"}; the app {appCounted(r) ? 'counted it' : "didn't count it"}{saved.counted === appCounted(r) ? ' ✓' : ' ✗'}</li>
            )}
          </ul>
          <details><summary>The app's running record</summary><RunningRecord record={record} audience="teacher" /></details>
        </div>
      )}
    </div>
  );
}

/** Totals across every reviewed recording, with what they mean for tuning. */
export function ReviewSummary({ list }: { list: QaRecording[] }) {
  const items = reviewItems(list);
  const toReview = list.filter(r => reviewable(r) && r.audio && !r.review).length;
  const all = summarise(items);
  const byProvider = [...new Set(items.map(i => i.provider ?? 'unknown'))].map(p => [p, summarise(items.filter(i => (i.provider ?? 'unknown') === p))] as const);
  return (
    <div className="review-summary">
      <h3>Marking check</h3>
      <p className="hint">
        Adults listen to recordings and mark them without seeing the app's marks; the totals show how often the app agrees.
        {toReview > 0 && ` ${toReview} recording${toReview === 1 ? '' : 's'} waiting to be reviewed.`}
      </p>
      {items.length === 0 ? <p className="hint">No recordings reviewed yet. Choose "Review marking" on any read below.</p> : <>
        <table className="review-table">
          <thead><tr><th>Speech check</th><th>Reviewed</th><th>Words</th><th>Agreed</th><th>Right words marked wrong</th><th>Errors missed</th><th>Page decisions agreed</th></tr></thead>
          <tbody>
            {[['All', all] as const, ...(byProvider.length > 1 ? byProvider : [])].map(([p, s]) => <Row key={p} name={p} s={s} />)}
          </tbody>
        </table>
        <p className="hint">{advice(all)}</p>
      </>}
    </div>
  );
}

function Row({ name, s }: { name: string; s: Summary }) {
  return (
    <tr><td>{name}</td><td>{s.reviewed}</td><td>{s.agree.words}</td><td>{pct(s.agreement)}</td><td>{pct(s.falseAlarmRate)}</td><td>{pct(s.missRate)}</td>
      <td>{s.pages ? `${s.pageAgree} of ${s.pages}${s.tooStrict ? ` · ${s.tooStrict} too strict` : ''}${s.tooLenient ? ` · ${s.tooLenient} too lenient` : ''}` : '–'}</td></tr>
  );
}

/** Plain reading of the totals. Thresholds are a starting point for the calibration plan, not settled. */
function advice(s: Summary): string {
  if (s.agree.words < 300) return 'Too few words reviewed to judge yet: aim for at least 30 reads from 5–10 pupils, including quiet readers and different accents.';
  const parts: string[] = [];
  if (s.falseAlarmRate > 0.05) parts.push('The app marks too many correctly read words as wrong, which is unfair on pupils: look at accent and quiet-voice cases first.');
  if (s.missRate > 0.4) parts.push('The app misses a large share of real errors, so accuracy and WCPM will read high.');
  if (s.tooStrict > s.tooLenient && s.tooStrict >= 2) parts.push('The page check refuses pages adults would count: the 80% "heard" threshold may be too high.');
  if (s.tooLenient > s.tooStrict && s.tooLenient >= 2) parts.push('The page check counts pages adults would not: the threshold may be too low.');
  return parts.length ? parts.join(' ') : 'The app and the adults agree closely so far.';
}
