'use client';

import { useState } from 'react';
import { useSaved, type SavedItem } from '../../lib/saved';
export function BookmarkButton({ item }: { item: Omit<SavedItem, 'savedAt'> }) {
  const { isSaved, toggle } = useSaved();
  const [message, setMessage] = useState('');
  const saved = isSaved(item.id);
  return <span className="bookmarkcontrol"><button className={'bookmarkbutton ' + (saved ? 'active' : '')}
    aria-label={(saved ? 'Remove saved ' : 'Save ') + item.title} aria-pressed={saved}
    onClick={() => setMessage(toggle(item) ? '' : 'Could not save. Storage may be blocked or the 500-item limit reached.')}>
    <svg viewBox="0 0 24 24" fill={saved ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><path d="M6 3h12v18l-6-4-6 4z"/></svg>{saved ? 'Saved' : 'Save'}
  </button>{message && <small role="status">{message}</small>}</span>;
}
export function SavedNavLink() {
  const { items } = useSaved();
  return <a href="/saved">Saved <small>{items.length}</small></a>;
}
