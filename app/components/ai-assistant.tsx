'use client';

import { useEffect, useRef, useState } from 'react';
import { RichBody, validateContent, type Content } from '../../lib/content';
import { CONTENT_TYPES, TYPE_LABELS, type ContentType } from '../../lib/types';
import { ASSIST_INPUT_LIMIT } from '../../lib/assist-limits';
import { secretWarnings, redactSecrets } from '../../lib/assist-secrets';
import { nodesToMarkdown } from '../../lib/markdown';
import { appendClipAttribution, type ClipSource } from '../../lib/clip-content';
import type { AssistMode } from '../../lib/assist-prompt';

type Result = { content: Content; warnings: string[]; metadataOnly?: boolean; source?: ClipSource };
function reviewTodos(content: Content): string[] {
  return nodesToMarkdown(content.body).split('\n').filter(line => /TODO:/i.test(line)).map(line => line.trim());
}
export function AIAssistant({ content, onApply }: { content: Content; onApply: (content: Content) => void }) {
  const [ready, setReady] = useState<boolean | null>(null);
  const [open, setOpen] = useState(false); const [text, setText] = useState('');
  const [mode, setMode] = useState<AssistMode>('format'); const [type, setType] = useState<ContentType | ''>('');
  const [clipLink, setClipLink] = useState(''); const [clipping, setClipping] = useState(false);
  const [source, setSource] = useState<ClipSource | null>(null); const [clipNotice, setClipNotice] = useState('');
  const clipRequest = useRef<AbortController | null>(null);
  const [tags, setTags] = useState(''); const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(''); const [result, setResult] = useState<Result | null>(null);
  const [consentedText, setConsentedText] = useState<string | null>(null);
  const [review, setReview] = useState<string[] | null>(null);
  const consentFingerprint = text + '\n' + tags;
  const detected = secretWarnings(consentFingerprint);
  const [before, setBefore] = useState(false); const [confirmation, setConfirmation] = useState<string | null>(null);
  const dialog = useRef<HTMLDialogElement>(null); const textarea = useRef<HTMLTextAreaElement>(null);
  const request = useRef<AbortController | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    fetch('/api/assist', { cache: 'no-store', signal: controller.signal }).then(async response => {
      if (!response.ok) throw Error('Unavailable');
      const data = await response.json() as { ready?: boolean }; return data.ready === true;
    }).then(value => { if (!controller.signal.aborted) setReady(value); }).catch(() => { if (!controller.signal.aborted) setReady(false); });
    return () => { controller.abort(); request.current?.abort(); clipRequest.current?.abort(); };
  }, []);
  useEffect(() => { if (open) { dialog.current?.showModal(); textarea.current?.focus(); } }, [open]);
  function cancel() {
    request.current?.abort(); request.current = null; setBusy(false);
    clipRequest.current?.abort(); clipRequest.current = null; setClipping(false);
    setMessage('Request cancelled. Your original text is unchanged.');
  }
  function close() { cancel(); setResult(null); setConfirmation(null); dialog.current?.close(); }
  async function clip() {
    if (busy || clipping || result || !clipLink.trim()) return;
    const controller = new AbortController(); clipRequest.current?.abort(); clipRequest.current = controller;
    setClipping(true); setMessage(''); setConsentedText(null);
    try {
      const response = await fetch('/api/clip', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: clipLink }), signal: controller.signal });
      const data = await response.json() as { text?: unknown; title?: unknown; sourceUrl?: unknown; truncated?: unknown; error?: string };
      if (controller.signal.aborted || clipRequest.current !== controller) return;
      if (!response.ok) throw Error(data.error || 'Could not clip that page.');
      if (typeof data.text !== 'string' || data.text.length > ASSIST_INPUT_LIMIT || typeof data.title !== 'string' || data.title.length > 200
        || typeof data.sourceUrl !== 'string' || data.sourceUrl.length > 2048 || typeof data.truncated !== 'boolean') throw Error('Invalid clip response.');
      const url = new URL(data.sourceUrl);
      if (url.protocol !== 'https:' || url.username || url.password) throw Error('Invalid clip source.');
      setText(data.text); setSource({ title: data.title, sourceUrl: url.href }); setMode('cheatsheet'); setType('cheatsheet');
      setClipNotice(data.truncated ? 'Truncated to fit. Code blocks that do not fit are omitted whole. Review the extracted text.' : 'Link loaded. Review the extracted text, then press Format with AI.');
      setMessage('Link loaded into this input only. Your editor draft is unchanged.');
    } catch (error) {
      if (!controller.signal.aborted && clipRequest.current === controller) setMessage(error instanceof Error ? error.message : 'Could not clip that page.');
    } finally { if (clipRequest.current === controller) { clipRequest.current = null; setClipping(false); } }
  }
  async function format(sendAnyway = false) {
    if (clipping) return;
    setMessage(''); setConfirmation(null);
    if (!text.trim() || text.length > ASSIST_INPUT_LIMIT) { setMessage('Enter between 1 and 20,000 characters.'); return; }
    if (detected.length && !sendAnyway) { setConsentedText(consentFingerprint); setMessage('This looks like it contains a secret. Redact it or confirm sending below.'); return; }
    const tagHints = tags.split(',').map(tag => tag.trim()).filter(Boolean);
    if (tagHints.length > 6 || tagHints.some(tag => tag.length > 40)) { setMessage('Use up to six tag hints, each within 40 characters.'); return; }
    request.current?.abort(); const controller = new AbortController(); request.current = controller;
    setBusy(true); setResult(null); setBefore(false);
    try {
      const response = await fetch('/api/assist', { method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: controller.signal,
        body: JSON.stringify({ text, mode, secretConsent: sendAnyway, hints: { type: mode === 'cheatsheet' ? 'cheatsheet' : type || content.type || 'post', ...(tagHints.length ? { tags: tagHints } : {}) } }) });
      const data = await response.json() as { content?: unknown; metadata?: { tags: string[]; excerpt: string }; warnings?: unknown; error?: string };
      if (controller.signal.aborted || request.current !== controller) return;
      if (!response.ok) throw Error(data.error || 'AI formatting failed. Your original text is unchanged.');
      const safe = data.metadata ? validateContent({ ...content, title: content.title.trim() || 'Untitled draft', tags: data.metadata.tags, excerpt: data.metadata.excerpt }) : validateContent(data.content);
      if (!Array.isArray(data.warnings) || data.warnings.some(warning => typeof warning !== 'string')) throw Error('Invalid draft response. Your original text is unchanged.');
      setResult({ content: safe, warnings: data.warnings, metadataOnly: !!data.metadata, source: source || undefined }); setMessage('Preview ready. Review it before applying to your draft.');
    } catch (error) {
      if (!controller.signal.aborted && request.current === controller) setMessage(error instanceof Error ? error.message : 'AI formatting failed. Your original text is unchanged.');
    } finally { if (request.current === controller) { request.current = null; setBusy(false); } }
  }
  function apply() {
    if (!result) return;
    const nonempty = !!(content.title.trim() || content.subtitle || content.body.length || content.tags.length || content.cover || content.resourceUrl || content.attachments?.length);
    const fingerprint = JSON.stringify(content);
    if (nonempty && confirmation !== fingerprint) { setConfirmation(fingerprint); setMessage('This changes your current draft. Confirm below, or discard the AI result.'); return; }
    // Preserve owner-selected files, cover and collection; AI has no authority over them.
    if (result.metadataOnly) { onApply({ ...content, tags: result.content.tags, excerpt: result.content.excerpt }); close(); return; }
    const reviewed = validateContent({ ...result.content, body: result.source ? appendClipAttribution(result.content.body, result.source) : result.content.body });
    onApply({ ...content, ...reviewed, cover: content.cover, attachments: content.attachments, series: content.series, position: content.position });
    close();
  }
  return <>
    <button type="button" className="chip" disabled={ready !== true} onClick={() => { setMessage(''); setReview(null); setOpen(true); }}>Format with AI</button>
    <button type="button" className="chip" onClick={() => setReview(reviewTodos(content))}>Review TODOs</button>
    {review !== null && <section aria-label="TODO review"><h3>TODO review</h3>{review.length ? <ul>{review.map((item, i) => <li key={i}>{item}</li>)}</ul> : <p>No TODO: placeholders in this draft.</p>}<button type="button" onClick={() => setReview(null)}>Close review</button></section>}
    {ready !== true && <small>{ready === null ? 'Checking AI configuration…' : 'AI formatting is off. Configure OPENAI_API_KEY and AI_MODEL on the server, then reload.'}</small>}
    <dialog ref={dialog} className="ai-dialog" aria-labelledby="ai-assistant-title" onCancel={cancel} onClose={() => { setOpen(false); setResult(null); setConfirmation(null); }}>
      <div className="dialoghead"><h2 id="ai-assistant-title">Format with AI</h2><button type="button" onClick={close} aria-label="Close AI assistant">Close</button></div>
      <button type="button" className="chip" disabled={busy || clipping || !!result} onClick={() => { setText(nodesToMarkdown(content.body)); setSource(null); setClipNotice(''); setConsentedText(null); }}>Use current draft text</button>
      <section className="cliptools" aria-label="Load text from a link">
        <label>From link<input type="url" maxLength={2048} placeholder="https://…" value={clipLink} disabled={busy || clipping || !!result}
          onChange={event => setClipLink(event.target.value)} onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); clip(); } }}/></label>
        <button type="button" className="chip" disabled={busy || clipping || !!result || !clipLink.trim()} onClick={clip}>Load link</button>
        <small>Public web pages, GitHub files, repositories and gists. Loading a link does not send it to AI.</small>
      </section>
      {source && <div className="clipsource"><p>Source: <a href={source.sourceUrl} target="_blank" rel="noopener noreferrer">{source.title || source.sourceUrl}</a></p><p>{clipNotice}</p><small>Attribution is added when you apply a full draft. Review third-party material before publishing.</small></div>}
      <p>Your text is sent to the AI provider you configured.</p>
      <p>Review every command and claim. Applying creates a draft change; publishing remains your choice.</p>
      <form onSubmit={event => { event.preventDefault(); format(); }}>
        <label>Original text<textarea ref={textarea} rows={10} value={text} readOnly={busy || clipping || !!result} onChange={event => { setText(event.target.value); setConsentedText(null); }} aria-describedby="ai-input-count"/></label>
        <small id="ai-input-count">{text.length.toLocaleString()} / 20,000 characters</small>
        <div className="formrow"><label>Mode<select value={mode} disabled={busy || clipping || !!result} onChange={event => setMode(event.target.value as AssistMode)}><option value="format">Format</option><option value="polish">Polish</option><option value="outline">Outline</option><option value="metadata">Suggest tags and excerpt</option><option value="cheatsheet">Rough notes to cheat sheet</option></select></label>
          <label>Optional type hint<select value={type} disabled={busy || clipping || !!result} onChange={event => setType(event.target.value as ContentType | '')}><option value="">Use current editor type</option>{CONTENT_TYPES.map(value => <option value={value} key={value}>{TYPE_LABELS[value].singular}</option>)}</select></label></div>
        <label>Optional tag hints (comma separated)<input value={tags} disabled={busy || clipping || !!result} onChange={event => setTags(event.target.value)} maxLength={250}/></label>
        {!busy && !clipping && !result && detected.length > 0 && <div className="errorbox" role="alert"><p>Possible sensitive content: {detected.join(', ')}. Detection is approximate; review before sending.</p><button type="button" onClick={() => { setText(redactSecrets(text)); setTags(redactSecrets(tags)); setConsentedText(null); setMessage('Possible secrets redacted in this input only. Review it before sending.'); }}>Redact detected values</button>{consentedText === consentFingerprint && <button type="button" onClick={() => format(true)}>Send this text anyway</button>}</div>}
        <div role="status" aria-live="polite">{clipping ? 'Loading readable text… You can cancel at any time.' : busy ? 'Formatting your text… You can cancel at any time.' : message}</div>
        {!result && <div className="dialogfoot"><button type="submit" className="primary" disabled={busy || clipping || !text.trim() || text.length > ASSIST_INPUT_LIMIT}>Format with AI</button>{(busy || clipping) && <button type="button" onClick={cancel}>Cancel request</button>}</div>}
      </form>
      {result && <section className="ai-preview" aria-label="AI draft preview">
        {result.warnings.length > 0 && <div className="errorbox" role="alert"><strong>Review changed code before applying</strong><ul>{result.warnings.map(warning => <li key={warning}>{warning}</li>)}</ul></div>}
        <div className="chips" role="group" aria-label="Compare original and formatted text"><button type="button" className="chip" aria-pressed={before} onClick={() => setBefore(true)}>Before</button><button type="button" className="chip" aria-pressed={!before} onClick={() => setBefore(false)}>After</button></div>
        {before ? <pre className="ai-original">{text}</pre> : <div><h3>{result.metadataOnly ? 'Suggested tags and excerpt' : result.content.title}</h3>{!result.metadataOnly && <p>{result.content.subtitle}</p>}<p>{result.content.excerpt}</p><small>{result.metadataOnly ? 'Tags: ' : result.content.type + ' · ' + result.content.difficulty + ' · '}{result.content.tags.join(', ')}</small>{!result.metadataOnly && <div className="prose"><RichBody nodes={result.source ? appendClipAttribution(result.content.body, result.source) : result.content.body}/></div>}</div>}
        {confirmation !== null && <p className="errorbox">Apply these changes to your draft? Your cover, attachments and collection will be kept.</p>}
        <div className="dialogfoot"><button type="button" onClick={() => { setResult(null); setConfirmation(null); setMessage('AI result discarded. Your original text is unchanged.'); }}>Discard</button><button type="button" className="primary" onClick={apply}>{confirmation === null ? 'Apply to draft' : 'Confirm replacement'}</button></div>
      </section>}
    </dialog>
  </>;
}
