import { useEffect, useMemo, useState } from 'react';
import type { Story } from '../types';
import ReadingText, { Ruler } from './ReadingText';
import { canSpeak, speak, stopSpeaking } from '../lib/voice';
import { normalise } from '../lib/text';

const SIZES = [22, 25, 28, 32, 36, 42];
const PREFS = 'btc.practice.prefs.v1';
function loadPrefs(): { size: number; picture: boolean } {
  try { return { size: 2, picture: true, ...JSON.parse(localStorage.getItem(PREFS) || '{}') }; } catch { return { size: 2, picture: true }; }
}

interface Props {
  story: Story;
  base: string;
  pageNo: number;
  focusWords?: string[];
  /** Microphone is on: Listen is switched off so the device voice can't be "read" for the pupil. */
  recording?: boolean;
  /** Hide word help and Listen (re-reads: the pupil reads it unaided). The picture stays. */
  plain?: boolean;
  onClose: () => void;
  title?: string;
  banner?: React.ReactNode;
  footer: React.ReactNode;
}

/** Full-screen page: slim tool bar, the page, and a footer the screen supplies. */
export default function PageView({ story, base, pageNo, focusWords, recording, plain, onClose, title, banner, footer }: Props) {
  const [size, setSize] = useState(loadPrefs().size);
  const [picture, setPicture] = useState(loadPrefs().picture);
  const [ruler, setRuler] = useState(false);
  const [speaking, setSpeaking] = useState<number | undefined>();
  const [popup, setPopup] = useState<{ word: string; def?: string } | null>(null);
  const page = story.pages[pageNo - 1];
  const vocab = useMemo(() => Object.fromEntries(Object.entries(story.glossary).map(([k, v]) => [normalise(k), v])), [story]);

  useEffect(() => { try { localStorage.setItem(PREFS, JSON.stringify({ size, picture })); } catch { /* ignore */ } }, [size, picture]);
  useEffect(() => () => stopSpeaking(), []);
  useEffect(() => { stopSpeaking(); setSpeaking(undefined); setPopup(null); document.querySelector('.reader-scroll')?.scrollTo(0, 0); }, [pageNo]);
  useEffect(() => { if (recording) { stopSpeaking(); setSpeaking(undefined); setPopup(null); } }, [recording]);

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

  const showPicture = picture;
  return (
    <div className="reader" style={{ ['--reading-size' as string]: SIZES[size] + 'px' }}>
      <div className="reader-bar">
        <button className="icon-btn" aria-label="Close" onClick={onClose}>✕</button>
        <span className="reader-title">{title ?? page.heading}</span>
        <div className="tool-group" role="group" aria-label="Text size">
          <button className="icon-btn" aria-label="Smaller text" disabled={size === 0} onClick={() => setSize(size - 1)}>A−</button>
          <button className="icon-btn" aria-label="Bigger text" disabled={size === SIZES.length - 1} onClick={() => setSize(size + 1)}>A+</button>
        </div>
        {<button className={'icon-btn wide' + (picture ? ' on' : '')} aria-pressed={picture} onClick={() => setPicture(!picture)}>Picture</button>}
        <button className={'icon-btn wide' + (ruler ? ' on' : '')} aria-pressed={ruler} onClick={() => setRuler(!ruler)}>Ruler</button>
        {canSpeak() && !plain && <button className={'icon-btn wide' + (speaking !== undefined ? ' on' : '')} disabled={recording} onClick={listen}
          title={recording ? 'Listen is off while you read aloud' : undefined}>
          {speaking !== undefined ? 'Stop' : 'Listen'}
        </button>}
      </div>
      {banner}
      <div className="reader-scroll">
        <article className={'reader-page' + (showPicture ? '' : ' no-picture')}>
          {showPicture && <img className="page-img" src={base + page.image} alt={page.imageAlt} />}
          <div className="page-body">
            <Ruler on={ruler}>
              <ReadingText text={page.text} vocab={plain ? {} : vocab} highlightIndex={speaking} focusWords={focusWords}
                onWordTap={(word, def) => def && !recording && setPopup({ word, def })} />
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
      <nav className="reader-nav">{footer}</nav>
    </div>
  );
}
