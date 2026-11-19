'use client';

import { useState } from 'react';
import { useSite } from './site-context';
import type { Content } from '../../lib/content';
import { slugify } from '../../lib/slug';
import { plainText } from '../../lib/content';
export function Distribution({ content, slug }: { content: Content; slug?: string }) {
  const { origin } = useSite(); const [message, setMessage] = useState('');
  if (!slug) return <p className="distributionnote">Save this draft first to prepare its permanent URL.</p>;
  const canonical = origin + '/post/' + slug;
  const text = [content.title, content.excerpt || content.subtitle || plainText(content.body).slice(0, 200), content.tags.map(tag => '#' + slugify(tag).replace(/-/g, '')).filter(tag => tag !== '#').join(' '), canonical].filter(Boolean).join('\n\n');
  async function copy(value: string) {
    try { await navigator.clipboard.writeText(value); setMessage('Copied.'); }
    catch { setMessage('Clipboard unavailable. Select and copy the URL below.'); }
  }
  return <section className="distribution"><div className="chips"><button type="button" className="chip" onClick={() => copy(text)}>Copy LinkedIn post text</button><button type="button" className="chip" onClick={() => copy(canonical)}>Copy canonical URL</button></div><small>{canonical}</small><p>For Medium, publish first, then use Medium’s “Import a story” tool with this canonical URL. Copying text alone does not set its canonical.</p><span role="status">{message}</span></section>;
}
