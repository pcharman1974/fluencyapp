// The pupil's avatar (an emoji on their chosen colour) and the picker used at sign-up and on the Me screen.
import { useState } from 'react';
import { AVATARS, COLOURS, DEFAULT_PROFILE, THEMES, avatarOf, type Profile } from '../lib/profile';

export function Avatar({ profile, size = 40 }: { profile?: Partial<Profile>; size?: number }) {
  // No look chosen yet: a plain circle, so it isn't mistaken for someone's choice.
  if (!profile?.avatar) return <span className="avatar none" style={{ width: size, height: size }} aria-hidden="true" />;
  const a = avatarOf(profile.avatar);
  return (
    <span className="avatar" style={{ width: size, height: size, fontSize: size * 0.55, background: profile?.colour ?? COLOURS[0] }} aria-hidden="true">
      {a.emoji}
    </span>
  );
}

/** Choose an avatar, a colour and (when `themes` is on) an app theme. Locked items show the level that unlocks them. */
export function LookPicker({ start, level, themes = false, saveLabel, onSave }: {
  start?: Profile; level: number; themes?: boolean; saveLabel: string; onSave: (p: Profile) => void;
}) {
  const [p, setP] = useState<Profile>(start ?? DEFAULT_PROFILE);
  const set = (k: keyof Profile, v: string) => setP({ ...p, [k]: v });
  const changed = !start || start.avatar !== p.avatar || start.colour !== p.colour || start.theme !== p.theme;
  return (
    <div className="look">
      <div className="look-preview"><Avatar profile={p} size={96} /></div>

      <h3>Pick a picture</h3>
      <div className="look-grid" role="radiogroup" aria-label="Avatar">
        {AVATARS.map(a => {
          const locked = a.level > level;
          return (
            <button key={a.id} role="radio" aria-checked={p.avatar === a.id} disabled={locked}
              className={'look-item' + (p.avatar === a.id ? ' on' : '') + (locked ? ' locked' : '')}
              aria-label={locked ? `${a.label}: reach level ${a.level} to unlock` : a.label}
              onClick={() => set('avatar', a.id)}>
              <span className="look-emoji" aria-hidden="true">{a.emoji}</span>
              {locked && <span className="look-lock">Level {a.level}</span>}
            </button>
          );
        })}
      </div>

      <h3>Pick a colour</h3>
      <div className="look-colours" role="radiogroup" aria-label="Colour">
        {COLOURS.map((c, i) => (
          <button key={c} role="radio" aria-checked={p.colour === c} aria-label={`Colour ${i + 1}`}
            className={'look-colour' + (p.colour === c ? ' on' : '')} style={{ background: c }} onClick={() => set('colour', c)} />
        ))}
      </div>

      {themes && <>
        <h3>Pick a background</h3>
        <div className="look-themes" role="radiogroup" aria-label="Background">
          {THEMES.map(t => {
            const locked = t.level > level;
            return (
              <button key={t.id} role="radio" aria-checked={p.theme === t.id} disabled={locked}
                className={'look-theme' + (p.theme === t.id ? ' on' : '') + (locked ? ' locked' : '')}
                aria-label={locked ? `${t.name}: reach level ${t.level} to unlock` : t.name}
                onClick={() => set('theme', t.id)}>
                <span className="look-swatch" style={{ background: t.bg, borderColor: t.accent }} aria-hidden="true" />
                <span>{t.name}</span>
                {locked && <span className="look-lock">Level {t.level}</span>}
              </button>
            );
          })}
        </div>
      </>}

      <div className="centre-row look-save">
        <button className="btn btn-orange btn-big" disabled={!changed} onClick={() => onSave(p)}>{saveLabel}</button>
      </div>
    </div>
  );
}
