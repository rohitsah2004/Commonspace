import { publicRows } from './server';
import { plainText, readingTime, type Content } from './content';
import { normalizeTag } from './slug';
import type { ContentType, Difficulty, ResourceKind } from './types';

export type PublicRow = { id: string; slug: string; published: string; published_at: number; updated_at: number };
export type PublicItem = { row: PublicRow; content: Content };
export type Card = {
  id: string; slug: string; type: ContentType; title: string; subtitle: string;
  excerpt: string; tags: string[]; difficulty: Difficulty | ''; resourceUrl?: string;
  resourceKind?: ResourceKind; takeaway?: string; reviewedAt?: number;
  publishedAt: number; updatedAt: number; readingTime: number; series?: string; position?: number;
};
export type PublicFilters = {
  type?: ContentType; tags?: string[]; difficulty?: Difficulty | ''; q?: string;
  limit?: number; offset?: number; sort?: 'latest' | 'oldest' | 'title';
};

export function parseRows(rows: PublicRow[]): PublicItem[] {
  return rows.map(row => { const content: Content = JSON.parse(row.published); return { row, content: { ...content, type: content.type ?? 'post' } }; });
}

export async function publicItems(): Promise<PublicItem[]> {
  return parseRows(await publicRows());
}

export function toCard(item: PublicItem | PublicRow): Card {
  const { row, content: c } = 'row' in item ? item : parseRows([item])[0];
  return {
    id: row.id, slug: row.slug, type: c.type ?? 'post', title: c.title, subtitle: c.subtitle,
    excerpt: plainText(c.body).replace(/\s+/g, ' ').trim().slice(0, 200), tags: c.tags,
    difficulty: c.difficulty ?? '', resourceUrl: c.resourceUrl, resourceKind: c.resourceKind,
    takeaway: c.takeaway, reviewedAt: c.reviewedAt, publishedAt: row.published_at,
    updatedAt: row.updated_at, readingTime: readingTime(c), series: c.series, position: c.position,
  };
}

export function score(item: PublicItem, query: string): number {
  const q = query.trim().toLowerCase();
  if (!q) return 0;
  const c = item.content;
  return (c.title.toLowerCase().includes(q) ? 100 : 0)
    + (c.tags.some(t => t.toLowerCase().includes(q) || normalizeTag(t).includes(normalizeTag(q))) ? 40 : 0)
    + (c.subtitle.toLowerCase().includes(q) ? 20 : 0)
    + (plainText(c.body).toLowerCase().includes(q) ? 5 : 0);
}

export async function listPublic(options: PublicFilters = {}, supplied?: PublicItem[]) {
  const items = supplied ?? await publicItems();
  const filtered = items.filter(item => {
    const c = item.content;
    return (!options.type || (c.type ?? 'post') === options.type)
      && (!options.difficulty || c.difficulty === options.difficulty)
      && (!options.tags?.length || options.tags.every(t => c.tags.some(tag => normalizeTag(tag) === normalizeTag(t))))
      && (!options.q || score(item, options.q) > 0);
  });
  filtered.sort((a, b) => options.q ? score(b, options.q) - score(a, options.q) || b.row.published_at - a.row.published_at
    : options.sort === 'title' ? a.content.title.localeCompare(b.content.title)
    : options.sort === 'oldest' ? a.row.published_at - b.row.published_at : b.row.published_at - a.row.published_at);
  return { total: filtered.length, items: filtered.slice(options.offset ?? 0, (options.offset ?? 0) + (options.limit ?? filtered.length)) };
}

export async function getTagCounts(supplied?: PublicItem[]) {
  const tags = new Map<string, { slug: string; label: string; count: number }>();
  for (const item of supplied ?? await publicItems()) {
    for (const label of new Set(item.content.tags.map(normalizeTag))) {
      if (!label) continue;
      const old = tags.get(label);
      if (old) old.count++;
      else tags.set(label, { slug: label, label: item.content.tags.find(t => normalizeTag(t) === label)!, count: 1 });
    }
  }
  return [...tags.values()].sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
}

export async function getRelated(post: PublicItem, n: number, supplied?: PublicItem[]) {
  const tags = new Set(post.content.tags.map(normalizeTag));
  const overlap = (item: PublicItem) => item.content.tags.filter(t => tags.has(normalizeTag(t))).length;
  return (supplied ?? await publicItems()).filter(item => item.row.id !== post.row.id)
    .sort((a, b) => overlap(b) - overlap(a)
      || Number(b.content.type === post.content.type) - Number(a.content.type === post.content.type)
      || b.row.published_at - a.row.published_at).slice(0, n);
}
