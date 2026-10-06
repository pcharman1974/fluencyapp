// A pupil's look in the app: an avatar and colour (so they can find themselves on a shared device without
// a name), and an app colour theme. More avatars and themes unlock as they level up: rewards they can use.
// Saved as 'profile' events, so it travels with their records to other devices.
import type { ReadingEvent } from './rewards';

export interface Avatar { id: string; emoji: string; label: string; level: number }
export interface Theme { id: string; name: string; bg: string; accent: string; level: number }

export const AVATARS: Avatar[] = [
  { id: 'bolt', emoji: '⚡', label: 'Lightning', level: 1 },
  { id: 'rocket', emoji: '🚀', label: 'Rocket', level: 1 },
  { id: 'star', emoji: '⭐', label: 'Star', level: 1 },
  { id: 'fox', emoji: '🦊', label: 'Fox', level: 1 },
  { id: 'owl', emoji: '🦉', label: 'Owl', level: 1 },
  { id: 'ball', emoji: '⚽', label: 'Football', level: 1 },
  { id: 'guitar', emoji: '🎸', label: 'Guitar', level: 1 },
  { id: 'game', emoji: '🎮', label: 'Game controller', level: 1 },
  { id: 'wave', emoji: '🌊', label: 'Wave', level: 2 },
  { id: 'tiger', emoji: '🐯', label: 'Tiger', level: 2 },
  { id: 'planet', emoji: '🪐', label: 'Planet', level: 3 },
  { id: 'dragon', emoji: '🐉', label: 'Dragon', level: 3 },
  { id: 'volcano', emoji: '🌋', label: 'Volcano', level: 4 },
  { id: 'robot', emoji: '🤖', label: 'Robot', level: 4 },
  { id: 'comet', emoji: '☄️', label: 'Comet', level: 5 },
  { id: 'unicorn', emoji: '🦄', label: 'Unicorn', level: 5 },
  { id: 'crown', emoji: '👑', label: 'Crown', level: 6 },
  { id: 'diamond', emoji: '💎', label: 'Diamond', level: 6 },
  { id: 'trophy', emoji: '🏆', label: 'Trophy', level: 7 },
  { id: 'fire', emoji: '🔥', label: 'Fire', level: 7 },
  { id: 'galaxy', emoji: '🌌', label: 'Galaxy', level: 8 },
  { id: 'medal', emoji: '🏅', label: 'Medal', level: 8 },
];

/** Avatar background colours (all free). Dark enough for the white ring, light enough to see the emoji. */
export const COLOURS = ['#1D6FB0', '#7A5BC0', '#C2463A', '#2F6B3A', '#D9631E', '#0C5076', '#B4237A', '#8A5A00'];

/** App background themes. Light backgrounds keep text contrast the same as the default. */
export const THEMES: Theme[] = [
  { id: 'classic', name: 'Classic', bg: '#EAF1F5', accent: '#0C5076', level: 1 },
  { id: 'ocean', name: 'Ocean', bg: '#DDF0F8', accent: '#1D6FB0', level: 2 },
  { id: 'forest', name: 'Forest', bg: '#E2F2E5', accent: '#2F6B3A', level: 3 },
  { id: 'sunset', name: 'Sunset', bg: '#FCE9DE', accent: '#C2463A', level: 4 },
  { id: 'lavender', name: 'Lavender', bg: '#ECE6F8', accent: '#7A5BC0', level: 5 },
  { id: 'gold', name: 'Gold', bg: '#FAF0D2', accent: '#8A5A00', level: 6 },
  { id: 'berry', name: 'Berry', bg: '#F8E3EF', accent: '#B4237A', level: 7 },
  { id: 'lightning', name: 'Lightning', bg: 'linear-gradient(160deg, #FFF3D6 0%, #E4EEF6 55%, #E8E2F7 100%)', accent: '#0C5076', level: 8 },
];

export interface Profile { avatar: string; colour: string; theme: string }
export const DEFAULT_PROFILE: Profile = { avatar: 'bolt', colour: COLOURS[0], theme: 'classic' };

/** The pupil's latest profile, or undefined if they haven't chosen one yet. */
export function profileOf(ev: ReadingEvent[]): Profile | undefined {
  for (let i = ev.length - 1; i >= 0; i--) {
    const e = ev[i];
    if (e.type === 'profile') return { avatar: e.avatar, colour: e.colour, theme: e.theme };
  }
  return undefined;
}

export const avatarOf = (id?: string) => AVATARS.find(a => a.id === id) ?? AVATARS[0];
export const themeOf = (id?: string) => THEMES.find(t => t.id === id) ?? THEMES[0];

/** What a pupil gets when they reach a level: shown on the level-up screen so the reward is clear. */
export function unlocksAt(level: number) {
  return { avatars: AVATARS.filter(a => a.level === level), themes: THEMES.filter(t => t.level === level) };
}

/** Sound for celebrations is off unless the pupil turns it on (classrooms). Kept per device. */
const SOUND_KEY = 'btc.sound';
export const soundOn = () => { try { return localStorage.getItem(SOUND_KEY) === 'on'; } catch { return false; } };
export const setSoundOn = (on: boolean) => { try { localStorage.setItem(SOUND_KEY, on ? 'on' : 'off'); } catch { /* not kept */ } };
