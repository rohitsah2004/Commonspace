import type { PublicItem } from '../../lib/queries';
import { snapshotModified } from '../../lib/snapshot';
import { siteUrl } from '../../lib/server';
export function ArticleStructuredData({ item, author }: { item: PublicItem; author: string }) {
  const canonical = siteUrl() + '/post/' + item.row.slug;
  const value = { '@context': 'https://schema.org', '@type': item.content.type === 'resource' ? 'Article' : 'TechArticle',
    headline: item.content.title, description: item.content.subtitle,
    datePublished: new Date(item.row.published_at).toISOString(), dateModified: new Date(snapshotModified(item)).toISOString(),
    author: { '@type': 'Person', name: author, url: siteUrl() + '/about' }, keywords: item.content.tags,
    mainEntityOfPage: { '@type': 'WebPage', '@id': canonical }, url: canonical };
  // JSON-LD is data, never author HTML. Escaping '<' prevents a closing-script sequence.
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(value).replace(/</g, '\\u003c') }}/>;
}
