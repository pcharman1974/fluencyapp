import { useEffect, useState } from 'react';
import type { Story } from '../types';
import type { Screen } from '../App';
import { gerbil } from '../brand';
import { GoalRing, TodayBar } from '../components/Rewards';
import { SayIt } from '../components/SayIt';
import { formatMinutes, formatWords, totals } from '../lib/milestones';
import { DAILY_TARGET_MIN, dayKey, levelFor, readingByDay, sessionsInWeek, totalPoints, WEEKLY_TARGET } from '../lib/rewards';
import { Core } from '../components/PowerCore';
import { getAllReaderCodes, getEvents, importRecords } from '../lib/storage';
import { claimReader, fetchReader, listReaders, type ServerReader } from '../lib/qa';
import type { Attempt } from '../types';
import type { ReadingEvent } from '../lib/rewards';
import { cardsCollected } from '../components/StoryCards';
import type { Reader } from '../lib/useReader';
import { Avatar } from '../components/Avatar';
import { profileOf } from '../lib/profile';

interface Props { story: Story | null; base: string; readerCode: string; reader: Reader; setReader: (c: string) => void; go: (s: Screen) => void; picking: boolean; setPicking: (on: boolean) => void }

export default function Home({ story, base, readerCode, reader, setReader, go, picking, setPicking }: Props) {
  const cards = story ? cardsCollected(reader.events, story.id).size : 0;

  if (picking || !readerCode || !story) return (
    <div className="home">
      <section className="hero">
        <div>
          <h1>Read it. Practise it. Make it your best.</h1>
          <p>Read aloud for 5 minutes a day, at least 3 days a week. Little and often wins. Every page you read earns Power, unlocks a story card and moves you up a level.</p>
        </div>
        <img className="hero-mascot" src={gerbil} alt="" />
      </section>
      <ReaderPicker current={readerCode} onPick={setReader} go={go} />
    </div>
  );

  // Today's bar decides the main button: carry on until it's full, then "read more" is optional.
  const secs = readingByDay(reader.events).get(dayKey(new Date().toISOString())) ?? 0;
  const full = secs >= DAILY_TARGET_MIN * 60;
  const minsToGo = Math.max(1, Math.ceil((DAILY_TARGET_MIN * 60 - secs) / 60));
  const t = totals(reader.events), lv = levelFor(totalPoints(reader.events));
  const week = sessionsInWeek(reader.events, new Date().toISOString());

  return (
    <div className="home home2">
      <section className="panel book-hero">
        <button className="book-hero-cover" onClick={() => go({ name: 'session' })} aria-label={`Read ${story.title}`}>
          {story.coverImage ? <img src={base + story.coverImage} alt="" /> : <div className="cover-placeholder" aria-hidden="true">{story.title}</div>}
        </button>
        <div className="book-hero-body">
          <span className="book-hero-kicker">Your book</span>
          <h2>{story.title}</h2>
          <div className="book-progress-row">
            <span className="book-progress" aria-hidden="true"><span style={{ width: `${(cards / story.pages.length) * 100}%` }} /></span>
            <span className="hint">{cards} of {story.pages.length} pages read</span>
          </div>
          <TodayBar events={reader.events} compact />
          <button className="btn btn-orange btn-huge" onClick={() => go({ name: 'session' })}>
            {full ? 'Read some more' : cards === 0 ? 'Start reading' : 'Carry on reading'}
          </button>
          <p className="hint centre-text main-hint">
            {full ? "Today's bar is full. Great reading!" : `About ${minsToGo} ${minsToGo === 1 ? 'minute' : 'minutes'} to fill today's bar.`}
            <SayIt id={full ? 'home-full' : 'home-start'} />
          </p>
          <div className="row wrap centre-row small-actions">
            <button className="btn btn-ghost btn-small" onClick={() => go({ name: 'timed' })}>Bonus: 1-minute read</button>
            <button className="btn btn-ghost btn-small" onClick={() => go({ name: 'library' })}>Change book</button>
          </div>
        </div>
      </section>

      <section className="stat-tiles" aria-label="Your reading">
        <button className="tile" onClick={() => go({ name: 'progress' })}>
          <Core level={lv} progress={lv.progress} size={64} />
          <span className="tile-main">Level {lv.level}</span>
          <span className="tile-sub">{lv.name} · {totalPoints(reader.events)} Power</span>
        </button>
        <button className="tile" onClick={() => go({ name: 'progress' })}>
          <GoalRing done={week} size={64} />
          <span className="tile-main">{Math.min(week, WEEKLY_TARGET)} of {WEEKLY_TARGET} days</span>
          <span className="tile-sub">this week</span>
        </button>
        <button className="tile" onClick={() => go({ name: 'progress' })}>
          <span className="tile-icon words" aria-hidden="true">Aa</span>
          <span className="tile-main">{formatWords(t.words)}</span>
          <span className="tile-sub">words read</span>
        </button>
        <button className="tile" onClick={() => go({ name: 'progress' })}>
          <span className="tile-icon minutes" aria-hidden="true">⏱</span>
          <span className="tile-main">{formatMinutes(t.seconds)}</span>
          <span className="tile-sub">reading aloud</span>
        </button>
      </section>
      <div className="centre-row"><button className="btn btn-navy" onClick={() => go({ name: 'progress' })}>My progress and badges</button></div>

      <MoreMenu readerCode={readerCode} go={go} setPicking={setPicking} />
    </div>
  );
}

/** Things a pupil rarely needs, kept out of the way. */
function MoreMenu({ readerCode, go, setPicking }: { readerCode: string; go: (s: Screen) => void; setPicking: (on: boolean) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="more">
      <p className="hint centre-text">Reader {readerCode} · <button className="link" aria-expanded={open} onClick={() => setOpen(!open)}>{open ? 'Less' : 'More'}</button></p>
      {open && (
        <div className="row wrap centre-row more-items">
          <button className="btn btn-ghost btn-small" onClick={() => go({ name: 'me' })}>My look and sounds</button>
          <button className="btn btn-ghost btn-small" onClick={() => setPicking(true)}>Change reader</button>
          <button className="btn btn-ghost btn-small" onClick={() => go({ name: 'practice' })}>Practise any page</button>
          <button className="btn btn-ghost btn-small" onClick={() => go({ name: 'miccheck' })}>Check microphone</button>
          <button className="btn btn-ghost btn-small" onClick={() => go({ name: 'teacher' })}>Teacher view</button>
        </div>
      )}
    </div>
  );
}

const ago = (iso?: string) => {
  if (!iso) return '';
  const d = Math.floor((Date.now() - new Date(iso).getTime()) / 864e5);
  return d <= 0 ? 'read today' : d === 1 ? 'read yesterday' : `read ${d} days ago`;
};

/** Choose an existing pupil (this device, or saved on the server) or add a new one by code. */
function ReaderPicker({ current, onPick, go }: { current: string; onPick: (code: string) => void; go: (s: Screen) => void }) {
  const [code, setCode] = useState('');
  const [server, setServer] = useState<ServerReader[]>([]);
  const [busy, setBusy] = useState('');
  const [note, setNote] = useState('');
  useEffect(() => { listReaders().then(setServer); }, []);
  const local = getAllReaderCodes();
  const lastLocal = (c: string) => getEvents(c).at(-1)?.date;
  const all = [...new Set([...server.map(r => r.code), ...local])].map(c => {
    const sv = server.find(r => r.code === c);
    return { code: c, last: sv?.lastActive ?? lastLocal(c), profile: sv?.profile ?? profileOf(getEvents(c)) };
  })
    .sort((a, b) => String(b.last ?? '').localeCompare(String(a.last ?? '')) || a.code.localeCompare(b.code));

  const pick = async (c: string) => {
    setBusy(c);
    // Bring this pupil's history from the server, so their Power and graphs carry across devices.
    if (server.some(r => r.code === c)) {
      try { const r = await fetchReader(c); importRecords(c, r.events as ReadingEvent[], r.attempts as Attempt[]); } catch { /* use what this device has */ }
    }
    setBusy(''); onPick(c);
  };
  // New readers make up a 4-digit number. A number already in use is never opened from here,
  // so nobody lands in someone else's reading by accident.
  const create = async () => {
    if (!/^\d{4}$/.test(code) || busy) return;
    if (all.some(r => r.code === code)) { setNote('That number is taken. Pick a different one.'); return; }
    setBusy(code);
    const claim = await claimReader(code); // the server makes it unique across every device
    setBusy('');
    if (claim === 'taken') { setNote('That number is taken. Pick a different one.'); return; }
    onPick(code);
  };

  return (
    <section className="panel reader-panel">
      <h2>Who's reading?</h2>
      <div className="reader-choices">
        <div className="reader-choice">
          <h3>I've read before</h3>
          {all.length > 0 ? <>
            <p className="hint">Find your picture and number.</p>
            <div className="reader-list">
              {all.map(r => (
                <button key={r.code} className={'reader-pick' + (r.code === current ? ' on' : '')} disabled={!!busy} onClick={() => pick(r.code)}>
                  <Avatar profile={r.profile} size={44} /><span className="reader-pick-text"><strong>{r.code}</strong><span>{busy === r.code ? 'Loading…' : r.code === current ? `last reader · ${ago(r.last) || 'no reading yet'}` : ago(r.last) || 'no reading yet'}</span></span>
                </button>
              ))}
            </div>
          </> : <p className="hint">No readers yet. Add yourself as a new reader.</p>}
        </div>
        <div className="reader-choice new">
          <h3>I'm new</h3>
          <label htmlFor="code" className="hint">Make up a 4-digit number and remember it. It's your reader number.</label>
          <div className="row">
            <input id="code" value={code} maxLength={4} inputMode="numeric" pattern="[0-9]*" autoComplete="off" placeholder="1234"
              className="code-input" aria-describedby="code-note"
              onChange={e => { setNote(''); setCode(e.target.value.replace(/\D/g, '').slice(0, 4)); }}
              onKeyDown={e => e.key === 'Enter' && create()} />
            <button className="btn btn-orange" disabled={code.length !== 4 || !!busy} onClick={create}>Start</button>
          </div>
          <p className="hint" id="code-note" role="status">{note || 'Only numbers. Don\'t use your birthday.'}</p>
        </div>
      </div>
      <p className="hint"><button className="link" onClick={() => go({ name: 'teacher' })}>Teacher view</button></p>
    </section>
  );
}
