'use client';

import { useEffect, useRef, useState } from 'react';
import { RichBody, validateContent, type Content } from '../../lib/content';
import { CONTENT_TYPES, TYPE_LABELS, type ContentType } from '../../lib/types';
import { ASSIST_INPUT_LIMIT } from '../../lib/assist-limits';
import type { AssistMode } from '../../lib/assist-prompt';

type Result = { content: Content; warnings: string[] };
export function AIAssistant({ content, onApply }: { content: Content; onApply: (content: Content) => void }) {
  const [ready, setReady] = useState<boolean | null>(null);
  const [open, setOpen] = useState(false); const [text, setText] = useState('');
  const [mode, setMode] = useState<AssistMode>('format'); const [type, setType] = useState<ContentType | ''>('');
  const [tags, setTags] = useState(''); const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(''); const [result, setResult] = useState<Result | null>(null);
  const [before, setBefore] = useState(false); const [confirmation, setConfirmation] = useState<string | null>(null);
  const dialog = useRef<HTMLDialogElement>(null); const textarea = useRef<HTMLTextAreaElement>(null);
  const request = useRef<AbortController | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    fetch('/api/assist', { cache: 'no-store', signal: controller.signal }).then(async response => {
      if (!response.ok) throw Error('Unavailable');
      const data = await response.json() as { ready?: boolean }; return data.ready === true;
    }).then(value => { if (!controller.signal.aborted) setReady(value); }).catch(() => { if (!controller.signal.aborted) setReady(false); });
    return () => { controller.abort(); request.current?.abort(); };
  }, []);
  useEffect(() => { if (open) { dialog.current?.showModal(); textarea.current?.focus(); } }, [open]);
  function cancel() {
    request.current?.abort(); request.current = null; setBusy(false);
    setMessage('AI formatting cancelled. Your original text is unchanged.');
  }
  function close() { cancel(); setResult(null); setConfirmation(null); dialog.current?.close(); }
  async function format() {
    setMessage(''); setConfirmation(null);
    if (!text.trim() || text.length > ASSIST_INPUT_LIMIT) { setMessage('Enter between 1 and 20,000 characters.'); return; }
    const tagHints = tags.split(',').map(tag => tag.trim()).filter(Boolean);
    if (tagHints.length > 6 || tagHints.some(tag => tag.length > 40)) { setMessage('Use up to six tag hints, each within 40 characters.'); return; }
    request.current?.abort(); const controller = new AbortController(); request.current = controller;
    setBusy(true); setResult(null); setBefore(false);
    try {
      const response = await fetch('/api/assist', { method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: controller.signal,
        body: JSON.stringify({ text, mode, hints: { ...(type ? { type } : {}), ...(tagHints.length ? { tags: tagHints } : {}) } }) });
      const data = await response.json() as { content?: unknown; warnings?: unknown; error?: string };
      if (controller.signal.aborted || request.current !== controller) return;
      if (!response.ok) throw Error(data.error || 'AI formatting failed. Your original text is unchanged.');
      const safe = validateContent(data.content);
      if (!Array.isArray(data.warnings) || data.warnings.some(warning => typeof warning !== 'string')) throw Error('Invalid draft response. Your original text is unchanged.');
      setResult({ content: safe, warnings: data.warnings }); setMessage('Preview ready. Review it before applying to your draft.');
    } catch (error) {
      if (!controller.signal.aborted && request.current === controller) setMessage(error instanceof Error ? error.message : 'AI formatting failed. Your original text is unchanged.');
    } finally { if (request.current === controller) { request.current = null; setBusy(false); } }
  }
  function apply() {
    if (!result) return;
    const nonempty = !!(content.title.trim() || content.subtitle || content.body.length || content.tags.length || content.cover || content.resourceUrl || content.attachments?.length);
    const fingerprint = JSON.stringify(content);
    if (nonempty && confirmation !== fingerprint) { setConfirmation(fingerprint); setMessage('This replaces your current draft text. Confirm below, or discard the AI result.'); return; }
    // Preserve owner-selected files, cover and collection; AI has no authority over them.
    onApply({ ...content, ...result.content, cover: content.cover, attachments: content.attachments, series: content.series, position: content.position });
    close();
  }
  return <>
    <button type="button" className="chip" disabled={ready !== true} onClick={() => { setMessage(''); setOpen(true); }}>Format with AI</button>
    {ready !== true && <small>{ready === null ? 'Checking AI configuration…' : 'AI formatting is off. Configure OPENAI_API_KEY and AI_MODEL on the server, then reload.'}</small>}
    <dialog ref={dialog} className="ai-dialog" aria-labelledby="ai-assistant-title" onCancel={cancel} onClose={() => { setOpen(false); setResult(null); setConfirmation(null); }}>
      <div className="dialoghead"><h2 id="ai-assistant-title">Format with AI</h2><button type="button" onClick={close} aria-label="Close AI assistant">Close</button></div>
      <p>Your text is sent to the AI provider you configured.</p>
      <p>Review every command and claim. Applying creates a draft change; publishing remains your choice.</p>
      <form onSubmit={event => { event.preventDefault(); format(); }}>
        <label>Original text<textarea ref={textarea} rows={10} value={text} readOnly={busy || !!result} onChange={event => setText(event.target.value)} aria-describedby="ai-input-count"/></label>
        <small id="ai-input-count">{text.length.toLocaleString()} / 20,000 characters</small>
        <div className="formrow"><label>Mode<select value={mode} disabled={busy || !!result} onChange={event => setMode(event.target.value as AssistMode)}><option value="format">Format</option><option value="polish">Polish</option><option value="outline">Outline</option></select></label>
          <label>Optional type hint<select value={type} disabled={busy || !!result} onChange={event => setType(event.target.value as ContentType | '')}><option value="">Let AI suggest</option>{CONTENT_TYPES.map(value => <option value={value} key={value}>{TYPE_LABELS[value].singular}</option>)}</select></label></div>
        <label>Optional tag hints (comma separated)<input value={tags} disabled={busy || !!result} onChange={event => setTags(event.target.value)} maxLength={250}/></label>
        <div role="status" aria-live="polite">{busy ? 'Formatting your text… You can cancel at any time.' : message}</div>
        {!result && <div className="dialogfoot"><button type="submit" className="primary" disabled={busy || !text.trim() || text.length > ASSIST_INPUT_LIMIT}>Format with AI</button>{busy && <button type="button" onClick={cancel}>Cancel request</button>}</div>}
      </form>
      {result && <section className="ai-preview" aria-label="AI draft preview">
        {result.warnings.length > 0 && <div className="errorbox" role="alert"><strong>Review changed code before applying</strong><ul>{result.warnings.map(warning => <li key={warning}>{warning}</li>)}</ul></div>}
        <div className="chips" role="group" aria-label="Compare original and formatted text"><button type="button" className="chip" aria-pressed={before} onClick={() => setBefore(true)}>Before</button><button type="button" className="chip" aria-pressed={!before} onClick={() => setBefore(false)}>After</button></div>
        {before ? <pre className="ai-original">{text}</pre> : <div><h3>{result.content.title}</h3><p>{result.content.subtitle}</p><small>{result.content.type} · {result.content.difficulty} · {result.content.tags.join(', ')}</small><div className="prose"><RichBody nodes={result.content.body}/></div></div>}
        {confirmation !== null && <p className="errorbox">Replace your current draft text? Your cover, attachments and collection will be kept.</p>}
        <div className="dialogfoot"><button type="button" onClick={() => { setResult(null); setConfirmation(null); setMessage('AI result discarded. Your original text is unchanged.'); }}>Discard</button><button type="button" className="primary" onClick={apply}>{confirmation === null ? 'Apply to draft' : 'Confirm replacement'}</button></div>
      </section>}
    </dialog>
  </>;
}
