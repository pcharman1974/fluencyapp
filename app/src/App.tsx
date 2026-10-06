import { useEffect, useState } from 'react';
import type { Story } from './types';
import { getReaderCode, setReaderCode } from './lib/storage';
import Home from './screens/Home';
import Practice from './screens/Practice';
import TimedRead from './screens/TimedRead';
import Progress from './screens/Progress';
import Session from './screens/Session';
import Teacher from './screens/Teacher';
import MicCheck, { micChecked } from './components/MicCheck';
import { LevelUp } from './components/PowerCore';
import type { Level } from './lib/rewards';
import type { RecordResult } from './lib/useReader';
import { RewardToast } from './components/Rewards';
import { useReader } from './lib/useReader';
import { pickProvider, type SpeechProvider } from './lib/speech';
import type { Award } from './lib/rewards';
import { holdingLogo, lwcLogo } from './brand';
import BuildInfo from './components/BuildInfo';
import { startUploads } from './lib/qa';
import { TestNotice } from './components/ServerData';

export type Screen = { name: 'home' } | { name: 'miccheck' } | { name: 'practice'; page?: number; focusWords?: string[] } | { name: 'timed' } | { name: 'progress' } | { name: 'session' } | { name: 'teacher' };

export interface StoryInfo { id: string; title: string }
/** Stories in /content (paths are relative, so they work on any host). The first is the default. */
export const STORIES: StoryInfo[] = [
  { id: 'secret-stones', title: 'Secret Stones' },
  { id: 'womens-football', title: 'The History of Women’s Football' },
  { id: 'inclusive-design', title: 'Inclusive Design' },
];
const storyKey = (reader: string) => `btc.story.${reader || 'none'}`;
const savedStory = (reader: string) => {
  try { const v = localStorage.getItem(storyKey(reader)); return STORIES.some(s => s.id === v) ? v! : STORIES[0].id; } catch { return STORIES[0].id; }
};

export default function App() {
  const [story, setStory] = useState<Story | null>(null);
  const [error, setError] = useState('');
  const [screen, setScreen] = useState<Screen>({ name: 'home' });
  // Shared school devices: always ask who's reading when the app opens (not when moving between screens).
  const [picking, setPicking] = useState(true);
  const [reader, setReader] = useState(getReaderCode());
  // Each reader carries on with the story they chose last on this device.
  const [storyId, setStoryId] = useState(() => savedStory(getReaderCode()));
  const state = useReader(reader);
  const [provider, setProvider] = useState<SpeechProvider | null>(null);
  const [toast, setToast] = useState<Award | null>(null);
  const [levelUp, setLevelUp] = useState<Level | null>(null);
  const [micOkState, setMicOk] = useState(false);
  const micOk = micOkState || micChecked(); // one-off per device; re-run from the home screen
  const onAward = (a: RecordResult) => { setToast(a); if (a.levelUp) setLevelUp(a.levelUp); };
  useEffect(() => { pickProvider().then(setProvider); }, []);
  useEffect(() => { startUploads(); }, []); // send any test data left from a dropped connection

  useEffect(() => {
    setStory(s => (s?.id === storyId ? s : null));
    fetch(`${storyId}/story.json`).then(r => r.json()).then(setStory).catch(() => setError('Could not load the story.'));
  }, [storyId]);

  const base = `${storyId}/`;
  if (error) return <div className="centre"><p>{error}</p></div>;
  if (!story) return <div className="centre"><p>Loading…</p></div>;

  const updateReader = (c: string) => { setReader(c); setReaderCode(c); setPicking(false); setStoryId(savedStory(c)); };
  const chooseStory = (id: string) => { try { localStorage.setItem(storyKey(reader), id); } catch { /* not kept */ } setStoryId(id); };
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
            {reader && !picking && <span className="reader-chip">Reader {reader}</span>}
            <img className="partner-logo" src={lwcLogo} alt="Little Wandle Code" />
          </div>
        </header>
      )}
      <main className={reader && micOk && ['practice', 'timed', 'session'].includes(screen.name) ? 'full' : ''}>
        {(screen.name === 'home' || (!reader && screen.name !== 'teacher')) && <>
          <TestNotice />
          <Home story={story} base={base} stories={STORIES} setStory={chooseStory} readerCode={reader} reader={state} setReader={updateReader} go={go} picking={picking} setPicking={setPicking} />
          <BuildInfo base={base} />
        </>}
        {reader && !micOk && ['practice', 'timed', 'session'].includes(screen.name) && (
          <div className="timed"><MicCheck provider={provider} onDone={() => setMicOk(true)} onCancel={() => go({ name: 'home' })} /></div>
        )}
        {screen.name === 'miccheck' && (
          <div className="timed"><MicCheck provider={provider} onDone={() => { setMicOk(true); go({ name: 'home' }); }} onCancel={() => go({ name: 'home' })} /></div>
        )}
        {reader && micOk && screen.name === 'practice' && <Practice story={story} base={base} startPage={screen.page} focusWords={screen.focusWords}
          reader={state} hasReader={!!reader} provider={provider} go={go} onAward={onAward} />}
        {reader && micOk && screen.name === 'session' && <Session story={story} base={base} reader={state} provider={provider} go={go} onAward={onAward} />}
        {reader && micOk && screen.name === 'timed' && <TimedRead story={story} reader={reader} state={state} go={go} onAward={onAward} />}
        {screen.name === 'teacher' && <Teacher story={story} go={go} />}
        {reader && screen.name === 'progress' && <Progress story={story} base={base} readerCode={reader} reader={state} go={go} />}
      </main>
      <RewardToast award={toast} onDone={() => setToast(null)} />
      <LevelUp level={levelUp} onClose={() => setLevelUp(null)} />
    </div>
  );
}
