import { useEffect, useMemo, useRef, useState } from 'react';
import type { Story } from '../types';
import type { Screen } from '../App';
import PageView from '../components/PageView';
import ReadAloud from '../components/ReadAloud';
import StoryCards, { cardsCollected } from '../components/StoryCards';
import { CheckBanner } from './Practice';
import { GoalRing, Badge, TodayBar } from '../components/Rewards';
import { bestReread, dayKey, PB_ACCURACY, sessionDays, sessionsInWeek, trickyWords, WEEKLY_TARGET, type Award, type BadgeId, type SelfAnswer, type SpeechScores } from '../lib/rewards';
import type { SpeechProvider } from '../lib/speech';
import type { Reader, RecordResult } from '../lib/useReader';
import { checkDetail, type PageCheck } from '../lib/verify';
import { canSpeak, speak } from '../lib/voice';
import { normalise } from '../lib/text';
import { loadManifest, playWord, type AudioManifest } from '../lib/pageAudio';

interface Props { story: Story; base: string; reader: Reader; provider: SpeechProvider | null; go: (s: Screen) => void; onAward: (a: RecordResult) => void }

type Step = 'warmup' | 'read' | 'reread' | 'done';
const PAGES_PER_SESSION = 3;

/** Today's session: read pages aloud (listen first), your best reading of one page, then practise words. */
export default function Session({ story, base, reader, provider, go, onAward }: Props) {
  const plan = useMemo(() => {
    const got = cardsCollected(reader.events, story.id);
    const unread = story.pages.map(p => p.page).filter(p => !got.has(p));
    const pages = (unread.length ? unread : story.pages.map(p => p.page)).slice(0, PAGES_PER_SESSION);
    // Word practice at the end: 2 chosen words from today's pages, then 2 the pupil got wrong before.
    const chosen = pages.flatMap(p => story.pages[p - 1].warmupWords ?? []).slice(0, 2);
    const tricky = trickyWords(reader.events, 6).filter(w => !chosen.some(c => c.toLowerCase() === w.toLowerCase())).slice(0, 2);
    const words = [...chosen.map(w => ({ word: w, why: "From today's pages" })), ...tricky.map(w => ({ word: w, why: 'Tricky last time' }))];
    return { words, pages };
  }, []); // fixed for the session
  const [step, setStep] = useState<Step>('read');
  const earned = useRef<{ points: number; badges: BadgeId[]; pages: number[] }>({ points: 0, badges: [], pages: [] });
  const startedWeek = useRef(sessionsInWeek(reader.events, new Date().toISOString()));

  const take = (a: RecordResult) => {
    earned.current.points += a.points.reduce((s, p) => s + p.amount, 0);
    earned.current.badges.push(...a.badges);
    onAward(a);
  };

  // Start with reading; practise words at the end.
  const steps: { id: Step; name: string }[] = [
    { id: 'read', name: 'Read' }, { id: 'reread', name: 'Your best reading' },
    ...(plan.words.length ? [{ id: 'warmup' as Step, name: 'Word practice' }] : []),
    { id: 'done', name: 'Done' },
  ];
  const stepper = (<>
    <ol className="stepper" aria-label="Session steps">
      {steps.map(s => <li key={s.id} className={s.id === step ? 'on' : steps.findIndex(x => x.id === s.id) < steps.findIndex(x => x.id === step) ? 'past' : ''}>{s.name}</li>)}
    </ol>
    <TodayBar events={reader.events} compact />
  </>);

  if (step === 'warmup') return <WarmUp storyBase={base} words={plan.words} provider={provider} reader={reader} stepper={stepper} onAward={take} onDone={() => setStep('done')} go={go} />;
  if (step === 'read') return <ReadPages story={story} base={base} pages={plan.pages} reader={reader} provider={provider} stepper={stepper}
    onAward={take} onPage={p => earned.current.pages.push(p)} onDone={() => setStep('reread')} go={go} />;
  if (step === 'reread') return <ReRead story={story} base={base} page={earned.current.pages[0] ?? plan.pages[0]} reader={reader} provider={provider}
    stepper={stepper} onAward={take} onDone={() => setStep(plan.words.length ? 'warmup' : 'done')} go={go} />;

  const week = sessionsInWeek(reader.events, new Date().toISOString());
  const todayFull = sessionDays(reader.events).has(dayKey(new Date().toISOString()));
  return (
    <div className="timed session-done">
      {stepper}
      <section className="panel results">
        <p className="result-label">Session complete</p>
        <p className="result-big"><span className="bolt big" aria-hidden="true" />+{earned.current.points}</p>
        <p className="result-label">Power earned</p>
        <div className="done-row">
          <GoalRing done={week} size={120} />
          <p className="big-msg">{week >= WEEKLY_TARGET && startedWeek.current < WEEKLY_TARGET ? 'Weekly goal hit!' : week >= WEEKLY_TARGET ? 'Goal already hit this week. Extra reading still earns Power.' : `Fill your bar on ${WEEKLY_TARGET - week} more day${WEEKLY_TARGET - week === 1 ? '' : 's'} this week`}</p>
        </div>
        <TodayBar events={reader.events} />
        {!todayFull && <button className="btn btn-navy" onClick={() => go({ name: 'practice' })}>Keep reading to fill today's bar</button>}
        {earned.current.badges.length > 0 && <div className="badges">{[...new Set(earned.current.badges)].map(id => <Badge key={id} id={id} earned />)}</div>}
        {earned.current.pages.length > 0 && <>
          <h3>Story cards collected</h3>
          <StoryCards story={story} base={base} events={reader.events} highlight={earned.current.pages} />
        </>}
        <div className="row wrap">
          <button className="btn btn-orange" onClick={() => go({ name: 'home' })}>Finish</button>
          <button className="btn btn-navy" onClick={() => go({ name: 'timed' })}>Bonus: timed read (+10 Power)</button>
          <button className="btn btn-ghost" onClick={() => go({ name: 'progress' })}>My progress</button>
        </div>
      </section>
    </div>
  );
}

function WarmUp({ storyBase, words, provider, reader, stepper, onAward, onDone, go }: {
  storyBase: string; words: { word: string; why: string }[]; provider: SpeechProvider | null; reader: Reader; stepper: React.ReactNode;
  onAward: (a: Award) => void; onDone: () => void; go: (s: Screen) => void;
}) {
  const [i, setI] = useState(0);
  const [result, setResult] = useState<boolean | null>(null);
  const { word, why } = words[i];
  const [audio, setAudio] = useState<AudioManifest | null>(null);
  useEffect(() => { loadManifest(storyBase).then(setAudio); }, []);
  const recorded = audio?.words[word.toLowerCase()];
  const next = () => { setResult(null); i + 1 < words.length ? setI(i + 1) : onDone(); };
  return (
    <div className="timed">
      <div className="session-top"><button className="icon-btn" aria-label="Close" onClick={() => go({ name: 'home' })}>✕</button>{stepper}</div>
      <section className="panel warmup">
        <p className="hint">Practice word {i + 1} of {words.length}</p>
        <span className={'why ' + (why.startsWith('Tricky') ? 'tricky' : 'new')}>{why}</span>
        <p className="warm-word">{word}</p>
        {result === null && <p className="hint">Press Say it and read the word aloud. Then you can move on.</p>}
        {result !== null && <p className={'banner ' + (result ? 'ok' : 'retry')}>{result ? '✓ Got it!' : `Not quite. Press Hear it, then try again.`}</p>}
        <div className="row wrap centre-row">
          {(canSpeak() || recorded) && <button className="btn btn-ghost" onClick={() => recorded ? playWord(storyBase + recorded) : speak(normalise(word), { rate: 0.75 })}>Hear it</button>}
          <ReadAloud key={i + ':' + result} text={word} provider={provider} label="Say it" doneLabel="Done" qa={{ type: 'warmup', word }}
            onResult={(c) => { const ok = c.accuracy === 1 && c.coverage === 1; setResult(ok); onAward(reader.record({ type: 'warmup', word, correct: ok, ...checkDetail(c, provider?.id), message: ok ? '✓ Got it!' : 'Not quite. Press Hear it, then try again.' })); }} />
          {/* Say the word (and get it checked) before moving on. */}
          <button className="btn btn-navy" disabled={result === null} title={result === null ? 'Say the word first' : undefined} onClick={next}>{i + 1 < words.length ? 'Next word →' : 'Finish →'}</button>
        </div>
      </section>
    </div>
  );
}

function ReadPages({ story, base, pages, reader, provider, stepper, onAward, onPage, onDone, go }: {
  story: Story; base: string; pages: number[]; reader: Reader; provider: SpeechProvider | null; stepper: React.ReactNode;
  onAward: (a: Award) => void; onPage: (p: number) => void; onDone: () => void; go: (s: Screen) => void;
}) {
  const [i, setI] = useState(0);
  const [check, setCheck] = useState<PageCheck | null>(null);
  const [recording, setRecording] = useState(false);
  const [heard, setHeard] = useState<number | null>(null); // page whose model reading has been heard
  const pageNo = pages[i];
  const page = story.pages[pageNo - 1];
  const lastOne = i === pages.length - 1;
  const listened = heard === pageNo;
  return (
    <PageView story={story} base={base} pageNo={pageNo} recording={recording} onClose={() => go({ name: 'home' })}
      modelFirst onListened={() => setHeard(pageNo)}
      title={`${page.heading} · page ${i + 1} of ${pages.length} today`}
      banner={<>{stepper}<CheckBanner check={check} demo={provider?.demo} /></>}
      footer={<>
        <span className="hint nav-hint">{listened ? 'Read it out loud, then tap "I\'ve finished".' : 'Listen first, then it\'s your turn.'}</span>
        {!listened ? <button className="btn btn-orange btn-mic" disabled title="Listen to the page first"><span className="mic-icon" aria-hidden="true" />Read aloud</button> : <ReadAloud key={pageNo + ':' + (check ? 'r' : '')} text={page.text} provider={provider} onRecording={setRecording} qa={{ type: 'page', storyId: story.id, page: pageNo }}
          label={check && !check.verified ? 'Try again' : 'Read aloud'}
          onResult={c => {
            setCheck(c);
            onAward(reader.record({ type: 'page', storyId: story.id, page: pageNo, verified: c.verified, ...checkDetail(c, provider?.id) }, { storyPages: story.pages.length }));
            if (c.verified) onPage(pageNo);
          }} />}
        <button className="btn btn-navy" disabled={!check?.verified || recording}
          onClick={() => { setCheck(null); lastOne ? onDone() : setI(i + 1); }}>
          {lastOne ? 'Your best reading →' : 'Next page →'}
        </button>
      </>} />
  );
}

function ReRead({ story, base, page: pageNo, reader, provider, stepper, onAward, onDone, go }: {
  story: Story; base: string; page: number; reader: Reader; provider: SpeechProvider | null; stepper: React.ReactNode;
  onAward: (a: Award) => void; onDone: () => void; go: (s: Screen) => void;
}) {
  const [check, setCheck] = useState<PageCheck | null>(null);
  const [scores, setScores] = useState<SpeechScores | undefined>();
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [recording, setRecording] = useState(false);
  const [prevBest] = useState(() => bestReread(reader.events, story.id, pageNo));
  const page = story.pages[pageNo - 1];
  useEffect(() => () => { if (audioUrl) URL.revokeObjectURL(audioUrl); }, [audioUrl]);
  const again = () => { setCheck(null); setScores(undefined); setAudioUrl(null); };

  if (check?.verified) {
    const accurate = check.accuracy >= PB_ACCURACY;
    const pb = prevBest !== undefined && check.wcpm > prevBest && accurate;
    return (
      <div className="timed">
        {stepper}
        <section className="panel results best-reading">
          <p className="result-label">{pb ? 'New personal best!' : prevBest === undefined ? 'Your first best reading of this page' : 'Best reading done'}</p>
          <p className="big-msg">{!accurate
            ? 'Some words were tricky this time. Go for every word right first, then make it smooth.'
            : pb ? 'Smoother than ever, and just as accurate. Brilliant reading!'
            : 'Well read! Listen back and think about how it sounded.'}</p>
          {audioUrl && (
            <div className="listen-back">
              <h3>Listen to yourself</h3>
              <audio controls src={audioUrl} />
            </div>
          )}
          <SelfCheck key={check.wcpm + ':' + check.durationSec} onDone={a => onAward(reader.record({ type: 'selfcheck', storyId: story.id, page: pageNo, ...a }))} />
          <div className="stats">
            <div className="stat"><span className="stat-value">{Math.round(check.accuracy * 100)}%</span><span className="stat-label">Words right</span></div>
            {scores?.prosody !== undefined && <div className="stat"><span className="stat-value">{scores.prosody}</span><span className="stat-label">Expression <span className="tag">{provider?.demo ? 'demo' : 'guide'}</span></span></div>}
            <div className="stat small"><span className="stat-value">{check.wcpm}</span><span className="stat-label">Words a minute{prevBest !== undefined ? ` (best ${Math.max(prevBest, accurate ? check.wcpm : 0)})` : ''}</span></div>
          </div>
          <div className="row wrap centre-row">
            <button className="btn btn-ghost" onClick={again}>Try it again</button>
            <button className="btn btn-orange" onClick={onDone}>Next →</button>
          </div>
        </section>
      </div>
    );
  }
  return (
    <PageView story={story} base={base} pageNo={pageNo} plain recording={recording} onClose={() => go({ name: 'home' })}
      title={`Your best reading: ${page.heading}`}
      banner={<>{stepper}
        <div className="storyteller" aria-label="How to read it">
          <strong>Read it like a storyteller:</strong>
          <span>Smooth, like talking</span><span>Pause at full stops and commas</span><span>Make your voice match the meaning</span>
        </div>
        {check && <CheckBanner check={check} />}</>}
      footer={<>
        <span className="hint nav-hint">Your best reading, all by yourself.</span>
        <ReadAloud key={String(!!check)} text={page.text} provider={provider} onRecording={setRecording} label={check ? 'Try again' : 'Start'} keepAudio
          qa={{ type: 'reread', storyId: story.id, page: pageNo }}
          onResult={(c, result, audio) => {
            setCheck(c); setScores(result.scores);
            if (audio) setAudioUrl(URL.createObjectURL(audio));
            onAward(reader.record({ type: 'reread', storyId: story.id, page: pageNo, verified: c.verified, ...checkDetail(c, provider?.id), scores: result.scores }));
          }} />
        <button className="btn btn-ghost" disabled={recording} onClick={onDone}>Skip</button>
      </>} />
  );
}

/** The pupil's own quick check on how their best reading sounded (prosody), in child-friendly words. */
function SelfCheck({ onDone }: { onDone: (a: { smooth: SelfAnswer; pauses: SelfAnswer; meaning: SelfAnswer }) => void }) {
  const [a, setA] = useState<Partial<Record<'smooth' | 'pauses' | 'meaning', SelfAnswer>>>({});
  const [saved, setSaved] = useState(false);
  const qs = [
    ['smooth', 'Did it sound smooth, like talking?'],
    ['pauses', 'Did you pause at full stops?'],
    ['meaning', 'Did your voice show the meaning?'],
  ] as const;
  const choose = (k: 'smooth' | 'pauses' | 'meaning', v: SelfAnswer) => {
    if (saved) return;
    const next = { ...a, [k]: v };
    setA(next);
    if (next.smooth && next.pauses && next.meaning) { setSaved(true); onDone(next as { smooth: SelfAnswer; pauses: SelfAnswer; meaning: SelfAnswer }); }
  };
  return (
    <div className="selfcheck">
      <h3>How did it sound?</h3>
      {qs.map(([k, q]) => (
        <div key={k} className="selfcheck-row">
          <span>{q}</span>
          <div className="seg" role="group" aria-label={q}>
            {(['yes', 'nearly', 'not-yet'] as const).map(v => (
              <button key={v} className={a[k] === v ? 'on' : ''} aria-pressed={a[k] === v} disabled={saved && a[k] !== v} onClick={() => choose(k, v)}>
                {v === 'yes' ? 'Yes' : v === 'nearly' ? 'Nearly' : 'Not yet'}
              </button>
            ))}
          </div>
        </div>
      ))}
      {saved && <p className="hint">Thanks! Thinking about how you read helps you read better.</p>}
    </div>
  );
}
