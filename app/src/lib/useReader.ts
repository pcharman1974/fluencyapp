import { useCallback, useState } from 'react';
import { award, type Award, type ReadingEvent } from './rewards';
import { addEvents, getEvents, getHolidays } from './storage';

export type DistributiveOmit<T, K extends keyof any> = T extends unknown ? Omit<T, K> : never;
export type NewEvent = DistributiveOmit<Exclude<ReadingEvent, { type: 'points' | 'badge' }>, 'date'>;

/** A reader's practice history, plus a function that records new reading and works out rewards. */
export function useReader(readerCode: string) {
  const [events, setEvents] = useState<ReadingEvent[]>(() => getEvents(readerCode));
  const [loadedFor, setLoadedFor] = useState(readerCode);
  if (loadedFor !== readerCode) { setLoadedFor(readerCode); setEvents(getEvents(readerCode)); }

  const record = useCallback((partial: NewEvent, ctx: { storyPages?: number } = {}): Award => {
    const e = { ...partial, date: new Date().toISOString() } as ReadingEvent;
    const current = getEvents(readerCode);
    const a = award(current, e, { ...ctx, holidays: getHolidays() });
    const extra: ReadingEvent[] = [
      ...a.points.map(p => ({ type: 'points' as const, date: e.date, ...p })),
      ...a.badges.map(id => ({ type: 'badge' as const, date: e.date, id })),
    ];
    if (readerCode) addEvents(readerCode, [e, ...extra]);
    setEvents([...current, e, ...extra]);
    return a;
  }, [readerCode]);

  return { events, record, holidays: getHolidays() };
}

export type Reader = ReturnType<typeof useReader>;
