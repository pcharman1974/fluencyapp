import { useEffect, useState } from 'react';
import type { Story } from './types';
import { getReaderCode, setReaderCode } from './lib/storage';
import Home from './screens/Home';
import Practice from './screens/Practice';
import TimedRead from './screens/TimedRead';
import Progress from './screens/Progress';
import Session from './screens/Session';
import Teacher from './screens/Teacher';
import MicCheck, { micCheckedToday } from './components/MicCheck';
import { LevelUp } from './components/PowerCore';
import type { Level } from './lib/rewards';
import type { RecordResult } from './lib/useReader';
import { RewardToast } from './components/Rewards';
import { useReader } from './lib/useReader';
import { pickProvider, type SpeechProvider } from './lib/speech';
import type { Award } from './lib/rewards';
import { holdingLogo, lwcLogo } from './brand';
import BuildInfo from './components/BuildInfo';

export type Screen = { name: 'home' } | { name: 'practice'; page?: number; focusWords?: string[] } | { name: 'timed' } | { name: 'progress' } | { name: 'session' } | { name: 'teacher' };

const STORY_URL = 'secret-stones/story.json'; // relative, so it works on any host

export default function App() {
  const [story, setStory] = useState<Story | null>(null);
  const [error, setError] = useState('');
  const [screen, setScreen] = useState<Screen>({ name: 'home' });
  const [reader, setReader] = useState(getReaderCode());
  const state = useReader(reader);
  const [provider, setProvider] = useState<SpeechProvider | null>(null);
  const [toast, setToast] = useState<Award | null>(null);
  const [levelUp, setLevelUp] = useState<Level | null>(null);
  const [micOkState, setMicOk] = useState(false);
  const micOk = micOkState || micCheckedToday(); // also true after the mic check inside a session
  const onAward = (a: RecordResult) => { setToast(a); if (a.levelUp) setLevelUp(a.levelUp); };
  useEffect(() => { pickProvider().then(setProvider); }, []);

  useEffect(() => {
    fetch(STORY_URL).then(r => r.json()).then(setStory).catch(() => setError('Could not load the story.'));
  }, []);

  const base = STORY_URL.replace(/story\.json$/, '');
  if (error) return <div className="centre"><p>{error}</p></div>;
  if (!story) return <div className="centre"><p>Loading…</p></div>;

  const updateReader = (c: string) => { setReader(c); setReaderCode(c); };
  const go = (s: Screen) => { window.scrollTo(0, 0); setScreen(s); };

  return (
    <div className="app">
      {/* Reading screens drop the header so the story gets the whole screen. */}
      {(!reader || ['home', 'progress', 'teacher'].includes(screen.name)) && (
        <header className="topbar">
          <button className="wordmark" onClick={() => go({ name: 'home' })} aria-label="Power Reader home">
            <img src={holdingLogo} alt="Beyond the Code Power Reader" />
          </button>
          <div className="topbar-right">
            {reader && <span className="reader-chip">Reader {reader}</span>}
            <img className="partner-logo" src={lwcLogo} alt="Little Wandle Code" />
          </div>
        </header>
      )}
      <main className={reader && micOk && ['practice', 'timed'].includes(screen.name) || (reader && screen.name === 'session') ? 'full' : ''}>
        {(screen.name === 'home' || (!reader && screen.name !== 'teacher')) && <>
          <Home story={story} base={base} readerCode={reader} reader={state} setReader={updateReader} go={go} />
          <BuildInfo base={base} />
        </>}
        {reader && !micOk && (screen.name === 'practice' || screen.name === 'timed') && (
          <div className="timed"><MicCheck provider={provider} onDone={() => setMicOk(true)} onCancel={() => go({ name: 'home' })} /></div>
        )}
        {reader && micOk && screen.name === 'practice' && <Practice story={story} base={base} startPage={screen.page} focusWords={screen.focusWords}
          reader={state} hasReader={!!reader} provider={provider} go={go} onAward={onAward} />}
        {reader && screen.name === 'session' && <Session story={story} base={base} reader={state} provider={provider} go={go} onAward={onAward} />}
        {reader && micOk && screen.name === 'timed' && <TimedRead story={story} reader={reader} state={state} go={go} onAward={onAward} />}
        {screen.name === 'teacher' && <Teacher story={story} go={go} />}
        {reader && screen.name === 'progress' && <Progress story={story} base={base} readerCode={reader} reader={state} go={go} />}
      </main>
      <RewardToast award={toast} onDone={() => setToast(null)} />
      <LevelUp level={levelUp} onClose={() => setLevelUp(null)} />
    </div>
  );
}
