'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { cleanPages, detectChapters, chapterFromRange, pageCoverage, pageRanges } from '../../lib/book/chapters';
import { BOOK_MAX_BYTES, BOOK_MAX_CHAPTERS, type BookPDF, type BookChapter } from '../../lib/book/types';
import BookJobPanel from './book-job-panel';
export default function BookNotes() {
    const [pdf, setPDF] = useState<BookPDF | null>(null), [chapters, setChapters] = useState<BookChapter[]>([]);
    const [title, setTitle] = useState(''), [author, setAuthor] = useState(''), [sourceUrl, setSourceUrl] = useState(''), [link, setLink] = useState('');
    const [excluded, setExcluded] = useState<number[]>([]), [reading, setReading] = useState(false), [running, setRunning] = useState(false);
    const [error, setError] = useState(''), [message, setMessage] = useState(''), [hashedPlan, setHashedPlan] = useState({ plan: '', hash: '' });
    const controller = useRef<AbortController | null>(null);
    useEffect(() => () => controller.current?.abort(), []);
    const selected = useMemo(() => chapters.filter(c => c.included), [chapters]);
    const excludedPages = useMemo(() => [...new Set([...excluded, ...chapters.filter(c => !c.included).flatMap(c => Array.from({ length: c.endPage - c.startPage + 1 }, (_, i) => c.startPage + i))])], [excluded, chapters]);
    const coverage = pdf ? pageCoverage(pdf.pages.length, chapters, excludedPages) : null;
    const plan = pdf ? JSON.stringify({ document: pdf.fingerprint, chapters: chapters.map(c => [c.title, c.startPage, c.endPage, c.included]), excluded: excludedPages, title, author, sourceUrl }) : '';
    const planHash = hashedPlan.plan === plan ? hashedPlan.hash : '';
    useEffect(() => {
        let live = true;
        if (!plan)
            return;
        void crypto.subtle.digest('SHA-256', new TextEncoder().encode(plan)).then(hash => { if (live)
            setHashedPlan({ plan, hash: [...new Uint8Array(hash)].map(v => v.toString(16).padStart(2, '0')).join('') }); });
        return () => { live = false; };
    }, [plan]);
    async function load(file: File, signal: AbortSignal) {
        const { readBookPDF } = await import('../../lib/book/pdf-client');
        const result = await readBookPDF(file, (page, total) => setMessage('Reading page ' + page + ' of ' + total + '…'), signal);
        const pages = cleanPages(result.pages);
        if (!pages.some(p => p.text.trim().length > 0))
            throw Error('No extractable text; OCR is not supported.');
        const clean = { ...result, pages };
        setPDF(clean);
        setChapters(detectChapters(pages, result.outline));
        setExcluded([]);
        setMessage('PDF text is ready. Review chapter ranges and page coverage before starting.');
    }
    async function importPDF(file?: File) {
        if (reading || running)
            return;
        const request = new AbortController();
        controller.current = request;
        setReading(true);
        setError('');
        try {
            let selectedFile = file;
            if (!selectedFile) {
                const response = await fetch('/api/book/fetch', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url: link }), signal: request.signal });
                if (!response.ok) {
                    const value = await response.json() as {
                        error?: string;
                    };
                    throw Error(value.error || 'Could not import the PDF link. Download then upload it.');
                }
                const reader = response.body?.getReader();
                if (!reader)
                    throw Error('The PDF download was empty.');
                const parts: Uint8Array<ArrayBuffer>[] = [];
                let size = 0;
                try {
                    while (true) {
                        const { value, done } = await reader.read();
                        if (done)
                            break;
                        size += value.length;
                        if (size > BOOK_MAX_BYTES)
                            throw Error('Choose a PDF under 60 MB.');
                        parts.push(new Uint8Array(value));
                        setMessage('Downloading ' + Math.ceil(size / 1024 / 1024) + ' MB…');
                    }
                }
                finally {
                    await reader.cancel().catch(() => { });
                    reader.releaseLock();
                }
                selectedFile = new File(parts, 'book.pdf', { type: 'application/pdf' });
            }
            await load(selectedFile, request.signal);
        }
        catch (e) {
            setError(request.signal.aborted ? 'PDF reading cancelled.' : e instanceof Error ? e.message : 'Could not read this PDF. Download then upload it.');
        }
        finally {
            setReading(false);
        }
    }
    function change(index: number, patch: Partial<BookChapter>) {
        if (!pdf || running)
            return;
        try {
            const old = chapters[index];
            const next = { ...old, ...patch };
            const chapter = chapterFromRange(pdf.pages, pdf.outline, old.id, next.title, next.startPage, next.endPage, next.included);
            setChapters(list => list.map((c, i) => i === index ? chapter : c));
            setError('');
        }
        catch (e) {
            setError(e instanceof Error ? e.message : 'Choose a valid chapter range.');
        }
    }
    let sourceValid = true;
    if (sourceUrl) {
        try {
            const url = new URL(sourceUrl);
            sourceValid = url.protocol === 'https:' && !url.username && !url.password;
        }
        catch {
            sourceValid = false;
        }
    }
    return <div className="content booknotes"><p className="eyebrow">PRIVATE STUDIO</p><h1>Book notes</h1><p>Read a PDF locally, confirm its chapters, and generate notes and reference sheets as unpublished drafts.</p>
    <section><label>Upload a PDF (up to 60 MB / 1,000 pages)<input type="file" accept=".pdf,application/pdf" disabled={reading || running} onChange={e => { if (e.target.files?.[0])
        void importPDF(e.target.files[0]); }}/></label><label>Import from a PDF URL<input type="url" maxLength={2048} placeholder="https://example.org/book.pdf" value={link} disabled={reading || running} onChange={e => setLink(e.target.value)}/></label><button disabled={reading || running || !link.trim()} onClick={() => { void importPDF(); }}>Import PDF link</button>{reading && <button onClick={() => controller.current?.abort()}>Cancel reading</button>}<small>Uploaded PDFs stay in this browser. Link imports stream through the server without storage. Text extraction has no OCR.</small></section>
    <p role="status" aria-live="polite">{message}</p>{error && <p role="alert" className="errorbox">{error}</p>}
    {pdf && <><section><h2>Book details (optional)</h2><label>Book title<input maxLength={93} disabled={running} value={title} onChange={e => setTitle(e.target.value)}/></label><label>Author<input maxLength={200} disabled={running} value={author} onChange={e => setAuthor(e.target.value)}/></label><label>Source URL<input type="url" maxLength={2048} disabled={running} value={sourceUrl} onChange={e => setSourceUrl(e.target.value)}/></label>{!sourceValid && <p role="alert">Use an HTTPS source URL without credentials, or leave it blank.</p>}<p>Collection: Notes: {title || 'Book'}</p></section>
      <section><h2>Confirm chapters</h2><p>{pdf.pages.length} pages · {pdf.pages.reduce((n, p) => n + p.text.length, 0).toLocaleString()} extracted characters · {chapters.length}/{BOOK_MAX_CHAPTERS} chapter ranges</p>{pdf.outline.filter(o => o.level === 1).length > 40 && <p>Outline entries were grouped into review ranges to fit 40 chapters; every page remains accounted for.</p>}
      <div className="bookcoverage"><progress max={pdf.pages.length} value={coverage?.covered || 0}/><span>Page coverage: {coverage?.covered}/{pdf.pages.length}</span></div>{coverage && <><p>Unassigned pages: {pageRanges(coverage.unassigned) || 'none'}. Conflicting pages: {pageRanges(coverage.conflicts) || 'none'}.</p>{coverage.unassigned.length > 0 && <button disabled={running} onClick={() => setExcluded(old => [...new Set([...old, ...coverage.unassigned])])}>Explicitly exclude these unassigned pages</button>}</>}
      {excluded.length > 0 && <p>Explicit exclusions: {pageRanges(excluded)}. <button disabled={running} onClick={() => setExcluded([])}>Clear explicit exclusions</button></p>}
      <ol className="bookchapters">{chapters.map((chapter, index) => <li key={chapter.id}><label><input type="checkbox" disabled={running} checked={chapter.included} onChange={e => change(index, { included: e.target.checked })}/>{chapter.included ? 'Include' : 'Explicitly exclude'} chapter {index + 1}</label><label>Chapter title<input maxLength={200} value={chapter.title} disabled={running} onChange={e => change(index, { title: e.target.value })}/></label><div className="formrow"><label>Start page<input type="number" min={1} max={pdf.pages.length} disabled={running} value={chapter.startPage} onChange={e => change(index, { startPage: Number(e.target.value) })}/></label><label>End page<input type="number" min={chapter.startPage} max={pdf.pages.length} disabled={running} value={chapter.endPage} onChange={e => change(index, { endPage: Number(e.target.value) })}/></label></div><p>{chapter.chars.toLocaleString()} characters{chapter.chars > 60000 ? ' · large chapter: all text will be chunked' : ''}</p><details><summary>Required section checklist ({chapter.sections.length})</summary><ul>{chapter.sections.map((s, i) => <li key={i}>{s}</li>)}</ul></details><details><summary>Extracted chapter text</summary><pre>{chapter.text}</pre></details><button disabled={running} onClick={() => setChapters(list => list.filter((_, i) => i !== index))}>Remove range</button></li>)}</ol>
      <button disabled={running || chapters.length >= 40} onClick={() => { const start = coverage?.unassigned[0] || 1; setChapters(list => [...list, chapterFromRange(pdf.pages, pdf.outline, crypto.randomUUID(), 'Chapter ' + (list.length + 1), start, start)]); }}>Add chapter range</button></section>
      {coverage?.complete && selected.length > 0 && sourceValid && planHash && <BookJobPanel key={planHash} planHash={planHash} chapters={selected} title={title} author={author} sourceUrl={sourceUrl} onBusy={setRunning}/>}<p>Refresh recovery stores progress and draft IDs only, never PDF/chapter text. Reselect the same PDF and confirm the same plan to resume.</p>
    </>}
  </div>;
}
