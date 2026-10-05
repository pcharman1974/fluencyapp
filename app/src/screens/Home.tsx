import { useState } from 'react';
import type { Story } from '../types';
import type { Screen } from '../App';
import { gerbil } from '../brand';
import { LevelBar, WeekSummary } from '../components/Rewards';
import Gauge from '../components/Gauge';
import { getAttempts } from '../lib/storage';
import { cardsCollected } from '../components/StoryCards';
import type { Reader } from '../lib/useReader';

interface Props { story: Story; base: string; readerCode: string; reader: Reader; setReader: (c: string) => void; go: (s: Screen) => void }

export default function Home({ story, base, readerCode, reader, setReader, go }: Props) {
  const [code, setCode] = useState(readerCode);
  const [editing, setEditing] = useState(!readerCode);
  const attempts = readerCode ? getAttempts(readerCode).filter(a => a.storyId === story.id) : [];
  const latest = attempts.at(-1), first = attempts[0], best = attempts.reduce((m, a) => Math.max(m, a.wcpm), 0);
  const cards = cardsCollected(reader.events, story.id).size;

  if (editing) return (
    <div className="home">
      <section className="hero">
        <div>
          <h1>Read it. Practise it. Beat your best.</h1>
          <p>Practise reading aloud three times a week. Every page you read earns Power, unlocks a story card and moves you up a level.</p>
        </div>
        <img className="hero-mascot" src={gerbil} alt="" />
      </section>
      <section className="panel reader-panel">
        <label htmlFor="code">Reader code</label>
        <div className="row">
          <input id="code" value={code} maxLength={12} autoComplete="off" placeholder="e.g. 7B-14"
            onChange={e => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, ''))} />
          <button className="btn btn-orange" disabled={!code} onClick={() => { setReader(code); setEditing(false); }}>Start</button>
        </div>
        <p className="hint">Use the code your teacher gives you, not your name. Your progress is saved on this device only.</p>
      </section>
    </div>
  );

  return (
    <div className="home">
      <section className="dash">
        <div className="panel dash-level"><LevelBar events={reader.events} /></div>
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
            <p className="hint centre-text">About 10 minutes: warm up, read 3 pages aloud, then beat your best.</p>
            <div className="row wrap even">
              <button className="btn btn-ghost" onClick={() => go({ name: 'practice' })}>Practise any page</button>
              <button className="btn btn-navy" onClick={() => go({ name: 'timed' })}>Timed read</button>
              <button className="btn btn-ghost" onClick={() => go({ name: 'progress' })}>Badges and cards</button>
            </div>
          </div>
        </div>
      </section>
      <p className="hint centre-text">Reader {readerCode} · <button className="link" onClick={() => setEditing(true)}>Change reader</button></p>
    </div>
  );
}
