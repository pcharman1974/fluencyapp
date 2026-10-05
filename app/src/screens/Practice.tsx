import { useEffect, useMemo, useState } from 'react';
import type { Story } from '../types';
import type { Screen } from '../App';
import ReadingText, { Ruler } from '../components/ReadingText';
import { canSpeak, speak, stopSpeaking } from '../lib/voice';
import { normalise } from '../lib/text';

interface Props { story: Story; base: string; startPage?: number; focusWords?: string[]; go: (s: Screen) => void }

const SIZES = [22, 25, 28, 32, 36, 42];
const PREFS = 'btc.practice.prefs.v1';

function loadPrefs(): { size: number; picture: boolean } {
  try { return { size: 2, picture: true, ...JSON.parse(localStorage.getItem(PREFS) || '{}') }; } catch { return { size: 2, picture: true }; }
}

export default function Practice({ story, base, startPage = 1, focusWords, go }: Props) {
  const [pageNo, setPageNo] = useState(startPage);
  const [size, setSize] = useState(loadPrefs().size);
  const [picture, setPicture] = useState(loadPrefs().picture);
  const [ruler, setRuler] = useState(false);
  const [speaking, setSpeaking] = useState<number | undefined>();
  const [popup, setPopup] = useState<{ word: string; def?: string } | null>(null);
  const [done, setDone] = useState<Set<number>>(new Set());

  const page = story.pages[pageNo - 1];
  const last = pageNo === story.pages.length;
  const vocab = useMemo(() => Object.fromEntries(Object.entries(story.glossary).map(([k, v]) => [normalise(k), v])), [story]);

  useEffect(() => { try { localStorage.setItem(PREFS, JSON.stringify({ size, picture })); } catch { /* ignore */ } }, [size, picture]);
  useEffect(() => () => stopSpeaking(), []);
  useEffect(() => { stopSpeaking(); setSpeaking(undefined); setPopup(null); }, [pageNo]);

  // Map spoken character position to word number, to highlight the word being read aloud.
  const wordStarts = useMemo(() => {
    const starts: number[] = []; const re = /\S+/g; let m;
    while ((m = re.exec(page.text))) starts.push(m.index);
    return starts;
  }, [page]);

  const listen = () => {
    if (speaking !== undefined) { stopSpeaking(); setSpeaking(undefined); return; }
    setSpeaking(0);
    speak(page.text, {
      onWord: c => { let i = 0; while (i + 1 < wordStarts.length && wordStarts[i + 1] <= c) i++; setSpeaking(i); },
      onEnd: () => setSpeaking(undefined),
    });
  };

  const turn = (to: number) => {
    if (to > pageNo) setDone(d => new Set(d).add(pageNo));
    setPageNo(to);
    document.querySelector('.reader-scroll')?.scrollTo(0, 0);
  };

  return (
    <div className="reader" style={{ ['--reading-size' as string]: SIZES[size] + 'px' }}>
      <div className="reader-bar">
        <button className="icon-btn" aria-label="Back to home" onClick={() => go({ name: 'home' })}>✕</button>
        <span className="reader-title">{page.heading}</span>
        <div className="tool-group" role="group" aria-label="Text size">
          <button className="icon-btn" aria-label="Smaller text" disabled={size === 0} onClick={() => setSize(size - 1)}>A−</button>
          <button className="icon-btn" aria-label="Bigger text" disabled={size === SIZES.length - 1} onClick={() => setSize(size + 1)}>A+</button>
        </div>
        <button className={'icon-btn wide' + (picture ? ' on' : '')} aria-pressed={picture} onClick={() => setPicture(!picture)}>Picture</button>
        <button className={'icon-btn wide' + (ruler ? ' on' : '')} aria-pressed={ruler} onClick={() => setRuler(!ruler)}>Ruler</button>
        {canSpeak() && <button className={'icon-btn wide' + (speaking !== undefined ? ' on' : '')} onClick={listen}>
          {speaking !== undefined ? 'Stop' : 'Listen'}
        </button>}
      </div>

      <div className="reader-scroll">
        <article className={'reader-page' + (picture ? '' : ' no-picture')}>
          {picture && <img className="page-img" src={base + page.image} alt={page.imageAlt} />}
          <div className="page-body">
            <Ruler on={ruler}>
              <ReadingText text={page.text} vocab={vocab} highlightIndex={speaking} focusWords={focusWords}
                onWordTap={(word, def) => def && setPopup({ word, def })} />
            </Ruler>
          </div>
        </article>
      </div>

      {popup && (
        <div className="popup" role="dialog" aria-label={`Meaning of ${popup.word}`}>
          <strong>{normalise(popup.word)}</strong>
          <p>{popup.def}</p>
          <div className="row">
            {canSpeak() && <button className="btn btn-navy" onClick={() => speak(normalise(popup.word), { rate: 0.75 })}>Hear it</button>}
            <button className="btn btn-ghost" onClick={() => setPopup(null)}>Close</button>
          </div>
        </div>
      )}

      <nav className="reader-nav">
        <button className="btn btn-ghost" disabled={pageNo === 1} onClick={() => turn(pageNo - 1)}>← Last</button>
        <div className="dots" aria-label={`Page ${pageNo} of ${story.pages.length}`}>
          {story.pages.map(p => <span key={p.page} className={'dot' + (p.page === pageNo ? ' current' : done.has(p.page) ? ' done' : '')} />)}
          <span className="page-count">{pageNo}/{story.pages.length}</span>
        </div>
        {last
          ? <button className="btn btn-orange" onClick={() => go({ name: 'timed' })}>Timed read →</button>
          : <button className="btn btn-orange" onClick={() => turn(pageNo + 1)}>Next →</button>}
      </nav>
    </div>
  );
}
