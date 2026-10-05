import { useEffect, useState } from 'react';
import type { Story } from './types';
import { getReaderCode, setReaderCode } from './lib/storage';
import Home from './screens/Home';
import Practice from './screens/Practice';
import TimedRead from './screens/TimedRead';
import Progress from './screens/Progress';
import Session from './screens/Session';
import { RewardToast } from './components/Rewards';
import { useReader } from './lib/useReader';
import { pickProvider, type SpeechProvider } from './lib/speech';
import type { Award } from './lib/rewards';
import { holdingLogo, lwcLogo } from './brand';

export type Screen = { name: 'home' } | { name: 'practice'; page?: number; focusWords?: string[] } | { name: 'timed' } | { name: 'progress' } | { name: 'session' };

const STORY_URL = 'secret-stones/story.json'; // relative, so it works on any host

export default function App() {
  const [story, setStory] = useState<Story | null>(null);
  const [error, setError] = useState('');
  const [screen, setScreen] = useState<Screen>({ name: 'home' });
  const [reader, setReader] = useState(getReaderCode());
  const state = useReader(reader);
  const [provider, setProvider] = useState<SpeechProvider | null>(null);
  const [toast, setToast] = useState<Award | null>(null);
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
      {(!reader || screen.name === 'home' || screen.name === 'progress') && (
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
      <main className={reader && ['practice', 'timed', 'session'].includes(screen.name) ? 'full' : ''}>
        {(screen.name === 'home' || !reader) && <Home story={story} base={base} readerCode={reader} reader={state} setReader={updateReader} go={go} />}
        {reader && screen.name === 'practice' && <Practice story={story} base={base} startPage={screen.page} focusWords={screen.focusWords}
          reader={state} hasReader={!!reader} provider={provider} go={go} onAward={setToast} />}
        {reader && screen.name === 'session' && <Session story={story} base={base} reader={state} provider={provider} go={go} onAward={setToast} />}
        {reader && screen.name === 'timed' && <TimedRead story={story} reader={reader} state={state} go={go} onAward={setToast} />}
        {reader && screen.name === 'progress' && <Progress story={story} base={base} readerCode={reader} reader={state} go={go} />}
      </main>
      <RewardToast award={toast} onDone={() => setToast(null)} />
    </div>
  );
}
