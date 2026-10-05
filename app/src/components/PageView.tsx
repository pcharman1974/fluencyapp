import { useEffect, useMemo, useRef, useState } from 'react';
import type { Story } from '../types';
import ReadingText, { Ruler } from './ReadingText';
import { canSpeak, speak, stopSpeaking } from '../lib/voice';
import { normalise } from '../lib/text';
import { loadManifest, manifestProblem, playPage, playWord, preloadAudio, stopAudio, type AudioManifest } from '../lib/pageAudio';
import { sendRecords } from '../lib/qa';
import { getReaderCode } from '../lib/storage';

const SIZES = [22, 25, 28, 32, 36, 42];
const PREFS = 'btc.practice.prefs.v1';
function loadPrefs(): { size: number; picture: boolean; steady: boolean } {
  // Phones start a size smaller; a size the pupil has chosen is kept.
  const phone = typeof window !== 'undefined' && window.matchMedia?.('(max-width: 600px)').matches;
  const d = { size: phone ? 1 : 2, picture: true, steady: false };
  try { return { ...d, ...JSON.parse(localStorage.getItem(PREFS) || '{}') }; } catch { return d; }
}
const STEADY_RATE = 0.85; // slower model reading; pitch is kept

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
  /** Model then do: the pupil hears the page first (session reading). onListened fires when the model reading finishes. */
  modelFirst?: boolean;
  onListened?: () => void;
  /** Step 2's control (the Read aloud button) and whether the pupil's own reading is done. */
  turn?: React.ReactNode;
  turnDone?: boolean;
}

/** Full-screen page: slim tool bar, the page, and a footer the screen supplies. */
export default function PageView({ story, base, pageNo, focusWords, recording, plain, onClose, title, banner, footer, modelFirst, onListened, turn, turnDone }: Props) {
  const [size, setSize] = useState(loadPrefs().size);
  const [picture, setPicture] = useState(loadPrefs().picture);
  const [ruler, setRuler] = useState(false);
  const [speaking, setSpeaking] = useState<number | undefined>();
  const [popup, setPopup] = useState<{ word: string; def?: string } | null>(null);
  const [steady, setSteady] = useState(loadPrefs().steady);
  const [audio, setAudio] = useState<AudioManifest | null>(null);
  // Listen once, then read it yourself: the model reading is a preview, the pupil's own read is the practice.
  const [listened, setListened] = useState(false);
  const [nudge, setNudge] = useState<'your-turn' | 'try-first' | null>(null);
  const [audioLoaded, setAudioLoaded] = useState(false);
  useEffect(() => { loadManifest(base).then(m => { setAudio(m); setAudioLoaded(true); }); }, [base]);
  const storyBase = base; // the story's own folder
  const page = story.pages[pageNo - 1];
  const recorded = audio?.pages[pageNo];
  const playId = useRef(0); // each Listen gets an id; stopping changes it, so only a reading that finishes counts
  const stopAll = () => { playId.current++; stopSpeaking(); stopAudio(); };
  const vocab = useMemo(() => Object.fromEntries(Object.entries(story.glossary).map(([k, v]) => [normalise(k), v])), [story]);

  useEffect(() => { try { localStorage.setItem(PREFS, JSON.stringify({ size, picture, steady })); } catch { /* ignore */ } }, [size, picture, steady]);
  useEffect(() => () => stopAll(), []);
  useEffect(() => { stopAll(); setSpeaking(undefined); setPopup(null); setListened(false); setNudge(null); document.querySelector('.reader-scroll')?.scrollTo(0, 0); }, [pageNo]);
  useEffect(() => { if (recording) { stopAll(); setSpeaking(undefined); setPopup(null); setNudge(null); if (!modelFirst) setListened(false); } }, [recording]);

  // No model reading available (no recording and no device voice): don't hold the pupil up.
  useEffect(() => { if (modelFirst && audioLoaded && !recorded && !canSpeak()) { setListened(true); onListened?.(); } }, [modelFirst, audioLoaded, recorded, pageNo]);

  // Tricky words are boxed while listening, so pupils notice them; plain when it's their turn to read
  // aloud, so they read them unprompted; back again once the page is done.
  const showVocab = !plain && !recording && !(modelFirst && listened && !turnDone);

  // Get this page's recording (and its word clips) ready before Listen is pressed.
  useEffect(() => {
    if (!recorded) return;
    preloadAudio(storyBase + recorded.file);
  }, [recorded?.file]);

  /** Tells the test server when a device falls back to its own voice, and why. */
  const reportFallback = (reason: string) => sendRecords(getReaderCode(), { events: [{
    type: 'diag', what: 'model-reading-fallback', reason, page: pageNo, date: new Date().toISOString(),
    userAgent: navigator.userAgent,
  }] });

  const wordStarts = useMemo(() => {
    const starts: number[] = []; const re = /\S+/g; let m;
    while ((m = re.exec(page.text))) starts.push(m.index);
    return starts;
  }, [page]);

  const listen = () => {
    if (speaking !== undefined) { stopAll(); setSpeaking(undefined); return; }
    // A second listen before reading it themselves gets a gentle nudge (it still plays).
    setNudge(listened ? 'try-first' : null);
    setSpeaking(0);
    const id = ++playId.current;
    const done = () => { if (id !== playId.current) return; setSpeaking(undefined); setListened(true); setNudge('your-turn'); onListened?.(); };
    const deviceVoice = () => speak(page.text, {
      rate: steady ? 0.75 : 0.9,
      onWord: c => { let i = 0; while (i + 1 < wordStarts.length && wordStarts[i + 1] <= c) i++; setSpeaking(i); },
      onEnd: done,
    });
    if (recorded) {
      playPage(storyBase + recorded.file, recorded.words, { rate: steady ? STEADY_RATE : 1, onWord: setSpeaking, onEnd: done,
        onFail: why => { if (id !== playId.current) return; reportFallback(`recording would not play: ${why}`); deviceVoice(); } });
      return;
    }
    reportFallback(audioLoaded ? `no recordings list: ${manifestProblem || 'not found'}` : 'recordings list still loading');
    speak(page.text, {
      rate: steady ? 0.75 : 0.9,
      onWord: c => { let i = 0; while (i + 1 < wordStarts.length && wordStarts[i + 1] <= c) i++; setSpeaking(i); },
      onEnd: done,
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
        {(canSpeak() || recorded) && !plain && <>
          <button className={'icon-btn wide' + (speaking !== undefined ? ' on' : '') + (modelFirst ? ' top-listen' : '') + (modelFirst && !listened && speaking === undefined ? ' attention' : '')} disabled={recording} onClick={listen}
            title={recording ? 'Listen is off while you read aloud' : undefined}>
            {speaking !== undefined ? 'Stop' : 'Listen'}
          </button>
          <button className={'icon-btn wide speed' + (steady ? ' on' : '')} aria-pressed={steady} disabled={speaking !== undefined || recording}
            onClick={() => setSteady(!steady)} title="Listen speed">{steady ? 'Steady' : 'Normal'}</button>
        </>}
      </div>
      {banner}
      {modelFirst && (
        <ol className="two-steps" aria-label="Listen, then read">
          <li className={listened ? 'done' : 'on'}><b>1</b>
            {listened ? 'Listened ✓'
              : speaking !== undefined ? <>Listening… follow the words <button className="btn btn-ghost step-btn" onClick={listen}>Stop</button></>
              : <>Listen and follow the words <button className="btn btn-orange step-btn" onClick={listen}><span aria-hidden="true">▶</span> Listen</button></>}
          </li>
          <li className={turnDone ? 'done' : listened ? 'on' : ''}><b>2</b>
            {turnDone ? 'Read it ✓' : recording ? 'Reading… tap when you finish' : listened ? 'Your turn! Read it out loud' : 'Your turn to read it'}
            {listened && !turnDone && turn && <span className="step-turn">{turn}</span>}
          </li>
        </ol>
      )}
      {!modelFirst && nudge && !plain && !recording && (
        <p className="banner nudge" role="status">{nudge === 'your-turn'
          ? 'Your turn! Now read the page out loud yourself.'
          : 'Have a go yourself first. You can listen again after.'}</p>
      )}
      <div className="reader-scroll">
        <article className={'reader-page' + (showPicture ? '' : ' no-picture')}>
          {showPicture && <img className="page-img" src={base + page.image} alt={page.imageAlt} />}
          <div className="page-body">
            <Ruler on={ruler}>
              <ReadingText text={page.text} vocab={showVocab ? vocab : {}} highlightIndex={speaking} focusWords={focusWords}
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
            {(canSpeak() || audio?.words[normalise(popup.word)]) && <button className="btn btn-navy" onClick={() => {
              const f = audio?.words[normalise(popup.word)];
              f ? playWord(storyBase + f) : speak(normalise(popup.word), { rate: 0.75 });
            }}>Hear it</button>}
            <button className="btn btn-ghost" onClick={() => setPopup(null)}>Close</button>
          </div>
        </div>
      )}
      <nav className="reader-nav">{footer}</nav>
    </div>
  );
}
