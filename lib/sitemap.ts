import type { MetadataRoute } from 'next';
import { publicItems, getTagCounts } from './queries';
import { getCollections, siteUrl } from './server';
import { TYPE_LABELS, CONTENT_TYPES } from './types';
import { snapshotModified } from './snapshot';
import { normalizeTag } from './slug';
export async function knowledgeSitemap(): Promise<MetadataRoute.Sitemap> {
  const items = await publicItems(); const tags = await getTagCounts(items); const collections = await getCollections();
  const newest = (list: typeof items) => list.length ? new Date(Math.max(...list.map(snapshotModified))).toISOString() : undefined;
  const origin = siteUrl();
  return [
    ...['', '/about', '/collections', '/tags'].map(path => ({ url: origin + path, lastModified: newest(items) })),
    ...CONTENT_TYPES.map(type => ({ url: origin + TYPE_LABELS[type].path, lastModified: newest(items.filter(item => item.content.type === type)) })),
    ...tags.map(tag => ({ url: origin + '/tags/' + tag.slug, lastModified: newest(items.filter(item => item.content.tags.some(t => normalizeTag(t) === tag.slug))) })),
    ...collections.map(collection => ({ url: origin + '/collections/' + collection.slug, lastModified: newest(items.filter(item => item.content.series === collection.id)) })),
    ...items.map(item => ({ url: origin + '/post/' + item.row.slug, lastModified: new Date(snapshotModified(item)).toISOString() })),
  ];
}
