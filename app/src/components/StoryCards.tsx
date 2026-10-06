import type { Story } from '../types';
import type { ReadingEvent } from '../lib/rewards';

/** Each page read aloud and checked unlocks that page's picture as a card. */
export function cardsCollected(events: ReadingEvent[], storyId: string): Set<number> {
  return new Set(events.filter(e => e.type === 'page' && e.verified && e.storyId === storyId).map(e => (e as { page: number }).page));
}

export default function StoryCards({ story, base, events, highlight = [] }: { story: Story; base: string; events: ReadingEvent[]; highlight?: number[] }) {
  const got = cardsCollected(events, story.id);
  return (
    <div className="cards">
      {story.pages.map(p => {
        const have = got.has(p.page);
        return (
          <figure key={p.page} className={'card' + (have ? ' have' : '') + (highlight.includes(p.page) ? ' new' : '')}>
            {p.image ? <img src={base + p.image} alt={have ? p.imageAlt ?? '' : ''} /> : <span className="card-noimg">{p.page}</span>}
            {!have && <span className="card-lock" aria-hidden="true">?</span>}
            <figcaption>{have ? p.heading : `Page ${p.page}`}</figcaption>
          </figure>
        );
      })}
    </div>
  );
}
