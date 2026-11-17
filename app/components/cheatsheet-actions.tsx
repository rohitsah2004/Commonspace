'use client';

import { useState } from 'react';
export function CheatSheetActions({ markdown }: { markdown: string }) {
  const [message, setMessage] = useState('');
  return <div className="cheatsheetactions"><button className="chip" onClick={async () => {
    try { await navigator.clipboard.writeText(markdown); setMessage('Markdown copied.'); }
    catch { setMessage('Clipboard unavailable. Use your browser selection to copy.'); }
  }}>Copy as Markdown</button><button className="chip" onClick={() => window.print()}>Print / Save as PDF</button><span role="status">{message}</span></div>;
}
