import {BookmarkButton} from './bookmark-button';
import type { Card } from '../../lib/queries';
import { TYPE_LABELS } from '../../lib/types';
import { normalizeTag } from '../../lib/slug';

export function ContentCard({ card }: { card: Card }) {
  return <article className="storycard knowledgecard">
    <div className="storydetails"><BookmarkButton item={card}/>
      <div className="chips"><span className="statusbadge">{TYPE_LABELS[card.type].singular}</span>
        {card.difficulty && <span className="statusbadge">{card.difficulty}</span>}
        {card.resourceKind && <span className="statusbadge">{card.resourceKind}</span>}
      </div>
      <a href={'/post/' + card.slug}><h3>{card.title}</h3></a>
      {card.type === 'resource' && card.resourceUrl && <small>{new URL(card.resourceUrl).hostname}</small>}
      <p>{card.takeaway || card.excerpt || card.subtitle}</p>
      <div className="chips">{card.tags.map(tag => <a key={tag} href={'/tags/' + normalizeTag(tag)} className="chip">{tag}</a>)}</div>
      <div className="storymeta"><time dateTime={new Date(card.publishedAt).toISOString()}>{new Date(card.publishedAt).toISOString().slice(0, 10)}</time><span>· {card.readingTime} min read</span></div>
      {card.type === 'resource' && card.resourceUrl && <a className="textbutton resourcevisit" href={card.resourceUrl} target="_blank" rel="noopener noreferrer">Visit resource ↗</a>}
    </div>
  </article>;
}
