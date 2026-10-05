import { useEffect, useMemo, useRef, useState } from 'react';
import type { Attempt, Story } from '../types';
import type { Screen } from '../App';
import { tokenisePages, type Token } from '../lib/text';
import { alignHeard, errorsFromAlignment, scoreReading } from '../lib/scoring';
import { providers, type SpeechProvider, type SpeechResult } from '../lib/speech';
import { saveAttempt, getAttempts } from '../lib/storage';
import Gauge from '../components/Gauge';
import type { Reader, RecordResult } from '../lib/useReader';
import type { Award } from '../lib/rewards';

interface Props { story: Story; reader: string; state: Reader; go: (s: Screen) => void; onAward: (a: RecordResult) => void }

type Phase = 'setup' | 'countdown' | 'reading' | 'analysing' | 'mark' | 'results';
type Method = 'adult' | 'speech' | 'demo';

const DURATION = 60;

export default function TimedRead({ story, reader, state, go, onAward }: Props) {
  const tokens = useMemo(() => tokenisePages(story.pages), [story]);
  const [phase, setPhase] = useState<Phase>('setup');
  const [method, setMethod] = useState<Method>('adult');
  const [speechReady, setSpeechReady] = useState(false);
  const [count, setCount] = useState(3);
  const [elapsed, setElapsed] = useState(0);
  const [errors, setErrors] = useState<Set<number>>(new Set());
  const [checks, setChecks] = useState<Set<number>>(new Set());
  const [lastWord, setLastWord] = useState<number | null>(null);
  const [markMode, setMarkMode] = useState<'errors' | 'last'>('last');
  const [heardCount, setHeardCount] = useState(0);
  const [speech, setSpeech] = useState<SpeechResult | null>(null);
  const [problem, setProblem] = useState('');
  const startedAt = useRef(0);
  const session = useRef<{ stop(): Promise<SpeechResult> } | null>(null);
  const saved = useRef(false);
  const [history] = useState(() => getAttempts(reader).filter(a => a.storyId === story.id));

  const azure = providers.find(p => p.id === 'azure')!;
  const demo = providers.find(p => p.id === 'demo')!;
  useEffect(() => { azure.available().then(setSpeechReady); }, []);

  // 3-2-1 countdown, then start the clock (and the microphone if used).
  useEffect(() => {
    if (phase !== 'countdown') return;
    if (count === 0) { begin(); return; }
    const t = setTimeout(() => setCount(count - 1), 800);
    return () => clearTimeout(t);
  }, [phase, count]);

  useEffect(() => {
    if (phase !== 'reading') return;
    const t = setInterval(() => {
      const s = (Date.now() - startedAt.current) / 1000;
      setElapsed(Math.min(s, DURATION));
      if (s >= DURATION) finish();
    }, 200);
    return () => clearInterval(t);
  }, [phase]);

  async function begin() {
    setProblem('');
    const provider: SpeechProvider | null = method === 'speech' ? azure : method === 'demo' ? demo : null;
    if (provider) {
      try {
        session.current = await provider.start(tokens.map(t => t.display).join(' '), setHeardCount);
      } catch (e) {
        setProblem('The microphone or speech service could not start. Carry on and the adult can mark the reading instead.');
        setMethod('adult');
      }
    }
    startedAt.current = Date.now();
    setElapsed(0);
    setPhase('reading');
  }

  async function finish() {
    const secs = Math.min(DURATION, (Date.now() - startedAt.current) / 1000);
    setElapsed(secs);
    if (session.current) {
      setPhase('analysing');
      const result = await session.current.stop();
      session.current = null;
      setSpeech(result);
      const a = alignHeard(tokens, result.words.filter(w => w.startSec === undefined || w.startSec <= secs));
      setErrors(new Set(errorsFromAlignment(a)));
      setChecks(new Set(a.words.filter(w => w.check).map(w => w.refIndex)));
      setLastWord(a.lastWordIndex >= 0 ? a.lastWordIndex : null);
      setMarkMode('errors');
    } else {
      setMarkMode('last');
    }
    setPhase('mark');
  }

  const toggleError = (i: number) => setErrors(e => { const n = new Set(e); n.has(i) ? n.delete(i) : n.add(i); return n; });

  const tapWord = (t: Token) => {
    if (phase === 'reading' && method === 'adult') toggleError(t.index);
    if (phase === 'mark') markMode === 'last' ? setLastWord(t.index) : toggleError(t.index);
  };

  const result = lastWord !== null ? scoreReading(lastWord, errors, Math.round(elapsed)) : null;

  const showResults = () => {
    if (!result) return;
    if (!saved.current) {
      const errorWords = [...errors].filter(i => i <= lastWord!).sort((a, b) => a - b).map(i => tokens[i].display);
      const attempt: Attempt = {
        readerCode: reader, storyId: story.id, date: new Date().toISOString(), method,
        seconds: result.seconds, wordsRead: result.wordsRead, errors: result.errors, wcpm: result.wcpm,
        accuracy: result.accuracy, errorWords, speechScores: speech?.scores,
      };
      saveAttempt(attempt);
      onAward(state.record({ type: 'timed', storyId: story.id, wcpm: result.wcpm, errorWords }));
      saved.current = true;
    }
    setPhase('results');
  };

  // ---------- Screens ----------

  if (phase === 'setup') return (
    <div className="timed">
      <button className="btn btn-ghost" onClick={() => go({ name: 'home' })}>← Back</button>
      <section className="panel setup">
        <h2>One-minute timed read</h2>
        <p>Read <strong>{story.title}</strong> aloud from the start for one minute. Read carefully and at a steady pace. Don't rush. If you get stuck on a word for a few seconds, the adult will tell you it and you carry on.</p>
        <h3>How will the reading be checked?</h3>
        <div className="choices" role="radiogroup">
          <Choice on={method === 'adult'} onClick={() => setMethod('adult')} title="Adult marks it"
            text="The adult sits alongside and taps any word read wrongly, skipped, or told to the reader. Afterwards they tap the last word read." />
          <Choice on={method === 'speech'} disabled={!speechReady} onClick={() => setMethod('speech')} title="Speech check"
            text={speechReady ? 'The microphone listens and marks the reading. The adult checks and corrects the marking afterwards.' : 'Not set up on this server yet (needs an Azure Speech key).'} />
          <Choice on={method === 'demo'} onClick={() => setMethod('demo')} title="Demo"
            text="Try the speech check with made-up data. Nothing is recorded." />
        </div>
        <button className="btn btn-orange btn-big" onClick={() => { setCount(3); setPhase('countdown'); }}>Start</button>
      </section>
    </div>
  );

  if (phase === 'countdown') return <div className="countdown" aria-live="assertive">{count || 'Go!'}</div>;

  if (phase === 'analysing') return <div className="centre"><p className="big-msg">Checking the reading…</p></div>;

  if (phase === 'results' && result) {
    const errorWords = [...new Set([...errors].filter(i => i <= lastWord!).map(i => tokens[i].display.replace(/[^\p{L}\p{N}'’-]/gu, '')))];
    return (
      <div className="timed">
        <section className="panel results">
          <Gauge value={result.wcpm} first={history[0]?.wcpm} best={Math.max(result.wcpm, ...history.map(h => h.wcpm))} />
          {history.length > 0 && <p className="big-msg">{result.wcpm > Math.max(...history.map(h => h.wcpm)) ? 'New best timed read!' : result.wcpm > history[0].wcpm ? `${result.wcpm - history[0].wcpm} more than your first timed read` : 'Keep practising: your gauge will move up.'}</p>}
          <div className="stats">
            <Stat label="Accuracy" value={Math.round(result.accuracy * 100) + '%'} />
            <Stat label="Words read" value={String(result.wordsRead)} />
            <Stat label="Errors" value={String(result.errors)} />
            <Stat label="Time" value={result.seconds + 's'} />
          </div>
          {result.seconds < 30 && lastWord! < tokens.length - 1 && (
            <p className="problem">This read lasted under 30 seconds, so the words-per-minute figure is not reliable. Try a full minute next time.</p>
          )}
          {speech?.scores && (
            <div className="speech-scores">
              <h3>From the speech check <span className="tag">guide only</span></h3>
              <div className="stats">
                {speech.scores.fluency !== undefined && <Stat label="Fluency" value={String(speech.scores.fluency)} />}
                {speech.scores.prosody !== undefined && <Stat label="Expression" value={String(speech.scores.prosody)} />}
                {speech.scores.pronunciation !== undefined && <Stat label="Pronunciation" value={String(speech.scores.pronunciation)} />}
              </div>
              <p className="hint">Scores out of 100 from {speech.provider}. Use them alongside what you heard, not instead of it.</p>
            </div>
          )}
          {errorWords.length > 0 && (
            <div>
              <h3>Words to practise</h3>
              <p className="word-list">{errorWords.map(w => <span key={w} className="chip">{w}</span>)}</p>
            </div>
          )}
          <div className="row wrap">
            <button className="btn btn-orange" onClick={() => go({ name: 'practice', focusWords: errorWords })}>Practise these words</button>
            <button className="btn btn-navy" onClick={() => go({ name: 'progress' })}>See my progress</button>
            <button className="btn btn-ghost" onClick={() => go({ name: 'home' })}>Home</button>
          </div>
        </section>
      </div>
    );
  }

  // reading + mark share the passage view
  const remaining = Math.max(0, Math.ceil(DURATION - elapsed));
  return (
    <div className="timed">
      <div className="timer-bar">
        {phase === 'reading' ? (
          <>
            <div className="clock" aria-live="off">{remaining}</div>
            <div className="progress"><div style={{ width: (elapsed / DURATION) * 100 + '%' }} /></div>
            {method !== 'adult' && <span className="mic"><span className="mic-dot" /> Listening{heardCount ? ` · ${heardCount} words` : ''}</span>}
            {method === 'adult' && <span className="hint">Adult: tap any word read wrongly</span>}
            <button className="btn btn-ghost" onClick={finish}>Finish early</button>
          </>
        ) : (
          <>
            <div className="mark-help">
              <strong>{markMode === 'last' ? 'Tap the last word read' : 'Tap words to mark or unmark errors'}</strong>
              {speech && <span className="hint"> · Marking from {speech.provider}. Check it matches what you heard. Words with a dotted line were unclear; they are not counted as errors.</span>}
            </div>
            <div className="seg" role="group">
              <button className={markMode === 'last' ? 'on' : ''} onClick={() => setMarkMode('last')}>Last word</button>
              <button className={markMode === 'errors' ? 'on' : ''} onClick={() => setMarkMode('errors')}>Errors</button>
            </div>
            <button className="btn btn-orange" disabled={lastWord === null} onClick={showResults}>
              {result ? `See result: ${result.wcpm} WCPM` : 'See result'}
            </button>
          </>
        )}
      </div>
      {problem && <p className="problem">{problem}</p>}
      <section className="panel passage" aria-label="Reading passage">
        {story.pages.map(p => (
          <p key={p.page} className="reading-text">
            {tokens.filter(t => t.page === p.page).map(t => {
              const cls = ['word', 'tappable',
                errors.has(t.index) ? 'error' : '',
                checks.has(t.index) ? 'check' : '',
                lastWord !== null && t.index > lastWord ? 'unread' : '',
                t.index === lastWord ? 'last' : '',
              ].filter(Boolean).join(' ');
              return <span key={t.index}><span className={cls} onClick={() => tapWord(t)}>{t.display}</span>{' '}</span>;
            })}
          </p>
        ))}
      </section>
    </div>
  );
}

function Choice({ on, disabled, onClick, title, text }: { on: boolean; disabled?: boolean; onClick: () => void; title: string; text: string }) {
  return (
    <button role="radio" aria-checked={on} disabled={disabled} className={'choice' + (on ? ' on' : '')} onClick={onClick}>
      <strong>{title}</strong><span>{text}</span>
    </button>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return <div className="stat"><span className="stat-value">{value}</span><span className="stat-label">{label}</span></div>;
}
