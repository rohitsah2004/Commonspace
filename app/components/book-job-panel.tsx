'use client';
import { useEffect, useRef, useState } from 'react';
import { bookAI, bookJSON, saveBookDraft, BookAPIError } from '../../lib/book/api-client';
import { generateChapter, initialChapterState, addMissedSections, readBookJob, saveBookJob } from '../../lib/book/job';
import { chapterChunks } from '../../lib/book/chunks';
import { secretWarnings, redactSecrets } from '../../lib/assist-secrets';
import { missingSections, bookCodeWarnings, hasCopiedRun } from '../../lib/book/similarity';
import { plainText, type Content } from '../../lib/content';
import type { BookChapter, ChapterState, BookDraft } from '../../lib/book/types';
type Props = {
    planHash: string;
    chapters: BookChapter[];
    title: string;
    author: string;
    sourceUrl: string;
    onBusy: (busy: boolean) => void;
};
class Paused extends Error {
}
export default function BookJobPanel({ planHash, chapters, title, author, sourceUrl, onBusy }: Props) {
    const [states, setStates] = useState<ChapterState[]>(() => chapters.map(c => ({ ...initialChapterState(), sectionsTotal: c.sections.length })));
    const current = useRef(states), collection = useRef('');
    const control = useRef({ running: false, pause: false, controller: new AbortController() });
    const [running, setRunning] = useState(false), [message, setMessage] = useState(''), [error, setError] = useState('');
    const [consent, setConsent] = useState(false), [redact, setRedact] = useState(false), [restored, setRestored] = useState(false);
    const secrets = [...new Set(chapters.flatMap(c => secretWarnings(c.text + '\n' + JSON.stringify(c.sections) + '\n' + title + c.title)))];
    useEffect(() => {
        let live = true;
        const saved = readBookJob(planHash);
        if (saved?.chapters.length === chapters.length) {
            collection.current = saved.collectionId;
            const next = saved.chapters.map((s, i) => ({ ...initialChapterState(), ...s, status: s.status === 'running' ? 'queued' as const : s.status, sectionsTotal: chapters[i].sections.length }));
            current.current = next;
            Promise.resolve().then(() => { if (live) {
                setStates(next);
                setRestored(true);
            } });
        }
        return () => { live = false; control.current.controller.abort(); };
    }, [planHash, chapters]);
    function persist() {
        if (!saveBookJob({ version: 1, planHash, collectionId: collection.current, chapters: current.current }))
            setMessage('Browser storage is unavailable. Keep this tab open; refresh recovery is unavailable.');
    }
    function update(index: number, patch: Partial<ChapterState>) {
        current.current = current.current.map((state, i) => i === index ? { ...state, ...patch } : state);
        setStates(current.current);
        persist();
    }
    function checkpoint() { if (control.current.pause)
        throw new Paused(); control.current.controller.signal.throwIfAborted(); }
    async function run(indices?: number[], repairOnly = false) {
        if (control.current.running)
            return;
        if (!navigator.locks)
            return executeRun(indices, repairOnly);
        await navigator.locks.request('commonplace.book.' + planHash, { ifAvailable: true }, async (lock) => {
            if (!lock) {
                setError('This job is already running in another tab. Pause or finish it there first.');
                return;
            }
            // A second tab may have mounted before another tab completed this job.
            const saved = readBookJob(planHash);
            if (saved?.chapters.length === chapters.length) {
                collection.current = saved.collectionId;
                current.current = saved.chapters.map((state, index) => ({
                    ...initialChapterState(), ...state,
                    status: state.status === 'running' ? 'queued' : state.status,
                    sectionsTotal: chapters[index].sections.length,
                }));
                setStates(current.current);
                setRestored(true);
            }
            await executeRun(indices, repairOnly);
        }).catch(() => setError('The job could not start. Keep this tab open and try again.'));
    }
    async function executeRun(indices?: number[], repairOnly = false) {
        if (control.current.running)
            return;
        if (secrets.length && !consent && !redact) {
            setError('Choose redaction or confirm sending the detected sensitive text.');
            return;
        }
        control.current = { running: true, pause: false, controller: new AbortController() };
        setRunning(true);
        onBusy(true);
        setError('');
        setMessage('');
        const signal = control.current.controller.signal;
        const ai = bookAI(consent || redact);
        try {
            const ready = await bookJSON<{
                ready: boolean;
            }>('/api/assist');
            if (!ready.ready)
                throw new BookAPIError('AI is not configured. Configure the server key and model, then resume.', 503);
            if (!collection.current) {
                const created = await bookJSON<{
                    id: string;
                }>('/api/manage', 'POST', { action: 'collection', name: 'Notes: ' + (title || 'Book'), description: 'Chapter notes and reference sheets.' }, signal);
                collection.current = created.id;
                persist();
            }
            for (let index = 0; index < chapters.length; index++) {
                if (indices ? !indices.includes(index) : current.current[index].status === 'done')
                    continue;
                checkpoint();
                const original = chapters[index];
                const chapter = redact ? { ...original, text: redactSecrets(original.text), sections: original.sections.map(redactSecrets) } : original;
                const context = { title: redact ? redactSecrets(title) : title, chapterTitle: redact ? redactSecrets(chapter.title) : chapter.title, chapterNumber: index + 1, sections: chapter.sections };
                update(index, { status: 'running', error: undefined, chunksDone: 0 });
                try {
                    let items: BookDraft[], gaps: string[];
                    if (repairOnly) {
                        const { posts } = await bookJSON<{
                            posts: {
                                id: string;
                                draft: Content;
                            }[];
                        }>('/api/posts?studio=1', 'GET', undefined, signal);
                        const existing = current.current[index].draftIds.map(id => posts.find(p => p.id === id)?.draft);
                        if (!existing[0])
                            throw Error('The chapter note is unavailable. Regenerate the chapter instead.');
                        const base = existing.filter((c): c is Content => !!c).map(content => ({ content, warnings: [], longVerbatim: false }));
                        items = await addMissedSections(chapter, context, base, ai, signal);
                        gaps = missingSections(chapter.sections, plainText(items[0].content.body));
                    }
                    else {
                        const result = await generateChapter(chapter, context, ai, signal, (done, total) => update(index, { chunksDone: done, chunksTotal: total }), checkpoint);
                        items = result.items;
                        gaps = result.gaps;
                    }
                    const ids = [...current.current[index].draftIds];
                    const warnings: string[] = [];
                    for (let itemIndex = 0; itemIndex < items.length; itemIndex++) {
                        checkpoint();
                        const item = items[itemIndex];
                        item.warnings = bookCodeWarnings(chapter.text, item.content.body);
                        item.longVerbatim = hasCopiedRun(chapter.text, plainText(item.content.body));
                        const id = await saveBookDraft(item, collection.current, index, title, { ...(title ? { sourceTitle: title } : {}), ...(author ? { sourceAuthor: author } : {}), ...(sourceUrl ? { sourceUrl } : {}) }, ids[itemIndex], signal);
                        ids[itemIndex] = id;
                        warnings.push(...item.warnings);
                        if (item.longVerbatim)
                            warnings.push('Long verbatim passage');
                        update(index, { draftIds: [...ids] });
                    }
                    if (ids.length > items.length)
                        warnings.push('An earlier cheat sheet draft was kept. Review it alongside the regenerated note.');
                    update(index, { status: 'done', gaps, sectionsCovered: chapter.sections.length - gaps.length, warnings });
                }
                catch (e) {
                    if (e instanceof Paused) {
                        update(index, { status: 'queued' });
                        throw e;
                    }
                    const text = signal.aborted ? 'Cancelled. Resume to retry this chapter.' : e instanceof Error ? e.message : 'Chapter generation failed.';
                    update(index, { status: 'failed', error: text });
                    if (signal.aborted || e instanceof BookAPIError && [429, 503, 409].includes(e.status))
                        throw e;
                }
                await new Promise<void>(resolve => setTimeout(resolve, 300));
            }
            // Recompute reports for completed chapters recovered from IDs-only browser state.
            const { posts } = await bookJSON<{
                posts: {
                    id: string;
                    draft: Content;
                }[];
            }>('/api/posts?studio=1');
            current.current.forEach((state, i) => {
                if (state.status !== 'done')
                    return;
                const note = posts.find(p => p.id === state.draftIds[0])?.draft;
                if (note) {
                    const gaps = missingSections(redact ? chapters[i].sections.map(redactSecrets) : chapters[i].sections, plainText(note.body));
                    update(i, { gaps, sectionsCovered: chapters[i].sections.length - gaps.length });
                }
            });
            setMessage('Generation finished. Review the coverage report and each draft. Nothing was published.');
        }
        catch (e) {
            setMessage(e instanceof Paused ? 'Paused between requests. Resume restarts an interrupted chapter; completed drafts are kept.' : signal.aborted ? 'Cancelled. Completed drafts are kept; resume when ready.' : e instanceof Error ? e.message : 'The job stopped. Resume when ready.');
        }
        finally {
            control.current.running = false;
            setRunning(false);
            onBusy(false);
        }
    }
    const calls = chapters.reduce((total, c) => { const n = chapterChunks(c.text).length; return total + (n > 1 ? n + 1 : 1); }, 0);
    return <section className="bookjob"><h2>Generate chapter drafts</h2><p>Estimated minimum: {calls} API calls, plus any summary-merge or coverage followups. About {Math.ceil(chapters.reduce((n, c) => n + c.chars, 0) / 4).toLocaleString()} source tokens. Daily limit: 150 generation calls.</p>
    {restored && <p>Previous progress found. Completed drafts will be reused. Interrupted chapters restart from the PDF text you reselected.</p>}
    {!!secrets.length && <div className="booksecrets"><p>Possible sensitive values: {secrets.join(', ')}.</p><label><input type="checkbox" checked={redact} disabled={running} onChange={e => { setRedact(e.target.checked); setConsent(false); }}/>Redact detected values before sending</label><label><input type="checkbox" checked={consent} disabled={running || redact} onChange={e => setConsent(e.target.checked)}/>Send detected sensitive text to the configured AI provider</label></div>}
    <div className="chips"><button className="primary" disabled={running} onClick={() => { void run(); }}>{restored || states.some(s => s.draftIds.length) ? 'Resume job' : 'Start'}</button><button disabled={!running} onClick={() => { control.current.pause = true; }}>Pause after this request</button><button disabled={!running} onClick={() => { control.current.controller.abort(); }}>Cancel</button></div>
    <p role="status" aria-live="polite">{message}</p>{error && <p role="alert">{error}</p>}
    <h3>Coverage report</h3><ol>{states.map((state, index) => <li key={chapters[index].id}><h4>{chapters[index].title}</h4><p>{state.status} · chunks {state.chunksDone}/{state.chunksTotal} · {state.sectionsCovered} of {state.sectionsTotal} sections covered</p>{state.error && <p>{state.error}</p>}{state.gaps.length > 0 && <p>Gaps: {state.gaps.join('; ')}</p>}{state.warnings.map((w, i) => <small key={i} className="booknotice">{w}</small>)}<div className="chips">{state.draftIds.map((id, i) => <a key={id} href={'/studio?draft=' + encodeURIComponent(id)}>Open {i ? 'cheat sheet' : 'note'} draft</a>)}<button disabled={running} onClick={() => { void run([index]); }}>{state.status === 'failed' ? 'Retry failed chapter' : 'Regenerate this chapter'}</button>{state.draftIds.length > 0 && <button disabled={running} onClick={() => { void run([index], true); }}>Add missed sections</button>}</div></li>)}</ol>
  </section>;
}
