import { useEffect, useState } from 'react';
import { loadManifest, manifestProblem, type AudioManifest } from '../lib/pageAudio';
import { onPendingChange, pendingCount } from '../lib/outbox';

const REPO = 'https://github.com/pcharman1974/fluencyapp';

/** Footnote: which build this is, and whether the recorded model reading loaded. */
export default function BuildInfo({ base }: { base: string }) {
  const [audio, setAudio] = useState<AudioManifest | null | undefined>(undefined);
  useEffect(() => { loadManifest(base).then(setAudio); }, [base]);
  const [waiting, setWaiting] = useState(0);
  useEffect(() => { pendingCount().then(setWaiting); return onPendingChange(setWaiting); }, []);
  const b = __BUILD_INFO__;
  const built = new Date(b.builtAt).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  const voice = audio === undefined ? 'checking…'
    : audio ? `recorded${audio.provider ? ` (${audio.provider === 'elevenlabs' ? 'ElevenLabs' : audio.provider})` : ''}, ${Object.keys(audio.pages).length} pages`
    : `device voice (no recordings: ${manifestProblem || 'not found'})`;
  return (
    <p className="build-info">
      Version {b.commit
        ? <a href={`${REPO}/commit/${b.commit}`} target="_blank" rel="noreferrer">{b.commit}</a>
        : 'unknown'}
      {b.message && <> · {b.message}</>} · built {built} ({b.target}) · Model reading: {voice}
      {waiting > 0 && <> · <b>{waiting} upload{waiting === 1 ? '' : 's'} waiting (will send when online)</b></>}
    </p>
  );
}
