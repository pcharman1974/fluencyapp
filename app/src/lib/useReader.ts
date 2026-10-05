import { useCallback, useState } from 'react';
import { award, levelFor, totalPoints, type Award, type Level, type ReadingEvent } from './rewards';
import { addEvents, getEvents, getHolidays } from './storage';

export type DistributiveOmit<T, K extends keyof any> = T extends unknown ? Omit<T, K> : never;
export type NewEvent = DistributiveOmit<Exclude<ReadingEvent, { type: 'points' | 'badge' }>, 'date'>;

/** A reader's practice history, plus a function that records new reading and works out rewards. */
export function useReader(readerCode: string) {
  const [events, setEvents] = useState<ReadingEvent[]>(() => getEvents(readerCode));
  const [loadedFor, setLoadedFor] = useState(readerCode);
  if (loadedFor !== readerCode) { setLoadedFor(readerCode); setEvents(getEvents(readerCode)); }

  const record = useCallback((partial: NewEvent, ctx: { storyPages?: number } = {}): RecordResult => {
    const e = { ...partial, date: new Date().toISOString() } as ReadingEvent;
    const current = getEvents(readerCode);
    const a = award(current, e, { ...ctx, holidays: getHolidays() });
    const extra: ReadingEvent[] = [
      ...a.points.map(p => ({ type: 'points' as const, date: e.date, ...p })),
      ...a.badges.map(id => ({ type: 'badge' as const, date: e.date, id })),
    ];
    if (readerCode) addEvents(readerCode, [e, ...extra]);
    const all = [...current, e, ...extra];
    setEvents(all);
    const from = levelFor(totalPoints(current)), to = levelFor(totalPoints(all));
    return { ...a, levelUp: to.level > from.level ? LEVEL_OF(to.level) : undefined };
  }, [readerCode]);

  return { events, record, holidays: getHolidays() };
}

export type Reader = ReturnType<typeof useReader>;
export type RecordResult = Award & { levelUp?: Level };
import { LEVELS } from './rewards';
const LEVEL_OF = (n: number) => LEVELS.find(l => l.level === n)!;
