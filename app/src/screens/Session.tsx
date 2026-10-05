import { useMemo, useRef, useState } from 'react';
import type { Story } from '../types';
import type { Screen } from '../App';
import PageView from '../components/PageView';
import ReadAloud from '../components/ReadAloud';
import Gauge from '../components/Gauge';
import StoryCards, { cardsCollected } from '../components/StoryCards';
import { CheckBanner } from './Practice';
import { GoalRing, Badge } from '../components/Rewards';
import { bestReread, sessionsInWeek, trickyWords, type Award, type BadgeId } from '../lib/rewards';
import type { SpeechProvider } from '../lib/speech';
import type { Reader, RecordResult } from '../lib/useReader';
import type { PageCheck } from '../lib/verify';
import { canSpeak, speak } from '../lib/voice';
import { normalise } from '../lib/text';
import MicCheck from '../components/MicCheck';
import { loadManifest, playWord, type AudioManifest } from '../lib/pageAudio';
import { useEffect } from 'react';

interface Props { story: Story; base: string; reader: Reader; provider: SpeechProvider | null; go: (s: Screen) => void; onAward: (a: RecordResult) => void }

type Step = 'mic' | 'warmup' | 'read' | 'reread' | 'done';
const PAGES_PER_SESSION = 3;

/** Today's session, about 10 minutes: warm-up words, read a section aloud, re-read one page to beat your best. */
export default function Session({ story, base, reader, provider, go, onAward }: Props) {
  const plan = useMemo(() => {
    const got = cardsCollected(reader.events, story.id);
    const unread = story.pages.map(p => p.page).filter(p => !got.has(p));
    const pages = (unread.length ? unread : story.pages.map(p => p.page)).slice(0, PAGES_PER_SESSION);
    // Warm-up: 2 chosen words from today's pages, then 2 the pupil got wrong before.
    const chosen = pages.flatMap(p => story.pages[p - 1].warmupWords ?? []).slice(0, 2);
    const tricky = trickyWords(reader.events, 6).filter(w => !chosen.some(c => c.toLowerCase() === w.toLowerCase())).slice(0, 2);
    const words = [...chosen.map(w => ({ word: w, why: "From today's pages" })), ...tricky.map(w => ({ word: w, why: 'Tricky last time' }))];
    return { words, pages };
  }, []); // fixed for the session
  const [step, setStep] = useState<Step>('mic');
  const earned = useRef<{ points: number; badges: BadgeId[]; pages: number[] }>({ points: 0, badges: [], pages: [] });
  const startedWeek = useRef(sessionsInWeek(reader.events, new Date().toISOString()));

  const take = (a: RecordResult) => {
    earned.current.points += a.points.reduce((s, p) => s + p.amount, 0);
    earned.current.badges.push(...a.badges);
    onAward(a);
  };

  const steps: { id: Step; name: string }[] = [
    { id: 'mic', name: 'Mic check' },
    ...(plan.words.length ? [{ id: 'warmup' as Step, name: 'Warm up' }] : []),
    { id: 'read', name: 'Read' }, { id: 'reread', name: 'Beat your best' }, { id: 'done', name: 'Done' },
  ];
  const stepper = (
    <ol className="stepper" aria-label="Session steps">
      {steps.map(s => <li key={s.id} className={s.id === step ? 'on' : steps.findIndex(x => x.id === s.id) < steps.findIndex(x => x.id === step) ? 'past' : ''}>{s.name}</li>)}
    </ol>
  );

  if (step === 'mic') return (
    <div className="timed">
      <div className="session-top"><button className="icon-btn" aria-label="Close" onClick={() => go({ name: 'home' })}>✕</button>{stepper}</div>
      <MicCheck provider={provider} onDone={() => setStep(plan.words.length ? 'warmup' : 'read')} />
    </div>
  );
  if (step === 'warmup') return <WarmUp storyBase={base} words={plan.words} provider={provider} reader={reader} stepper={stepper} onAward={take} onDone={() => setStep('read')} go={go} />;
  if (step === 'read') return <ReadPages story={story} base={base} pages={plan.pages} reader={reader} provider={provider} stepper={stepper}
    onAward={take} onPage={p => earned.current.pages.push(p)} onDone={() => setStep('reread')} go={go} />;
  if (step === 'reread') return <ReRead story={story} base={base} page={earned.current.pages[0] ?? plan.pages[0]} reader={reader} provider={provider}
    stepper={stepper} onAward={take} onDone={() => setStep('done')} go={go} />;

  const week = sessionsInWeek(reader.events, new Date().toISOString());
  return (
    <div className="timed session-done">
      {stepper}
      <section className="panel results">
        <p className="result-label">Session complete</p>
        <p className="result-big"><span className="bolt big" aria-hidden="true" />+{earned.current.points}</p>
        <p className="result-label">Power earned</p>
        <div className="done-row">
          <GoalRing done={week} size={120} />
          <p className="big-msg">{week >= 3 && startedWeek.current < 3 ? 'Weekly goal hit!' : week >= 3 ? 'Goal already hit this week. Extra reading still earns Power.' : `${3 - week} more this week for your goal`}</p>
        </div>
        {earned.current.badges.length > 0 && <div className="badges">{[...new Set(earned.current.badges)].map(id => <Badge key={id} id={id} earned />)}</div>}
        {earned.current.pages.length > 0 && <>
          <h3>Story cards collected</h3>
          <StoryCards story={story} base={base} events={reader.events} highlight={earned.current.pages} />
        </>}
        <div className="row wrap">
          <button className="btn btn-orange" onClick={() => go({ name: 'home' })}>Finish</button>
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
        <p className="hint">Warm-up word {i + 1} of {words.length}</p>
        <span className={'why ' + (why.startsWith('Tricky') ? 'tricky' : 'new')}>{why}</span>
        <p className="warm-word">{word}</p>
        {result !== null && <p className={'banner ' + (result ? 'ok' : 'retry')}>{result ? '✓ Got it!' : `Not quite. Press Hear it, then try again.`}</p>}
        <div className="row wrap centre-row">
          {(canSpeak() || recorded) && <button className="btn btn-ghost" onClick={() => recorded ? playWord(storyBase + recorded) : speak(normalise(word), { rate: 0.75 })}>Hear it</button>}
          <ReadAloud key={i + ':' + result} text={word} provider={provider} label="Say it" doneLabel="Done"
            onResult={(c) => { const ok = c.accuracy === 1 && c.coverage === 1; setResult(ok); onAward(reader.record({ type: 'warmup', word, correct: ok })); }} />
          <button className="btn btn-navy" onClick={next}>{i + 1 < words.length ? 'Next word →' : 'Start reading →'}</button>
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
  const pageNo = pages[i];
  const page = story.pages[pageNo - 1];
  const lastOne = i === pages.length - 1;
  return (
    <PageView story={story} base={base} pageNo={pageNo} recording={recording} onClose={() => go({ name: 'home' })}
      title={`${page.heading} · page ${i + 1} of ${pages.length} today`}
      banner={<>{stepper}<CheckBanner check={check} demo={provider?.demo} /></>}
      footer={<>
        <span className="hint nav-hint">Read the page aloud, then tap "I've finished".</span>
        <ReadAloud key={pageNo + ':' + (check ? 'r' : '')} text={page.text} provider={provider} onRecording={setRecording}
          label={check && !check.verified ? 'Try again' : 'Read aloud'}
          onResult={c => {
            setCheck(c);
            onAward(reader.record({ type: 'page', storyId: story.id, page: pageNo, verified: c.verified, coverage: c.coverage,
              accuracy: c.accuracy, words: c.words, durationSec: c.durationSec, misread: c.misread }, { storyPages: story.pages.length }));
            if (c.verified) onPage(pageNo);
          }} />
        <button className="btn btn-navy" disabled={!check?.verified || recording}
          onClick={() => { setCheck(null); lastOne ? onDone() : setI(i + 1); }}>
          {lastOne ? 'Beat your best →' : 'Next page →'}
        </button>
      </>} />
  );
}

function ReRead({ story, base, page: pageNo, reader, provider, stepper, onAward, onDone, go }: {
  story: Story; base: string; page: number; reader: Reader; provider: SpeechProvider | null; stepper: React.ReactNode;
  onAward: (a: Award) => void; onDone: () => void; go: (s: Screen) => void;
}) {
  const [check, setCheck] = useState<PageCheck | null>(null);
  const [recording, setRecording] = useState(false);
  const [prevBest] = useState(() => bestReread(reader.events, story.id, pageNo));
  const page = story.pages[pageNo - 1];
  // Earlier re-reads of this page only (fixed at the start, before this attempt is recorded).
  const [firstRead] = useState(() => reader.events.find(e => e.type === 'reread' && e.storyId === story.id && e.page === pageNo && e.verified) as { wcpm: number } | undefined);

  if (check?.verified) {
    const pb = prevBest !== undefined && check.wcpm > prevBest;
    return (
      <div className="timed">
        {stepper}
        <section className="panel results">
          <p className="result-label">{pb ? 'New personal best!' : prevBest === undefined ? 'Your first score for this page' : 'Re-read done'}</p>
          <Gauge value={check.wcpm} first={firstRead?.wcpm} best={prevBest !== undefined ? Math.max(prevBest, check.wcpm) : undefined} />
          <p className="big-msg">{pb ? `${check.wcpm - prevBest!} more than your best!` : prevBest !== undefined ? `Your best is ${prevBest}. Keep practising this page to beat it.` : 'Re-read this page next time to try to beat it.'}</p>
          <div className="row wrap"><button className="btn btn-orange" onClick={onDone}>See my session →</button></div>
        </section>
      </div>
    );
  }
  return (
    <PageView story={story} base={base} pageNo={pageNo} plain recording={recording} onClose={() => go({ name: 'home' })}
      title={`Beat your best: ${page.heading}`}
      banner={<>{stepper}
        <div className="banner demo">{prevBest !== undefined ? `Your best on this page: ${prevBest} words correct per minute. ` : ''}Read this page again, smoothly and clearly. The clock starts when you tap Start.</div>
        {check && <CheckBanner check={check} />}</>}
      footer={<>
        <span className="hint nav-hint">No help on a re-read: read it by yourself.</span>
        <ReadAloud key={String(!!check)} text={page.text} provider={provider} onRecording={setRecording} label={check ? 'Try again' : 'Start'}
          onResult={c => {
            setCheck(c);
            onAward(reader.record({ type: 'reread', storyId: story.id, page: pageNo, verified: c.verified, wcpm: c.wcpm }));
          }} />
        <button className="btn btn-ghost" disabled={recording} onClick={onDone}>Skip</button>
      </>} />
  );
}
