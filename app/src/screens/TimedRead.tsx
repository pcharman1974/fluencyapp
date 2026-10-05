import { useEffect, useMemo, useRef, useState } from 'react';
import type { Attempt, Story } from '../types';
import type { Screen } from '../App';
import { tokenisePages, type Token } from '../lib/text';
import { alignHeard, errorsFromAlignment, scoreReading } from '../lib/scoring';
import { providers, type SpeechProvider, type SpeechResult } from '../lib/speech';
import { saveAttempt, getAttempts } from '../lib/storage';
import { sendRecording, startRecording, type QaRecorder } from '../lib/qa';
import Gauge from '../components/Gauge';
import type { Reader, RecordResult } from '../lib/useReader';
import type { Award } from '../lib/rewards';

interface Props { story: Story; reader: string; state: Reader; go: (s: Screen) => void; onAward: (a: RecordResult) => void }

type Phase = 'setup' | 'countdown' | 'reading' | 'analysing' | 'results';

const DURATION = 60;

export default function TimedRead({ story, reader, state, go, onAward }: Props) {
  const tokens = useMemo(() => tokenisePages(story.pages), [story]);
  const [phase, setPhase] = useState<Phase>('setup');
  const [speechReady, setSpeechReady] = useState(false);
  const [count, setCount] = useState(3);
  const [elapsed, setElapsed] = useState(0);
  const [errors, setErrors] = useState<Set<number>>(new Set());
  const [checks, setChecks] = useState<Set<number>>(new Set());
  const [lastWord, setLastWord] = useState<number | null>(null);
  const [heardCount, setHeardCount] = useState(0);
  const [speech, setSpeech] = useState<SpeechResult | null>(null);
  const [problem, setProblem] = useState('');
  const startedAt = useRef(0);
  const session = useRef<{ stop(): Promise<SpeechResult> } | null>(null);
  const saved = useRef(false);
  const recorder = useRef<QaRecorder | null>(null);
  const audio = useRef<Blob | null>(null);
  useEffect(() => () => recorder.current?.cancel(), []);
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
    // Marked automatically: the real speech check if the server has one, otherwise demo data.
    const provider: SpeechProvider = speechReady ? azure : demo;
    try {
      session.current = await provider.start(tokens.map(t => t.display).join(' '), setHeardCount);
    } catch {
      setProblem('The microphone or speech service could not start. Check the microphone is allowed for this page, then try again.');
      setPhase('setup');
      return;
    }
    recorder.current = await startRecording();
    startedAt.current = Date.now();
    setElapsed(0);
    setPhase('reading');
  }

  async function finish() {
    const secs = Math.min(DURATION, (Date.now() - startedAt.current) / 1000);
    setElapsed(secs);
    audio.current = (await recorder.current?.stop()) ?? null; recorder.current = null;
    if (!session.current) return;
    setPhase('analysing');
    const heard = await session.current.stop();
    session.current = null;
    setSpeech(heard);
    const a = alignHeard(tokens, heard.words.filter(w => w.startSec === undefined || w.startSec <= secs));
    if (a.lastWordIndex < 0) {
      setProblem("We didn't hear any reading. Check the microphone is on and allowed for this page, then try again.");
      setPhase('setup');
      return;
    }
    const errs = new Set(errorsFromAlignment(a));
    setErrors(errs);
    setChecks(new Set(a.words.filter(w => w.check).map(w => w.refIndex)));
    setLastWord(a.lastWordIndex);
    save(scoreReading(a.lastWordIndex, errs, Math.round(secs)), a.lastWordIndex, errs, heard);
    setPhase('results');
  }

  const result = lastWord !== null ? scoreReading(lastWord, errors, Math.round(elapsed)) : null;

  /** Saves the automatically marked result (no adult marking step). */
  function save(r: NonNullable<typeof result>, last: number, errs: Set<number>, heard: SpeechResult) {
    if (saved.current) return;
    const errorWords = [...errs].filter(i => i <= last).sort((a, b) => a - b).map(i => tokens[i].display);
    const attempt: Attempt = {
      readerCode: reader, storyId: story.id, date: new Date().toISOString(), method: speechReady ? 'speech' : 'demo',
      seconds: r.seconds, wordsRead: r.wordsRead, errors: r.errors, wcpm: r.wcpm,
      accuracy: r.accuracy, errorWords, speechScores: heard.scores,
    };
    saveAttempt(attempt);
    sendRecording(reader, { type: 'timed', storyId: story.id }, { attempt, heard: heard.words.map(w => w.text).join(' '), provider: heard.provider }, audio.current);
    onAward(state.record({ type: 'timed', storyId: story.id, wcpm: r.wcpm, errorWords }));
    saved.current = true;
  }

  // ---------- Screens ----------

  if (phase === 'setup') return (
    <div className="timed">
      <button className="btn btn-ghost" onClick={() => go({ name: 'home' })}>← Back</button>
      <section className="panel setup">
        <h2>One-minute timed read</h2>
        <p>Read <strong>{story.title}</strong> aloud from the start for one minute. Read carefully and at a steady pace. Don't rush. If you get stuck on a word, have a go and carry on.</p>
        <p className="hint">{speechReady
          ? 'The app listens and marks your reading automatically.'
          : 'The speech check isn\'t set up on this server yet, so this read is marked with made-up demo data.'}</p>
        {problem && <p className="problem">{problem}</p>}
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
        <div className="clock" aria-live="off">{remaining}</div>
        <div className="progress"><div style={{ width: (elapsed / DURATION) * 100 + '%' }} /></div>
        <span className="mic"><span className="mic-dot" /> Listening{heardCount ? ` · ${heardCount} words` : ''}</span>
        <button className="btn btn-ghost" onClick={finish}>Finish early</button>
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
              return <span key={t.index}><span className={cls} >{t.display}</span>{' '}</span>;
            })}
          </p>
        ))}
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return <div className="stat"><span className="stat-value">{value}</span><span className="stat-label">{label}</span></div>;
}
