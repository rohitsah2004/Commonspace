'use client';

import type { Card } from '../../lib/queries';
import { TYPE_LABELS } from '../../lib/types';
import { useProgress } from '../../lib/progress';
import { BookmarkButton } from './bookmark-button';

export function CollectionSteps({ id, cards }: { id: string; cards: Card[] }) {
  const { done, toggle, error } = useProgress(id);
  const completed = cards.filter(card => done.includes(card.id)).length;
  return <section className="serieslist"><p role="status">{completed} of {cards.length} complete</p><progress max={Math.max(1, cards.length)} value={completed} aria-label="Learning path progress"/>
    {error && <p role="status">{error}</p>}
    {cards.map((card, i) => <div className="seriesstep" key={card.id}><span className="seriesnumber">{String(i + 1).padStart(2, '0')}</span><div className="stepbody"><a href={'/post/' + card.slug}><h2>{card.title}</h2></a><p>{card.subtitle || card.takeaway}</p><small>{TYPE_LABELS[card.type].singular} · {card.readingTime} min read</small><div className="stepactions"><label><input type="checkbox" checked={done.includes(card.id)} onChange={() => toggle(card.id)}/>Mark done</label><BookmarkButton item={card}/></div></div></div>)}
  </section>;
}
