import type { RecordMark } from '../lib/verify';

/**
 * Running record of a reading, in classic marks made friendly: words read right are plain; a word
 * read as something else shows what was said above it; a missed-out word is faded with a dash
 * above; an added word shows as "+word" where it came; words not reached are greyed.
 * The speech check can't tell self-corrections or words told by an adult, so those aren't marked.
 */
export default function RunningRecord({ record, audience = 'pupil' }: { record: RecordMark[]; audience?: 'pupil' | 'teacher' }) {
  const pupil = audience === 'pupil';
  const n = { sub: 0, omit: 0, ins: 0 };
  for (const m of record) if (m.kind === 'sub' || m.kind === 'omit' || m.kind === 'ins') n[m.kind]++;
  const clean = !n.sub && !n.omit && !n.ins;
  return (
    <div className="rr">
      <p className="rr-text">
        {record.map((m, i) => m.kind === 'ins'
          ? <span key={i} className="rr-w ins" title={`Added "${m.said}"`}><span className="rr-above">+{m.said}</span><span className="rr-caret" aria-hidden="true">^</span></span>
          : <span key={i} className={'rr-w ' + m.kind} title={m.kind === 'sub' ? `Said "${m.said}"` : m.kind === 'omit' ? 'Missed out' : m.kind === 'unread' ? 'Not reached' : undefined}>
              <span className="rr-above">{m.kind === 'sub' ? m.said : m.kind === 'omit' ? '—' : ' '}</span>
              <span className="rr-word">{m.word}</span>
            </span>)}
      </p>
      <ul className="rr-key" aria-label="Key">
        {clean
          ? <li>{pupil ? 'Every word read right. Brilliant!' : 'No errors marked.'}</li>
          : <>
              {n.sub > 0 && <li><span className="rr-w sub"><span className="rr-word">word</span></span> {pupil ? `said something else (${n.sub}): what you said is above it` : `substitution (${n.sub}): what was said is above`}</li>}
              {n.omit > 0 && <li><span className="rr-w omit"><span className="rr-word">word</span></span> {pupil ? `missed out (${n.omit})` : `omission (${n.omit})`}</li>}
              {n.ins > 0 && <li><span className="rr-ins-key">+word</span> {pupil ? `added a word (${n.ins})` : `insertion (${n.ins}, not counted as an error)`}</li>}
            </>}
      </ul>
    </div>
  );
}
