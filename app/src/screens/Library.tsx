import type { Screen } from '../App';
import type { Reader } from '../lib/useReader';
import { shelfStatus, STORIES } from '../lib/library';

/** The shelf: every story, how far the pupil has got, and which they're reading now. They choose. */
export default function Library({ current, reader, choose, go }: { current: string; reader: Reader; choose: (id: string) => void; go: (s: Screen) => void }) {
  const currentDone = shelfStatus(reader.events, STORIES.find(s => s.id === current) ?? STORIES[0]).finished;
  return (
    <div className="library">
      <div className="row wrap between">
        <h1>Library</h1>
        <button className="btn btn-ghost" onClick={() => go({ name: 'home' })}>← Back</button>
      </div>
      <p className="hint">{currentDone ? 'You finished your story. Well done! Choose what to read next.' : 'Choose a story to read. You can swap at any time, and you keep your place in every story.'}</p>
      <ul className="shelf">
        {STORIES.map(s => {
          const st = shelfStatus(reader.events, s), on = s.id === current;
          return (
            <li key={s.id}>
              <button className={'book' + (on ? ' on' : '')} onClick={() => { choose(s.id); go({ name: 'home' }); }} aria-label={`${s.title} by ${s.author}${on ? ', reading now' : ''}${st.finished ? ', finished' : ''}`}>
                <span className="book-cover" style={{ background: s.colour }}>
                  {s.cover ? <img src={`${s.id}/${s.cover}`} alt="" /> : <span className="book-title">{s.title}</span>}
                  {st.finished && <span className="book-tag done">✓ Finished</span>}
                  {!st.finished && on && <span className="book-tag now">Reading now</span>}
                  {!st.started && !on && <span className="book-tag new">New</span>}
                </span>
                <span className="book-info">
                  <strong>{s.title}</strong>
                  <span className="hint">{s.author} · {s.topic}</span>
                  <span className="book-progress" aria-hidden="true"><span style={{ width: `${(st.read / s.pages) * 100}%` }} /></span>
                  <span className="hint">{st.read} of {s.pages} pages read</span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
