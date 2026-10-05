import { useEffect, useRef, useState } from 'react';
import ReadAloud from './ReadAloud';
import type { SpeechProvider } from '../lib/speech';
import { dayKey } from '../lib/rewards';

const KEY = 'btc.miccheck.v1';
const PHRASE = 'I am ready to read.';

/** One-off check per device (later: at first login). Re-run any time from the home screen. */
export function micChecked(): boolean {
  try { return Boolean(localStorage.getItem(KEY)); } catch { return false; }
}
function markChecked() {
  try { localStorage.setItem(KEY, dayKey(new Date().toISOString())); } catch { /* ignore */ }
}

/**
 * Mic check before reading: 1) the microphone can be opened, 2) the level meter moves when the
 * pupil speaks, 3) the speech check hears a short sentence. Audio for the meter stays on the device.
 */
export default function MicCheck({ provider, onDone, onCancel }: { provider: SpeechProvider | null; onDone: () => void; onCancel?: () => void }) {
  const [mic, setMic] = useState<'asking' | 'on' | 'blocked'>('asking');
  const [level, setLevel] = useState(0);
  const [heardVoice, setHeardVoice] = useState(false);
  const [phrase, setPhrase] = useState<'todo' | 'ok' | 'retry'>('todo');
  const loud = useRef(0);

  useEffect(() => {
    let stream: MediaStream | null = null, ctx: AudioContext | null = null, raf = 0, cancelled = false;
    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
        if (cancelled) { stream.getTracks().forEach(t => t.stop()); return; }
        ctx = new AudioContext();
        const analyser = ctx.createAnalyser(); analyser.fftSize = 1024;
        ctx.createMediaStreamSource(stream).connect(analyser);
        const buf = new Float32Array(analyser.fftSize);
        const tick = () => {
          analyser.getFloatTimeDomainData(buf);
          let sum = 0; for (const v of buf) sum += v * v;
          const rms = Math.sqrt(sum / buf.length);
          const lv = Math.min(1, rms * 8);
          setLevel(l => l * 0.6 + lv * 0.4);
          if (lv > 0.25) { loud.current++; if (loud.current > 12) setHeardVoice(true); }
          raf = requestAnimationFrame(tick);
        };
        tick();
        setMic('on');
      } catch {
        if (!cancelled) setMic('blocked');
      }
    })();
    return () => { cancelled = true; cancelAnimationFrame(raf); stream?.getTracks().forEach(t => t.stop()); ctx?.close(); };
  }, []);

  const demo = provider?.demo;
  const meterOk = mic === 'on' ? heardVoice : demo; // in demo with no microphone, skip the meter
  const ready = phrase === 'ok' && (meterOk || demo);
  const finish = () => { markChecked(); onDone(); };

  return (
    <section className="panel miccheck">
      <h2>Mic check</h2>
      <p className="hint">Before you read, let's make sure the app can hear you. Find a quiet spot and hold the device about a ruler's length away.</p>

      <ol className="mic-steps">
        <li className={mic === 'on' ? 'ok' : mic === 'blocked' && !demo ? 'bad' : ''}>
          <strong>Microphone</strong>
          {mic === 'asking' && <span>Tap <b>Allow</b> if you are asked to use the microphone.</span>}
          {mic === 'on' && <span>✓ Microphone is on.</span>}
          {mic === 'blocked' && (demo
            ? <span>The microphone isn't available here, so this preview uses demo speech instead.</span>
            : <span>The microphone is blocked. On an iPad, open <b>Settings → Safari → Microphone</b> and choose <b>Allow</b>, then reload this page.</span>)}
        </li>

        {mic === 'on' && (
          <li className={heardVoice ? 'ok' : ''}>
            <strong>Voice level</strong>
            <span>{heardVoice ? '✓ We can hear you.' : 'Say "hello" in your normal reading voice. The bar should move.'}</span>
            <div className="meter" role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(level * 100)} aria-label="Microphone level">
              <div style={{ width: Math.round(level * 100) + '%' }} />
              <span className="meter-mark" aria-hidden="true" />
            </div>
          </li>
        )}

        {(meterOk || mic === 'blocked') && (mic === 'on' || demo) && (
          <li className={phrase === 'ok' ? 'ok' : phrase === 'retry' ? 'bad' : ''}>
            <strong>Say this sentence</strong>
            <p className="mic-phrase">"{PHRASE}"</p>
            {phrase === 'ok' && <span>✓ Heard clearly.</span>}
            {phrase === 'retry' && <span>We didn't catch that. Move closer, speak up a little, and try again.</span>}
            {phrase !== 'ok' && (
              <div className="row">
                <ReadAloud key={phrase} text={PHRASE} provider={provider} label={phrase === 'retry' ? 'Try again' : 'Say it'} doneLabel="Done"
                  onResult={c => setPhrase(c.coverage >= 0.6 ? 'ok' : 'retry')} />
              </div>
            )}
          </li>
        )}
      </ol>

      <div className="row wrap">
        <button className="btn btn-orange btn-big" disabled={!ready} onClick={finish}>{ready ? "Ready! Let's read →" : 'Finish the mic check to start'}</button>
        {onCancel && <button className="btn btn-ghost" onClick={onCancel}>Back</button>}
      </div>
    </section>
  );
}
