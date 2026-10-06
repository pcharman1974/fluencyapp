// "Me": the pupil changes their avatar, colour and background, and turns celebration sounds on or off.
// New avatars and backgrounds unlock as they level up, so Power buys something they can see.
import { useState } from 'react';
import type { Screen } from '../App';
import { LookPicker } from '../components/Avatar';
import { celebrate } from '../components/Celebrate';
import { SayIt } from '../components/SayIt';
import { profileOf, setSoundOn, soundOn, unlocksAt } from '../lib/profile';
import { LEVELS, levelFor, totalPoints } from '../lib/rewards';
import type { Reader } from '../lib/useReader';

export default function Me({ reader, readerCode, go }: { reader: Reader; readerCode: string; go: (s: Screen) => void }) {
  const lv = levelFor(totalPoints(reader.events));
  const [sound, setSound] = useState(soundOn());
  const [saved, setSaved] = useState(false);
  const next = LEVELS.find(l => l.level === lv.level + 1);
  const nextUnlocks = next && unlocksAt(next.level);
  const nextText = next && nextUnlocks
    ? `At level ${next.level} you unlock ${[...nextUnlocks.avatars.map(a => a.label.toLowerCase()), ...nextUnlocks.themes.map(t => `the ${t.name} background`)].join(', ')}.`
    : 'You have unlocked everything. Amazing!';

  return (
    <div className="me">
      <section className="panel">
        <div className="me-head">
          <h2>My look</h2>
          <span className="hint">Reader {readerCode} · Level {lv.level}</span>
        </div>
        <p className="hint">{nextText} <SayIt text={nextText} /></p>
        <LookPicker key={saved ? 'saved' : 'edit'} start={profileOf(reader.events)} level={lv.level} themes saveLabel="Save my look"
          onSave={p => { reader.record({ type: 'profile', ...p }); setSaved(true); celebrate('small'); }} />
        {saved && <p className="centre-text hint" role="status">Saved.</p>}
      </section>

      <section className="panel me-sound">
        <label className="check-row">
          <input type="checkbox" checked={sound} onChange={e => { setSound(e.target.checked); setSoundOn(e.target.checked); if (e.target.checked) celebrate('small'); }} />
          <span>Play a sound when I celebrate</span>
        </label>
        <p className="hint">Off is best in a quiet classroom.</p>
      </section>

      <div className="centre-row"><button className="btn btn-navy" onClick={() => go({ name: 'home' })}>Back to my book</button></div>
    </div>
  );
}
