import { useEffect, useRef, useState } from 'react';
import type { SpeechProvider, SpeechResult } from '../lib/speech';
import { checkPage, type PageCheck } from '../lib/verify';
import { getReaderCode } from '../lib/storage';
import { sendRecording, startRecording, type QaContext, type QaRecorder } from '../lib/qa';

interface Props {
  text: string;
  provider: SpeechProvider | null;
  label?: string;
  doneLabel?: string;
  onRecording?: (on: boolean) => void;
  onResult: (check: PageCheck, result: SpeechResult) => void;
  /** What is being read, for the testing data store (recording plus check result). */
  qa?: QaContext;
}

/** "Read aloud" button: listens while the pupil reads, then checks the reading against the text. */
export default function ReadAloud({ text, provider, label = 'Read aloud', doneLabel = "I've finished", onRecording, onResult, qa }: Props) {
  const [state, setState] = useState<'idle' | 'recording' | 'checking'>('idle');
  const [secs, setSecs] = useState(0);
  const [problem, setProblem] = useState('');
  const session = useRef<{ stop(): Promise<SpeechResult> } | null>(null);
  const started = useRef(0);
  const tick = useRef<number>(0);
  const recorder = useRef<QaRecorder | null>(null);
  useEffect(() => () => { recorder.current?.cancel(); clearInterval(tick.current); }, []);

  const start = async () => {
    if (!provider) return;
    setProblem('');
    try {
      session.current = await provider.start(text, undefined, { kind: 'page' });
    } catch {
      setProblem('The microphone could not start. Check it is allowed for this page.');
      return;
    }
    recorder.current = qa ? await startRecording() : null;
    started.current = Date.now(); setSecs(0);
    tick.current = window.setInterval(() => setSecs(Math.floor((Date.now() - started.current) / 1000)), 500);
    setState('recording'); onRecording?.(true);
  };

  const stop = async () => {
    clearInterval(tick.current);
    setState('checking');
    const elapsed = (Date.now() - started.current) / 1000;
    const [result, audio] = await Promise.all([session.current!.stop(), recorder.current?.stop() ?? Promise.resolve(null)]);
    session.current = null; recorder.current = null;
    onRecording?.(false);
    setState('idle');
    const check = checkPage(text, result, elapsed);
    onResult(check, result);
    if (qa) sendRecording(getReaderCode(), qa, { check, heard: result.words.map(w => w.text).join(' '), provider: result.provider, text }, audio);
  };

  if (state === 'recording') return (
    <button className="btn btn-rec" onClick={stop}>
      <span className="mic-dot" aria-hidden="true" /> {doneLabel} <span className="rec-time">{secs}s</span>
    </button>
  );
  if (state === 'checking') return <button className="btn btn-navy" disabled>Checking…</button>;
  return (
    <>
      <button className="btn btn-orange btn-mic" disabled={!provider} onClick={start}><span className="mic-icon" aria-hidden="true" />{label}</button>
      {problem && <span className="problem-inline">{problem}</span>}
    </>
  );
}
