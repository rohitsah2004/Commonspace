'use client';

import { useRef, useState } from 'react';
export function FeedLink({ url }: { url: string }) {
  const input = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState('');
  return <div>
    <div className="rss-link"><label>RSS feed address<input ref={input} type="url" readOnly value={url} onFocus={event => event.currentTarget.select()}/></label>
      <button type="button" className="primary" onClick={async () => {
        try { await navigator.clipboard.writeText(url); setMessage('Feed link copied. Paste it into your RSS reader.'); }
        catch { input.current?.focus(); input.current?.select(); setMessage('Link selected. Press Ctrl+C or ⌘C to copy it.'); }
      }}>Copy feed link</button>
    </div>
    <p role="status" aria-live="polite">{message}</p>
  </div>;
}
