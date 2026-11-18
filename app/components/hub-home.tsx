'use client';

import { useEffect, useRef, useState } from 'react';
import {useOwner} from './ownership';
import { Shell, Icon } from '../ui';
import { Subscribe } from '../extras';
import { useSite } from './site-context';
import { ContentCard } from './content-card';
import { useSearch } from './use-search';
import { SearchSnippet } from './search-snippet';
import { CONTENT_TYPES, TYPE_LABELS, type ContentType } from '../../lib/types';
import type { Card } from '../../lib/queries';
import { defaultHubCopy } from '../../lib/hub-copy';

type Tag = { slug: string; label: string; count: number };
type Featured = { slug: string; name: string; description: string; audience?: string; estimatedHours?: number };
export type HubProps = {
  posts: Card[]; total: number; page: number; owner?: boolean;
  sections: Record<ContentType, Card[]>; tags: Tag[]; featured?: Featured;
};
export default function HubHome({ posts, total, page, owner, sections, tags, featured }: HubProps) {
  const effectiveOwner = useOwner() || owner;
  const { settings } = useSite(); const copy = settings.hub ?? defaultHubCopy;
  const [query, setQuery] = useState(''); const [tag, setTag] = useState('');
  const [view, setView] = useState('grid'); const [focused, setFocused] = useState(false);
  const search = useRef<HTMLInputElement>(null); const remote = useSearch(query, { tag: tag || undefined });
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k'
        || e.key === '/' && !['INPUT', 'TEXTAREA', 'SELECT'].includes(target?.tagName) && !target?.isContentEditable) {
        e.preventDefault(); search.current?.focus();
      }
    };
    document.addEventListener('keydown', handler); return () => document.removeEventListener('keydown', handler);
  }, []);
  const searching = query.trim().length >= 2;
  const visible = searching ? remote.results : posts;
  const headings: Record<ContentType, string> = { post: copy.posts, note: copy.notes, cheatsheet: copy.cheatSheets, resource: copy.resources };
  return <Shell><div className="content hubhome">
    <div className="intro"><div className="eyebrow"><span/>{settings.tagline}</div><h1>{settings.heroTitle}<span>.</span></h1><p>{settings.heroText}</p></div>
    <div className="searchwrap"><Icon name="search"/><input ref={search} aria-label="Search knowledge" value={query} placeholder={copy.searchPlaceholder}
      onChange={e => setQuery(e.target.value)} onFocus={() => setFocused(true)} onBlur={() => setTimeout(() => setFocused(false), 180)}/><kbd>⌘ K /</kbd>
      {focused && searching && remote.results.length > 0 && <div id="suggestions">{remote.results.slice(0, 6).map(card => <a className="suggestion" key={card.id} href={'/post/' + card.slug}>
        <span className="statusbadge">{TYPE_LABELS[card.type].singular}</span><span>{card.title}<small><SearchSnippet text={card.snippet} query={query}/></small></span>
      </a>)}</div>}
    </div>
    <div className="chips"><label className="hubtagfilter">Filter search by topic<select aria-label="Search topic" value={tag} onChange={e => setTag(e.target.value)}><option value="">All topics</option>{tags.map(t => <option key={t.slug} value={t.slug}>{t.label}</option>)}</select></label></div>
    {remote.loading && <p role="status">{copy.searching}</p>}{remote.error && <p className="errorbox" role="alert">{remote.error}</p>}
    {!searching && <>
      {featured && <a className="featurepath" href={'/collections/' + featured.slug}><span className="statusbadge live">{copy.startHere}</span><h2>{featured.name}</h2><p>{featured.description || copy.startHereText}</p><small>{[featured.audience, featured.estimatedHours ? featured.estimatedHours + ' hours' : ''].filter(Boolean).join(' · ')}</small><span className="featurearrow">→</span></a>}
      {(['cheatsheet', 'note', 'post', 'resource'] as ContentType[]).map(type => <section className="hubrow" key={type}><div className="rowheading"><h2>{headings[type]}</h2><a href={TYPE_LABELS[type].path}>{copy.viewAll} →</a></div>
        <div className="stories hubcards">{sections[type].map(card => <ContentCard key={card.id} card={card}/>)}</div>{!sections[type].length && <p className="rowempty">{copy.emptyText}</p>}
      </section>)}
      <section className="hubrow"><h2>{copy.tags}</h2><div className="tagcloud">{tags.slice(0, 12).map(t => <a className="chip" key={t.slug} href={'/tags/' + t.slug}>{t.label} <span>{t.count}</span></a>)}</div></section>
      <Subscribe/>
    </>}
    <section className="hubrow"><div className="rowheading"><h2>{searching ? 'Search results' : copy.browse} <span>{searching ? visible.length : total}</span></h2><div className="viewtoggle"><button className={'icon ' + (view === 'grid' ? 'active' : '')} aria-label="Grid view" onClick={() => setView('grid')}><Icon name="grid"/></button><button className={'icon ' + (view === 'list' ? 'active' : '')} aria-label="List view" onClick={() => setView('list')}><Icon name="list"/></button></div></div>
      <div className={'stories ' + view}>{visible.map(card => <ContentCard key={card.id} card={card}/>)}</div>
      {!visible.length && <div className="empty"><h2>{copy.emptyTitle}</h2><p>{copy.emptyText}</p>{effectiveOwner && <a className="primary" href="/studio">Write something useful</a>}</div>}
      {!searching && <nav className="pagination" aria-label="Browse pagination">{page > 1 && <a href={'/?page=' + (page - 1)}>← Previous</a>}<span>Page {page}</span>{page * 20 < total && <a href={'/?page=' + (page + 1)}>Next →</a>}</nav>}
    </section>
    <div className="libraryfoot"><a href="/tags">Tags</a><a href="/follow">RSS</a><a href="/privacy">Privacy</a></div>
  </div></Shell>;
}
