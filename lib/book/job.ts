import type { Content } from '../content';
import { plainText, validateContent } from '../content';
import { nodesToMarkdown } from '../markdown';
import { chapterChunks, summaryGroups } from './chunks';
import { missingSections, bookCodeWarnings, hasCopiedRun } from './similarity';
import type { BookChapter, BookContext, BookDraft, ChapterState } from './types';
export type BookAI = (mode: 'book_chunk' | 'book_chapter', text: string, context: BookContext, signal: AbortSignal) => Promise<{
    content?: Content;
    items?: BookDraft[];
}>;
export type ChapterResult = {
    items: BookDraft[];
    gaps: string[];
    chunksTotal: number;
    chunksDone: number;
};
export const initialChapterState = (): ChapterState => ({ status: 'queued', chunksTotal: 0, chunksDone: 0, sectionsTotal: 0, sectionsCovered: 0, gaps: [], draftIds: [], warnings: [] });
function repairSource(chapter: BookChapter, missing: string[]) {
    if (chapter.text.length <= 14000)
        return chapter.text;
    const excerpts: string[] = [];
    for (const title of missing) {
        const position = chapter.text.toLowerCase().indexOf(title.toLowerCase());
        if (position >= 0)
            excerpts.push(chapter.text.slice(Math.max(0, position - 200), position + 1800));
    }
    const groups = summaryGroups(excerpts, 14000);
    if (groups.length > 1)
        throw Error('Missed sections need multiple source windows. Select a smaller chapter range and regenerate; no source was truncated.');
    if (!groups.length)
        throw Error('Could not locate these sections in the extracted source. Select a smaller chapter range and regenerate.');
    return groups[0].join('\n\n');
}
export function mergeBookDrafts(base: BookDraft[], addition: BookDraft[]): BookDraft[] {
    return base.map(item => {
        const extra = addition.find(x => x.content.type === item.content.type);
        return extra ? { ...item, content: validateContent({ ...item.content, body: [...item.content.body, { tag: 'h2', children: [{ text: 'Additional sections' }] }, ...extra.content.body] }), warnings: [...item.warnings, ...extra.warnings], longVerbatim: item.longVerbatim || extra.longVerbatim } : item;
    }).concat(addition.filter(item => !base.some(x => x.content.type === item.content.type)));
}
export async function addMissedSections(chapter: BookChapter, context: BookContext, items: BookDraft[], ai: BookAI, signal: AbortSignal) {
    const gaps = missingSections(chapter.sections, plainText(items[0].content.body));
    if (!gaps.length)
        return items;
    const repaired = await ai('book_chapter', repairSource(chapter, gaps), { ...context, sections: gaps }, signal);
    if (!repaired.items?.length)
        throw Error('Missing-section response was invalid.');
    return mergeBookDrafts(items, repaired.items);
}
export async function generateChapter(chapter: BookChapter, context: BookContext, ai: BookAI, signal: AbortSignal, progress: (done: number, total: number) => void, checkpoint = () => { }): Promise<ChapterResult> {
    const size = Math.min(15000, 19500 - JSON.stringify(context).length);
    if (size < 1000)
        throw Error('This section checklist is too large for one request. Split the reviewed chapter range; nothing was omitted.');
    const chunks = chapterChunks(chapter.text, size);
    const summaries: string[] = [];
    progress(0, chunks.length);
    if (chunks.length > 1) {
        for (const chunk of chunks) {
            checkpoint();
            signal.throwIfAborted();
            const data = await ai('book_chunk', chunk, context, signal);
            if (!data.content)
                throw Error('A chunk summary was missing.');
            const summary = nodesToMarkdown(validateContent(data.content).body);
            if (summary.length > 14000)
                throw Error('A chunk summary exceeded the merge limit. Retry this chapter.');
            summaries.push(summary);
            progress(summaries.length, chunks.length);
        }
    }
    let sources = summaries.length ? summaries : chunks;
    // Hierarchical aggregation includes every summary; no slice/truncation is permitted.
    for (let level = 0; sources.join('\n\n').length > size; level++) {
        if (level >= 12)
            throw Error('Summaries did not become small enough to merge. Retry this chapter.');
        const groups = summaryGroups(sources, size);
        const merged: string[] = [];
        for (const group of groups) {
            checkpoint();
            signal.throwIfAborted();
            const data = await ai('book_chunk', group.join('\n\n'), context, signal);
            if (!data.content)
                throw Error('A merge summary was missing.');
            merged.push(nodesToMarkdown(data.content.body));
        }
        if (merged.join('\n\n').length >= sources.join('\n\n').length)
            throw Error('Summary merge did not shrink; retry instead of dropping source.');
        sources = merged;
    }
    checkpoint();
    const result = await ai('book_chapter', sources.join('\n\n'), context, signal);
    if (!result.items?.length || result.items.length > 2)
        throw Error('Invalid chapter drafts.');
    if (chunks.length === 1)
        progress(1, 1);
    let items = result.items;
    if (missingSections(chapter.sections, plainText(items[0].content.body)).length) {
        checkpoint();
        try {
            items = await addMissedSections(chapter, context, items, ai, signal);
        }
        catch (error) {
            if (signal.aborted)
                throw error; /* Preserve the note and explicitly report unresolved gaps. */
        }
    }
    items = items.map(item => ({ ...item, content: validateContent(item.content), warnings: bookCodeWarnings(chapter.text, item.content.body), longVerbatim: hasCopiedRun(chapter.text, plainText(item.content.body)) }));
    return { items, gaps: missingSections(chapter.sections, plainText(items[0].content.body)), chunksTotal: chunks.length, chunksDone: chunks.length };
}
export type SavedBookJob = {
    version: 1;
    planHash: string;
    collectionId: string;
    chapters: Pick<ChapterState, 'status' | 'chunksTotal' | 'chunksDone' | 'draftIds' | 'sectionsTotal' | 'sectionsCovered'>[];
};
export function readBookJob(hash: string): SavedBookJob | null {
    try {
        const raw = localStorage.getItem('commonplace.book.' + hash);
        if (!raw || raw.length > 40000)
            return null;
        const data = JSON.parse(raw) as SavedBookJob;
        if (data.version !== 1 || data.planHash !== hash || typeof data.collectionId !== 'string' || !Array.isArray(data.chapters) || data.chapters.length > 40)
            return null;
        for (const c of data.chapters)
            if (!['queued', 'running', 'done', 'failed', 'skipped'].includes(c.status) || !Array.isArray(c.draftIds) || c.draftIds.length > 2 || c.draftIds.some(id => typeof id !== 'string' || !/^[a-z0-9-]{1,100}$/i.test(id))
                || [c.chunksTotal, c.chunksDone, c.sectionsTotal, c.sectionsCovered].some(n => !Number.isSafeInteger(n) || n < 0))
                return null;
        return data;
    }
    catch {
        return null;
    }
}
export function saveBookJob(job: SavedBookJob): boolean {
    try {
        const clean: SavedBookJob = { version: 1, planHash: job.planHash, collectionId: job.collectionId, chapters: job.chapters.map(c => ({ status: c.status, chunksTotal: c.chunksTotal, chunksDone: c.chunksDone, draftIds: c.draftIds, sectionsTotal: c.sectionsTotal, sectionsCovered: c.sectionsCovered })) };
        localStorage.setItem('commonplace.book.' + job.planHash, JSON.stringify(clean));
        return true;
    }
    catch {
        return false;
    }
}
