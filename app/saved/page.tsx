'use client';

import { useEffect, useRef, useState } from 'react';
import { Shell } from '../ui';
import { useSaved, validateSaved } from '../../lib/saved';
import { CONTENT_TYPES, TYPE_LABELS } from '../../lib/types';
import type { Card } from '../../lib/queries';

export default function Page() {
  const saved = useSaved();
  const [cards, setCards] = useState<Record<string, Card>>({});
  const [checkedIds, setCheckedIds] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const file = useRef<HTMLInputElement>(null);
  const ids = saved.items.map(item => item.id).join(',');
  const checked = checkedIds === ids;
  useEffect(() => {
    const controller = new AbortController();
    const list = ids ? ids.split(',') : [];
    const requests = [];
    for (let start = 0; start < list.length; start += 100) requests.push(fetch('/api/public/lookup?ids=' + encodeURIComponent(list.slice(start, start + 100).join(',')), { signal: controller.signal }).then(async r => {
      if (!r.ok) throw Error('Availability lookup failed.');
      return await r.json() as { items: Card[] };
    }));
    Promise.all(requests).then(results => {
      if (!controller.signal.aborted) { setCards(Object.fromEntries(results.flatMap(r => r.items).map(c => [c.id, c]))); setCheckedIds(ids); }
    }).catch(() => { if (!controller.signal.aborted) { setCheckedIds(null); setMessage('Offline or lookup unavailable. Your saved list is still here.'); } });
    return () => controller.abort();
  }, [ids]);
  return <Shell><div className="content"><div className="eyebrow"><span/>KEEP THE USEFUL THINGS CLOSE</div><h1>Your saved knowledge<span>.</span></h1><p>Stored on this browser, without an account. Export a copy to move it between devices.</p>
    <div className="chips"><button className="chip" disabled={!saved.items.length} onClick={() => {
      const url = URL.createObjectURL(new Blob([JSON.stringify(saved.items, null, 2)], { type: 'application/json' }));
      const a = document.createElement('a'); a.href = url; a.download = 'commonplace-saved.json'; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
    }}>Export saved list</button><button className="chip" onClick={() => file.current?.click()}>Import saved list</button></div>
    <input ref={file} hidden type="file" accept="application/json,.json" onChange={async e => {
      const selected = e.target.files?.[0]; if (!selected) return;
      try {
        if (selected.size > 300000) throw Error('Choose a saved list smaller than 300 KB.');
        const items = validateSaved(JSON.parse(await selected.text()));
        const merged = [...new Map([...saved.items, ...items].map(item => [item.id, item])).values()];
        if (merged.length > 500) throw Error('The merged list would exceed 500 items.');
        if (!saved.replace(merged)) throw Error('Browser storage is unavailable.');
        setMessage('Saved list imported.');
      } catch (error) { setMessage(error instanceof Error ? error.message : 'Invalid saved list.'); }
      e.target.value = '';
    }}/><p role="status">{message}</p>
    {CONTENT_TYPES.map(type => {
      const items = saved.items.filter(item => (cards[item.id]?.type ?? item.type) === type);
      return items.length ? <section key={type} className="savedgroup"><h2>{TYPE_LABELS[type].plural} <span>{items.length}</span></h2>{items.map(item => <div className="metricrow" key={item.id}><div>{checked && !cards[item.id] ? <><b>{item.title}</b><small>No longer available</small></> : <><a href={'/post/' + (cards[item.id]?.slug ?? item.slug)}>{cards[item.id]?.title ?? item.title}</a><small>{checked ? 'Available to read' : 'Availability not checked'}</small></>}</div><button className="textbutton" onClick={() => { if (!saved.remove(item.id)) setMessage('Browser storage is unavailable.'); }}>Remove</button></div>)}</section> : null;
    })}
    {!saved.items.length && <div className="empty"><h2>A useful idea is worth keeping.</h2><p>Tap Save on any item to find it here.</p><a className="primary" href="/posts">Explore knowledge</a></div>}
  </div></Shell>;
}
