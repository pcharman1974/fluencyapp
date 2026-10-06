import { useEffect, useState } from 'react';
import type { Story } from './types';
import { getReaderCode, setReaderCode } from './lib/storage';
import Home from './screens/Home';
import Practice from './screens/Practice';
import TimedRead from './screens/TimedRead';
import Progress from './screens/Progress';
import Session from './screens/Session';
import Teacher from './screens/Teacher';
import MicCheck from './components/MicCheck';
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
import Library from './screens/Library';
import { STORIES, shelfStatus } from './lib/library';
import Me from './screens/Me';
import { Avatar, LookPicker } from './components/Avatar';
import { Celebrations, celebrate } from './components/Celebrate';
import { profileOf, themeOf } from './lib/profile';
import { levelFor, totalPoints } from './lib/rewards';

export type Screen = { name: 'home' } | { name: 'miccheck' } | { name: 'practice'; page?: number; focusWords?: string[] } | { name: 'timed' } | { name: 'progress' } | { name: 'session'; again?: number } | { name: 'teacher' } | { name: 'library' } | { name: 'me' };

export type { StoryInfo } from './lib/library';
const storyKey = (reader: string) => `btc.story.${reader || 'none'}`;
/** The book this reader chose on this device ('' = none yet: they choose from the library first). */
const savedStory = (reader: string) => {
  try { const v = localStorage.getItem(storyKey(reader)); return STORIES.some(s => s.id === v) ? v! : ''; } catch { return ''; }
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
  // Mic check every time the app opens (and for each new reader), on its own screen before anything else.
  const micOk = micOkState;
  const onAward = (a: RecordResult) => {
    setToast(a); if (a.levelUp) setLevelUp(a.levelUp);
    const big = !!a.levelUp || a.badges.length > 0 || a.points.some(p => p.reason === "Filled today's reading bar");
    if (big) celebrate('big'); else if (a.points.length) celebrate('small');
  };
  useEffect(() => { pickProvider().then(setProvider); }, []);
  useEffect(() => { startUploads(); }, []); // send any test data left from a dropped connection

  useEffect(() => {
    setStory(s => (s?.id === storyId ? s : null));
    if (!storyId) return;
    fetch(`${storyId}/story.json`).then(r => r.json()).then(setStory).catch(() => setError('Could not load the story.'));
  }, [storyId]);

  // The pupil's chosen background, applied to the whole page.
  const profile = reader ? profileOf(state.events) : undefined;
  const themeBg = themeOf(profile?.theme).bg;
  useEffect(() => { document.body.style.background = themeBg; }, [themeBg]);

  const base = `${storyId}/`;
  if (error) return <div className="centre"><p>{error}</p></div>;
  // A reader with no book, or who has finished theirs, chooses one from the library before anything else.
  const info = STORIES.find(s => s.id === storyId);
  // A new reader picks an avatar first, so they can find themselves on a shared device without a name.
  const needsLook = !!reader && !picking && !profile && screen.name !== 'teacher';
  const needsMic = !!reader && !picking && !needsLook && !micOk && screen.name !== 'teacher';
  const needsBook = !!reader && !picking && !needsLook && !needsMic && (!info || shelfStatus(state.events, info).finished);
  // Not mid-session: a pupil who reads the last page still finishes the session first.
  const choosing = needsBook && !['teacher', 'miccheck', 'session'].includes(screen.name);
  const blocked = choosing || needsLook || needsMic;
  if (storyId && !story && !choosing && reader && !picking && screen.name !== 'teacher') return <div className="centre"><p>Loading…</p></div>;

  const updateReader = (c: string) => { setMicOk(false); setReader(c); setReaderCode(c); setPicking(false); setStoryId(savedStory(c)); };
  const chooseStory = (id: string) => { try { localStorage.setItem(storyKey(reader), id); } catch { /* not kept */ } setStoryId(id); };
  const go = (s: Screen) => { window.scrollTo(0, 0); setScreen(s); };

  return (
    <div className="app">
      {/* Reading screens drop the header so the story gets the whole screen. */}
      {(!reader || ['home', 'progress', 'teacher', 'library', 'me'].includes(screen.name) || needsLook || needsMic) && (
        <header className="topbar">
          <button className="wordmark" onClick={() => go({ name: 'home' })} aria-label="Power Reader home">
            <img src={holdingLogo} alt="Beyond the Code Power Reader" />
          </button>
          <div className="topbar-right">
            {reader && !picking && profile && (
              <button className="reader-chip me-chip" onClick={() => go({ name: 'me' })} aria-label={`Reader ${reader}: change my look`}>
                <Avatar profile={profile} size={34} /><span>{reader}</span>
              </button>
            )}
            <img className="partner-logo" src={lwcLogo} alt="Little Wandle Code" />
          </div>
        </header>
      )}
      <main className={reader && micOk && ['practice', 'timed', 'session'].includes(screen.name) ? 'full' : ''}>
        {needsLook && (
          <section className="panel look-first">
            <h2>Choose your look</h2>
            <p className="hint">Pick a picture and a colour. You'll see it next to your reader number, so you can find yourself quickly. You can change it later, and you'll unlock more as you level up.</p>
            <LookPicker level={levelFor(totalPoints(state.events)).level} saveLabel="That's me!" onSave={p => state.record({ type: 'profile', ...p })} />
          </section>
        )}
        {needsMic && (
          <div className="timed mic-first"><MicCheck provider={provider} onDone={() => { setMicOk(true); go({ name: 'home' }); }}
            onCancel={() => setPicking(true)} cancelLabel="Change reader" /></div>
        )}
        {!needsLook && !needsMic && choosing && <Library current={storyId} reader={state} choose={chooseStory} go={go} required />}
        {!blocked && story && (screen.name === 'home' || (!reader && screen.name !== 'teacher')) && <>
          <TestNotice />
          <Home story={story} base={base} readerCode={reader} reader={state} setReader={updateReader} go={go} picking={picking} setPicking={setPicking} />
          <BuildInfo base={base} />
        </>}
        {(picking || !reader) && screen.name === 'home' && !story && <>
          <TestNotice />
          <Home story={null} base={base} readerCode={reader} reader={state} setReader={updateReader} go={go} picking={picking} setPicking={setPicking} />
          <BuildInfo base={base} />
        </>}
        {!blocked && story && reader && !micOk && ['practice', 'timed', 'session'].includes(screen.name) && (
          <div className="timed"><MicCheck provider={provider} onDone={() => setMicOk(true)} onCancel={() => go({ name: 'home' })} /></div>
        )}
        {screen.name === 'miccheck' && (
          <div className="timed"><MicCheck provider={provider} onDone={() => { setMicOk(true); go({ name: 'home' }); }} onCancel={() => go({ name: 'home' })} /></div>
        )}
        {!blocked && story && reader && micOk && screen.name === 'practice' && <Practice story={story} base={base} startPage={screen.page} focusWords={screen.focusWords}
          reader={state} hasReader={!!reader} provider={provider} go={go} onAward={onAward} />}
        {!blocked && story && reader && micOk && screen.name === 'session' && <Session key={screen.again ?? 0} story={story} base={base} reader={state} provider={provider} go={go} onAward={onAward} />}
        {!blocked && story && reader && micOk && screen.name === 'timed' && <TimedRead story={story} reader={reader} state={state} go={go} onAward={onAward} />}
        {screen.name === 'teacher' && <Teacher go={go} />}
        {!blocked && reader && screen.name === 'me' && <Me reader={state} readerCode={reader} go={go} />}
        {!blocked && reader && screen.name === 'library' && <Library current={storyId} reader={state} choose={chooseStory} go={go} />}
        {!blocked && story && reader && screen.name === 'progress' && <Progress story={story} base={base} readerCode={reader} reader={state} go={go} />}
      </main>
      <Celebrations />
      <RewardToast award={toast} onDone={() => setToast(null)} />
      <LevelUp level={levelUp} onClose={() => setLevelUp(null)} />
    </div>
  );
}
