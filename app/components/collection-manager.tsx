'use client';

import { useState } from 'react';
import type { CollectionMetadata } from '../../lib/collection-metadata';

type Collection = CollectionMetadata & { id: string; name: string; description: string; slug: string };
type Item = { id: string; version: number; draft: { title: string; series?: string; position?: number } };
export function CollectionManager({ collections, posts, refresh }: { collections: Collection[]; posts: Item[]; refresh: () => Promise<void> }) {
  return <div>{collections.map(c => <CollectionEditor key={c.id + c.name + c.description} collection={c} items={posts.filter(p => p.draft.series === c.id).sort((a, b) => (a.draft.position ?? 0) - (b.draft.position ?? 0))} refresh={refresh}/>)}</div>;
}
function CollectionEditor({ collection: c, items, refresh }: { collection: Collection; items: Item[]; refresh: () => Promise<void> }) {
  const [details, setDetails] = useState({ name: c.name, description: c.description, audience: c.audience ?? '', estimatedHours: c.estimatedHours?.toString() ?? '' });
  const [order, setOrder] = useState(items.map(item => item.id));
  const [message, setMessage] = useState(''); const [busy, setBusy] = useState(false); const [confirmDelete, setConfirmDelete] = useState(false);
  async function send(action: string, extra: object = {}) {
    setBusy(true); setMessage('');
    try {
      const r = await fetch('/api/manage', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action, id: c.id, ...extra }) });
      const value = await r.json() as { error?: string };
      if (!r.ok) throw Error(value.error || 'Could not update collection.');
      await refresh(); setMessage('Collection updated.');
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Could not update collection.'); }
    finally { setBusy(false); }
  }
  function move(index: number, direction: number) {
    const next = [...order]; const target = index + direction;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]]; setOrder(next);
  }
  return <section className="toolpanel"><form onSubmit={e => { e.preventDefault(); send('updateCollection', { ...details, estimatedHours: details.estimatedHours ? Number(details.estimatedHours) : '' }); }}>
    <h2>{c.name}</h2><label>Name<input required maxLength={100} value={details.name} onChange={e => setDetails({ ...details, name: e.target.value })}/></label>
    <label>Description<textarea rows={3} maxLength={1000} value={details.description} onChange={e => setDetails({ ...details, description: e.target.value })}/></label>
    <label>Audience<input maxLength={80} placeholder="e.g. Beginner" value={details.audience} onChange={e => setDetails({ ...details, audience: e.target.value })}/></label>
    <label>Estimated hours<input type="number" min="0.1" max="1000" step="0.1" value={details.estimatedHours} onChange={e => setDetails({ ...details, estimatedHours: e.target.value })}/></label>
    <div className="dialogfoot"><a href={'/collections/' + c.slug}>View path ↗</a><button className="primary" disabled={busy}>Save details</button></div>
  </form>
    {order.length > 0 && <><h3>Order the steps</h3>{order.map((id, i) => <div className="metricrow" key={id}><span>{i + 1}. {items.find(p => p.id === id)?.draft.title}</span><div><button aria-label={'Move step ' + (i + 1) + ' up'} disabled={busy || i === 0} onClick={() => move(i, -1)}>↑</button><button aria-label={'Move step ' + (i + 1) + ' down'} disabled={busy || i === order.length - 1} onClick={() => move(i, 1)}>↓</button></div></div>)}<button className="chip" disabled={busy} onClick={() => send('reorderCollection', { postIds: order, versions: Object.fromEntries(items.map(p => [p.id, p.version])) })}>Save step order</button><small>Reordering changes position metadata only. Private body edits remain private.</small></>}
    <p role="status">{message}</p>{confirmDelete ? <div className="errorbox"><p>Delete this collection? Its posts will stay available.</p><button onClick={() => setConfirmDelete(false)}>Cancel</button><button disabled={busy} onClick={() => send('deleteCollection')}>Delete collection</button></div> : <button className="textbutton danger" disabled={busy} onClick={() => setConfirmDelete(true)}>Delete collection</button>}
  </section>;
}
