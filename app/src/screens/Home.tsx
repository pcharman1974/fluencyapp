import { useEffect, useState } from 'react';
import type { Story } from '../types';
import type { Screen } from '../App';
import { gerbil } from '../brand';
import { WeekSummary } from '../components/Rewards';
import { PowerPanel } from '../components/PowerCore';
import Gauge from '../components/Gauge';
import { getAllReaderCodes, getAttempts, getEvents, importRecords } from '../lib/storage';
import { fetchReader, listReaders, type ServerReader } from '../lib/qa';
import type { Attempt } from '../types';
import type { ReadingEvent } from '../lib/rewards';
import { cardsCollected } from '../components/StoryCards';
import type { Reader } from '../lib/useReader';

interface Props { story: Story; base: string; readerCode: string; reader: Reader; setReader: (c: string) => void; go: (s: Screen) => void }

export default function Home({ story, base, readerCode, reader, setReader, go }: Props) {
  const [editing, setEditing] = useState(!readerCode);
  const attempts = readerCode ? getAttempts(readerCode).filter(a => a.storyId === story.id) : [];
  const latest = attempts.at(-1), first = attempts[0], best = attempts.reduce((m, a) => Math.max(m, a.wcpm), 0);
  const cards = cardsCollected(reader.events, story.id).size;

  if (editing) return (
    <div className="home">
      <section className="hero">
        <div>
          <h1>Read it. Practise it. Beat your best.</h1>
          <p>Read aloud for 5 minutes a day, at least 3 days a week. Little and often wins. Every page you read earns Power, unlocks a story card and moves you up a level.</p>
        </div>
        <img className="hero-mascot" src={gerbil} alt="" />
      </section>
      <ReaderPicker current={readerCode} onPick={c => { setReader(c); setEditing(false); }} go={go} />
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
        <img src={base + story.coverImage} alt="" />
        <div className="story-card-body">
          <h2>{story.title}</h2>
          <p className="byline">Written by {story.author} · {cards}/{story.pages.length} story cards collected</p>
          <div className="steps">
            <button className="btn btn-orange btn-big" onClick={() => go({ name: 'session' })}>Start today's session</button>
            <p className="hint centre-text">Read 3 pages aloud, beat your best, then practise a few words. About 5 to 10 minutes.</p>
            <div className="row wrap even">
              <button className="btn btn-ghost" onClick={() => go({ name: 'practice' })}>Practise any page</button>
              <button className="btn btn-navy" onClick={() => go({ name: 'timed' })}>Timed read</button>
              <button className="btn btn-ghost" onClick={() => go({ name: 'progress' })}>My progress</button>
            </div>
          </div>
        </div>
      </section>
      <p className="hint centre-text">Reader {readerCode} · <button className="link" onClick={() => setEditing(true)}>Change reader</button> · <button className="link" onClick={() => go({ name: 'teacher' })}>Teacher view</button></p>
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
  const create = () => {
    if (!code) return;
    if (all.some(r => r.code === code)) { setNote(`${code} already exists, so we opened it.`); pick(code); return; }
    onPick(code);
  };

  return (
    <section className="panel reader-panel">
      {all.length > 0 && <>
        <h2>Who's reading?</h2>
        <div className="reader-list">
          {all.map(r => (
            <button key={r.code} className={'reader-pick' + (r.code === current ? ' on' : '')} disabled={!!busy} onClick={() => pick(r.code)}>
              <strong>{r.code}</strong><span>{busy === r.code ? 'Loading…' : ago(r.last) || 'no reading yet'}</span>
            </button>
          ))}
        </div>
      </>}
      <label htmlFor="code">{all.length ? 'Or add a new pupil' : 'New pupil'}: reader code</label>
      <div className="row">
        <input id="code" value={code} maxLength={12} autoComplete="off" placeholder="e.g. 7B-14"
          onChange={e => { setNote(''); setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, '')); }}
          onKeyDown={e => e.key === 'Enter' && create()} />
        <button className="btn btn-orange" disabled={!code || !!busy} onClick={create}>Add and start</button>
      </div>
      {note && <p className="hint">{note}</p>}
      <p className="hint">Use a code, never a pupil's name.</p>
      <p className="hint"><button className="link" onClick={() => go({ name: 'teacher' })}>Teacher view</button></p>
    </section>
  );
}
