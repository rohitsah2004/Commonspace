'use client';

import { useState, type ReactNode } from 'react';
export function CopyCode({ text }: { text: string }) {
  const [status, setStatus] = useState('Copy');
  return <button className="copycode" aria-label="Copy code to clipboard" onClick={async () => {
    try { await navigator.clipboard.writeText(text); setStatus('Copied'); }
    catch { setStatus('Select code to copy'); }
    setTimeout(() => setStatus('Copy'), 2500);
  }}><span aria-live="polite">{status}</span></button>;
}
export function CodeBlock({ text, language, children }: { text: string; language: string; children: ReactNode }) {
  return <pre data-language={language}><CopyCode text={text}/><code>{children}</code></pre>;
}
