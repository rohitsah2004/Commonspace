import { Shell } from '../ui';
import { ContentCard } from './content-card';
import { listPublic, getTagCounts, publicItems, toCard } from '../../lib/queries';
import { CONTENT_TYPES, DIFFICULTIES, TYPE_LABELS, type ContentType, type Difficulty } from '../../lib/types';
import { normalizeTag } from '../../lib/slug';
import { isOwner } from '../../lib/server';

export type SearchParams = Record<string, string | string[] | undefined>;
export function stringValue(value: string | string[] | undefined) { return Array.isArray(value) ? value[0] ?? '' : value ?? ''; }
export function filtersFrom(params: SearchParams, type?: ContentType) {
  const rawTags = Array.isArray(params.tag) ? params.tag : params.tag ? [params.tag] : [];
  const rawDifficulty = stringValue(params.difficulty);
  const rawSort = stringValue(params.sort);
  const page = Math.max(1, Math.min(10000, Number.parseInt(stringValue(params.page), 10) || 1));
  return {
    type, tags: rawTags.map(normalizeTag).filter(Boolean).slice(0, 8),
    difficulty: DIFFICULTIES.includes(rawDifficulty as Difficulty) ? rawDifficulty as Difficulty : undefined,
    sort: (rawSort === 'oldest' || rawSort === 'title' ? rawSort : 'latest') as 'oldest' | 'title' | 'latest',
    q: stringValue(params.q).slice(0, 200), page, limit: 20, offset: (page - 1) * 20,
  };
}

export async function TypeListing({ type, params, forcedTag }: { type?: ContentType; params: SearchParams; forcedTag?: string }) {
  const filters = filtersFrom(params, type);
  if (forcedTag) filters.tags = [normalizeTag(forcedTag)];
  const items = await publicItems();
  const [{ items: matches, total }, tags] = await Promise.all([listPublic(filters, items), getTagCounts(items)]);
  const tag = tags.find(t => t.slug === forcedTag);
  const title = forcedTag ? tag?.label || forcedTag : type ? TYPE_LABELS[type].plural : 'Everything';
  const path = forcedTag ? '/tags/' + forcedTag : type ? TYPE_LABELS[type].path : '/';
  const link = (page: number) => {
    const q = new URLSearchParams();
    for (const t of filters.tags) if (!forcedTag) q.append('tag', t);
    if (filters.difficulty) q.set('difficulty', filters.difficulty);
    if (filters.q) q.set('q', filters.q);
    q.set('sort', filters.sort); q.set('page', String(page));
    return path + '?' + q;
  };
  return <Shell owner={await isOwner()}><div className="content">
    <div className="eyebrow"><span/>EXPLORE THE KNOWLEDGE HUB</div><h1>{title}<span>.</span></h1>
    <p>Useful knowledge, organized for the next time you need it.</p>
    <form method="get" className="listingfilters">
      <label>Search<input name="q" maxLength={200} defaultValue={filters.q}/></label>
      {!forcedTag && <fieldset><legend>Tags (match all selected)</legend><div className="chips">{tags.map(t => <label className="tagcheckbox" key={t.slug}><input type="checkbox" name="tag" value={t.slug} defaultChecked={filters.tags.includes(t.slug)}/>{t.label} <small>{t.count}</small></label>)}</div></fieldset>}
      <label>Difficulty<select name="difficulty" defaultValue={filters.difficulty || ''}><option value="">All levels</option>{DIFFICULTIES.map(d => <option value={d} key={d}>{d}</option>)}</select></label>
      <label>Sort<select name="sort" defaultValue={filters.sort}><option value="latest">Newest first</option><option value="oldest">Oldest first</option><option value="title">Title A to Z</option></select></label>
      <button className="primary">Apply filters</button><a className="textbutton" href={path}>Reset</a>
    </form>
    <p>{total} {total === 1 ? 'item' : 'items'}</p>
    <div className="stories">{matches.map(item => <ContentCard key={item.row.id} card={toCard(item)}/>)}</div>
    {!matches.length && <div className="empty"><h2>No matching items yet.</h2><p>Try fewer filters, or return soon for new material.</p><a href={path} className="chip">Clear filters</a></div>}
    <nav className="pagination" aria-label="Pagination">{filters.page > 1 && <a href={link(filters.page - 1)}>← Previous</a>}<span>Page {filters.page}</span>{filters.page * 20 < total && <a href={link(filters.page + 1)}>Next →</a>}</nav>
  </div></Shell>;
}

export function validType(value: string): ContentType | undefined { return CONTENT_TYPES.includes(value as ContentType) ? value as ContentType : undefined; }
