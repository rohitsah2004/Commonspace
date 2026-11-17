'use client';
import {AIAssistant} from './ai-assistant';
import { useState } from 'react';
import type { Content } from '../../lib/content';
import { importMarkdown } from '../../lib/markdown-import';
import { contentToMarkdown } from '../../lib/markdown';
import { MARKDOWN_LIMIT } from '../../lib/markdown-parser';
import { slugify } from '../../lib/slug';
export function MarkdownTools({ content, onImport }: { content: Content; onImport: (content: Content) => void }) {
  const [open, setOpen] = useState(false); const [source, setSource] = useState(''); const [error, setError] = useState('');
  return <section className="markdowntools"><div className="chips"><button type="button" className="chip" onClick={() => setOpen(true)}>Import Markdown</button><AIAssistant content={content} onApply={onImport}/>
    <button type="button" className="chip" onClick={() => {
      const url = URL.createObjectURL(new Blob([contentToMarkdown(content)], { type: 'text/markdown;charset=utf-8' }));
      const a = document.createElement('a'); a.href = url; a.download = (slugify(content.title) || 'draft') + '.md'; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
    }}>Download .md</button></div>
    {open && <div className="modalback"><section className="confirmbox" role="dialog" aria-modal="true" aria-label="Import Markdown"><h2>Import Markdown</h2><p>This replaces the current draft text. Existing revisions stay available. Maximum 300 KB.</p>
      <label>Choose a Markdown file<input type="file" accept=".md,.markdown,text/markdown,text/plain" onChange={async e => {
        setError(''); const file = e.target.files?.[0]; if (!file) return;
        if (file.size > MARKDOWN_LIMIT) { setError('Choose Markdown under 300 KB.'); return; }
        try { setSource(await file.text()); } catch { setError('Could not read this file.'); }
      }}/></label><label>Or paste Markdown<textarea rows={12} value={source} onChange={e => setSource(e.target.value)}/></label>
      {error && <p role="alert">{error}</p>}<div className="dialogfoot"><button type="button" onClick={() => setOpen(false)}>Cancel</button><button type="button" className="primary" onClick={() => {
        try { onImport(importMarkdown(source, content)); setOpen(false); setError(''); } catch (e) { setError(e instanceof Error ? e.message : 'Could not import Markdown.'); }
      }}>Replace draft text</button></div></section></div>}
  </section>;
}
