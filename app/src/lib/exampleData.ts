// Made-up example pupils so the teacher dashboard can be shown before a class has used it.
// Always labelled "Example" in the interface and never mixed into real pupils' records.
import { award, type ReadingEvent } from './rewards';

interface Pattern { code: string; sessionsPerWeek: number[]; failRate: number; startWcpm: number; gain: number }

// sessionsPerWeek: oldest week first, last entry = this week
const PATTERNS: Pattern[] = [
  { code: 'EX-01', sessionsPerWeek: [3, 3, 3, 3, 3, 3, 3, 2], failRate: 0.05, startWcpm: 68, gain: 3 },
  { code: 'EX-02', sessionsPerWeek: [2, 3, 3, 2, 1, 1, 0, 0], failRate: 0.1, startWcpm: 74, gain: 1 },
  { code: 'EX-03', sessionsPerWeek: [0, 0, 0, 0, 0, 2, 3, 3], failRate: 0.1, startWcpm: 55, gain: 4 },
  { code: 'EX-04', sessionsPerWeek: [3, 2, 3, 3, 2, 3, 3, 1], failRate: 0.5, startWcpm: 61, gain: 1 },
  { code: 'EX-05', sessionsPerWeek: [3, 3, 3, 3, 3, 3, 3, 3], failRate: 0.08, startWcpm: 82, gain: 2 },
  { code: 'EX-06', sessionsPerWeek: [1, 1, 0, 1, 0, 1, 0, 1], failRate: 0.2, startWcpm: 49, gain: 1 },
];

const WORDS = ['archaeologists', 'excavated', 'structures', 'dedication', 'quarried', 'extraordinary', 'generation', 'ancestors'];

export function exampleClass(now = new Date()): { code: string; events: ReadingEvent[] }[] {
  const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - ((now.getDay() + 6) % 7), 10);
  return PATTERNS.map((p, pi) => {
    let seed = pi * 9973 + 17;
    const rand = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
    const raw: ReadingEvent[] = [];
    let page = 1, timedCount = 0;
    p.sessionsPerWeek.forEach((n, wi) => {
      const weekStart = new Date(monday.getTime() - (p.sessionsPerWeek.length - 1 - wi) * 7 * 864e5);
      for (let s = 0; s < n; s++) {
        const day = new Date(weekStart.getTime() + [0, 2, 4][s] * 864e5 + 3600e3 * (1 + s));
        if (day > now) continue;
        // Fluency drifts up with practice: about `gain` WCPM per timed read so far.
        const level = p.startWcpm + p.gain * timedCount;
        for (let k = 0; k < 3; k++) {
          const fail = rand() < p.failRate;
          raw.push({ type: 'page', date: new Date(day.getTime() + k * 120e3).toISOString(), storyId: 'secret-stones', page,
            verified: !fail, coverage: fail ? 0.3 + rand() * 0.4 : 0.9 + rand() * 0.1, accuracy: 0.85 + rand() * 0.15,
            words: 75 + Math.round(rand() * 25), durationSec: 50 + rand() * 30, misread: rand() < 0.4 ? [WORDS[Math.floor(rand() * WORDS.length)]] : [],
            wcpm: Math.round(level - 6 + rand() * 10) });
          if (!fail) page = page % 10 + 1;
        }
        // A "beat your best" re-read on the second session of the week: practised pages go faster.
        if (s === 1) {
          raw.push({ type: 'reread', date: new Date(day.getTime() + 420e3).toISOString(), storyId: 'secret-stones',
            page: (page + 8) % 10 + 1, verified: rand() > p.failRate, wcpm: Math.round(level + 6 + rand() * 10) });
        }
        if (s === 0) {
          raw.push({ type: 'timed', date: new Date(day.getTime() + 600e3).toISOString(), storyId: 'secret-stones',
            wcpm: Math.round(p.startWcpm + p.gain * timedCount + (rand() * 6 - 3)), errorWords: [] });
          timedCount++;
        }
      }
    });
    // Run through the real rules so Power, badges and goals match what pupils would see.
    const events: ReadingEvent[] = [];
    for (const e of raw) {
      const a = award(events, e, { storyPages: 10 });
      events.push(e, ...a.points.map(x => ({ type: 'points' as const, date: e.date, ...x })), ...a.badges.map(id => ({ type: 'badge' as const, date: e.date, id })));
    }
    return { code: p.code, events };
  });
}
