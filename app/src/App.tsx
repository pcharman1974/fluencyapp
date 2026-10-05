import { useEffect, useState } from 'react';
import type { Story } from './types';
import { getReaderCode, setReaderCode } from './lib/storage';
import Home from './screens/Home';
import Practice from './screens/Practice';
import TimedRead from './screens/TimedRead';
import Progress from './screens/Progress';
import { holdingLogo, lwcLogo } from './brand';

export type Screen = { name: 'home' } | { name: 'practice'; page?: number; focusWords?: string[] } | { name: 'timed' } | { name: 'progress' };

const STORY_URL = 'secret-stones/story.json'; // relative, so it works on any host

export default function App() {
  const [story, setStory] = useState<Story | null>(null);
  const [error, setError] = useState('');
  const [screen, setScreen] = useState<Screen>({ name: 'home' });
  const [reader, setReader] = useState(getReaderCode());

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
      {(screen.name === 'home' || screen.name === 'progress') && (
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
      <main className={screen.name === 'practice' || screen.name === 'timed' ? 'full' : ''}>
        {screen.name === 'home' && <Home story={story} base={base} reader={reader} setReader={updateReader} go={go} />}
        {screen.name === 'practice' && <Practice story={story} base={base} startPage={screen.page} focusWords={screen.focusWords} go={go} />}
        {screen.name === 'timed' && <TimedRead story={story} reader={reader} go={go} />}
        {screen.name === 'progress' && <Progress story={story} reader={reader} go={go} />}
      </main>
    </div>
  );
}
