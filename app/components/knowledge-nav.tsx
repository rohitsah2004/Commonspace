'use client';

import { useEffect, useState } from 'react';
import { TYPE_LABELS, CONTENT_TYPES } from '../../lib/types';

type TagCount = { slug: string; label: string; count: number };
export default function KnowledgeNav() {
  const [tags, setTags] = useState<TagCount[]>([]);
  useEffect(() => {
    const controller = new AbortController();
    fetch('/api/tags', { signal: controller.signal }).then(r => r.json()).then(data => setTags((data as { tags: TagCount[] }).tags)).catch(() => {});
    return () => controller.abort();
  }, []);
  return <>
    <nav aria-label="Knowledge types">{CONTENT_TYPES.map(type => <a href={TYPE_LABELS[type].path} key={type}>{TYPE_LABELS[type].plural}</a>)}<a href="/tags">All tags</a></nav>
    <div className="collectionhead"><span className="navlabel">POPULAR TAGS</span></div>
    <nav aria-label="Popular tags">{tags.slice(0, 12).map(tag => <a href={'/tags/' + tag.slug} key={tag.slug}><span className="collectiondot"/>{tag.label}<small>{tag.count}</small></a>)}</nav>
  </>;
}
