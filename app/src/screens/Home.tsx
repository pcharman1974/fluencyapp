import { useState } from 'react';
import type { Story } from '../types';
import type { Screen } from '../App';
import { gerbil } from '../brand';

interface Props { story: Story; base: string; reader: string; setReader: (c: string) => void; go: (s: Screen) => void }

export default function Home({ story, base, reader, setReader, go }: Props) {
  const [code, setCode] = useState(reader);
  return (
    <div className="home">
      <section className="hero">
        <div>
          <h1>Read it. Practise it. Beat your best.</h1>
          <p>Read the story page by page first. When you feel ready, try a one-minute timed read to see how many words you can read correctly.</p>
        </div>
        <img className="hero-mascot" src={gerbil} alt="" />
      </section>

      <section className="panel reader-panel">
        <label htmlFor="code">Reader code</label>
        <div className="row">
          <input id="code" value={code} maxLength={12} autoComplete="off" placeholder="e.g. 7B-14"
            onChange={e => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, ''))} />
          <button className="btn btn-navy" disabled={!code || code === reader} onClick={() => setReader(code)}>Save</button>
        </div>
        <p className="hint">Use a code your teacher gives you, not your name. Results are saved on this device only.</p>
      </section>

      <section className="story-card panel">
        <img src={base + story.coverImage} alt="" />
        <div className="story-card-body">
          <h2>{story.title}</h2>
          <p className="byline">Written by {story.author} · {story.pages.length} pages</p>
          <div className="steps">
            <button className="btn btn-orange btn-big" onClick={() => go({ name: 'practice' })}>
              <span className="step-no">1</span> Practise reading
            </button>
            <button className="btn btn-navy btn-big" disabled={!reader} onClick={() => go({ name: 'timed' })}>
              <span className="step-no">2</span> Timed read
            </button>
            <button className="btn btn-ghost" disabled={!reader} onClick={() => go({ name: 'progress' })}>My progress</button>
          </div>
          {!reader && <p className="hint">Save a reader code to do a timed read.</p>}
        </div>
      </section>
    </div>
  );
}
