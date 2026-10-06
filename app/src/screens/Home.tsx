import { useEffect, useState } from 'react';
import type { Story } from '../types';
import type { Screen } from '../App';
import { gerbil } from '../brand';
import { WeekSummary } from '../components/Rewards';
import { PowerPanel } from '../components/PowerCore';
import Gauge from '../components/Gauge';
import { getAllReaderCodes, getAttempts, getEvents, importRecords } from '../lib/storage';
import { claimReader, fetchReader, listReaders, type ServerReader } from '../lib/qa';
import type { Attempt } from '../types';
import type { ReadingEvent } from '../lib/rewards';
import { cardsCollected } from '../components/StoryCards';
import type { Reader } from '../lib/useReader';
import type { StoryInfo } from '../App';

interface Props { story: Story; base: string; stories: StoryInfo[]; setStory: (id: string) => void; readerCode: string; reader: Reader; setReader: (c: string) => void; go: (s: Screen) => void; picking: boolean; setPicking: (on: boolean) => void }

export default function Home({ story, base, stories, setStory, readerCode, reader, setReader, go, picking, setPicking }: Props) {
  // Timed reads use unseen passages, so the gauge follows every timed read, whichever story is on.
  const attempts = readerCode ? getAttempts(readerCode) : [];
  const latest = attempts.at(-1), first = attempts[0], best = attempts.reduce((m, a) => Math.max(m, a.wcpm), 0);
  const cards = cardsCollected(reader.events, story.id).size;

  if (picking || !readerCode) return (
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

  return (
    <div className="home">
      <section className="dash">
        <div className="panel dash-level power-card"><PowerPanel events={reader.events} /></div>
        <div className="panel dash-week"><WeekSummary events={reader.events} holidays={reader.holidays} /></div>
        <div className="panel dash-gauge">
          <h3>Fluency gauge</h3>
          {latest
            ? <Gauge size="small" value={latest.wcpm} first={attempts.length > 1 ? first.wcpm : undefined} best={best} />
            : <p className="hint">Do a timed read to see your fluency gauge.</p>}
        </div>
      </section>

      <section className="story-card panel">
        {story.coverImage ? <img src={base + story.coverImage} alt="" /> : <div className="cover-placeholder" aria-hidden="true">{story.title}</div>}
        <div className="story-card-body">
          <h2>{story.title}</h2>
          <p className="byline">Written by {story.author} · {cards}/{story.pages.length} story cards collected</p>
          {stories.length > 1 && (
            <label className="check story-switch">Story{' '}
              <select value={story.id} onChange={e => setStory(e.target.value)}>
                {stories.map(s => <option key={s.id} value={s.id}>{s.title}</option>)}
              </select>
            </label>
          )}
          <div className="steps">
            <button className="btn btn-orange btn-big" onClick={() => go({ name: 'session' })}>Start today's session</button>
            <p className="hint centre-text">Listen and read 3 pages, give your best reading, then practise a few words. About 5 to 10 minutes.</p>
            <div className="row wrap even">
              <button className="btn btn-ghost" onClick={() => go({ name: 'practice' })}>Practise any page</button>
              <button className="btn btn-navy" onClick={() => go({ name: 'timed' })}>Bonus: timed read</button>
              <button className="btn btn-ghost" onClick={() => go({ name: 'progress' })}>My progress</button>
            </div>
          </div>
        </div>
      </section>
      <p className="hint centre-text">Reader {readerCode} · <button className="link" onClick={() => setPicking(true)}>Change reader</button> · <button className="link" onClick={() => go({ name: 'miccheck' })}>Check microphone</button> · <button className="link" onClick={() => go({ name: 'teacher' })}>Teacher view</button></p>
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
  const all = [...new Set([...server.map(r => r.code), ...local])].map(c => ({ code: c, last: server.find(r => r.code === c)?.lastActive ?? lastLocal(c) }))
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
            <p className="hint">Tap your reader number.</p>
            <div className="reader-list">
              {all.map(r => (
                <button key={r.code} className={'reader-pick' + (r.code === current ? ' on' : '')} disabled={!!busy} onClick={() => pick(r.code)}>
                  <strong>{r.code}</strong><span>{busy === r.code ? 'Loading…' : r.code === current ? `last reader · ${ago(r.last) || 'no reading yet'}` : ago(r.last) || 'no reading yet'}</span>
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
