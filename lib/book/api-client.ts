import { validateContent, type Content } from '../content';
import { slugify } from '../slug';
import type { BookAI } from './job';
import type { BookDraft } from './types';
export class BookAPIError extends Error {
    constructor(message: string, public status: number) { super(message); }
}
export async function bookJSON<T>(url: string, method = 'GET', data?: unknown, signal?: AbortSignal): Promise<T> {
    const response = await fetch(url, { method, cache: 'no-store', signal, ...(data ? { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) } : {}) });
    const value = await response.json() as {
        error?: string;
    };
    if (!response.ok)
        throw new BookAPIError(value.error || 'The request failed. Retry when ready.', response.status);
    return value as T;
}
export function bookAI(consent: boolean): BookAI {
    return async (mode, text, book, signal) => {
        const data = await bookJSON<{
            content?: unknown;
            items?: BookDraft[];
        }>('/api/assist', 'POST', { text, mode, book, secretConsent: consent }, signal);
        if (mode === 'book_chunk')
            return { content: validateContent(data.content) };
        if (!Array.isArray(data.items) || !data.items.length || data.items.length > 2)
            throw Error('Invalid chapter response.');
        return { items: data.items.map(item => {
                if (!Array.isArray(item.warnings) || item.warnings.some(w => typeof w !== 'string') || typeof item.longVerbatim !== 'boolean')
                    throw Error('Invalid chapter notices.');
                return { ...item, content: validateContent(item.content) };
            }) };
    };
}
type Post = {
    id: string;
    version: number;
    draft: Content;
    deleted_at?: number | null;
};
export async function saveBookDraft(item: BookDraft, collectionId: string, index: number, bookTitle: string, source: {
    sourceTitle?: string;
    sourceAuthor?: string;
    sourceUrl?: string;
}, existingId?: string, signal?: AbortSignal) {
    const position = index * 2 + (item.content.type === 'cheatsheet' ? 1 : 0);
    const tag = slugify(bookTitle || 'book-notes').slice(0, 40) || 'book-notes', chapterTag = 'chapter-' + (index + 1);
    const content = validateContent({ ...item.content, ...source, type: item.content.type === 'cheatsheet' ? 'cheatsheet' : 'note',
        tags: [...new Set([tag, chapterTag, ...item.content.tags])].slice(0, 8), series: collectionId, position,
        longVerbatim: item.longVerbatim, bookCodeWarning: item.warnings.length > 0 });
    const { posts } = await bookJSON<{
        posts: Post[];
    }>('/api/posts?studio=1', 'GET', undefined, signal);
    // Recover a draft if a create succeeded but its response/storage write was interrupted.
    const old = posts.find(p => !p.deleted_at && (existingId ? p.id === existingId : p.draft.series === collectionId && p.draft.position === position && p.draft.type === content.type && p.draft.tags.includes(chapterTag)));
    if (existingId && !old)
        throw Error('A previously created draft is no longer available. Review it before retrying.');
    if (old) {
        await bookJSON('/api/posts/' + old.id, 'POST', { action: 'save', version: old.version, content }, signal);
        return old.id;
    }
    const created = await bookJSON<{
        id: string;
    }>('/api/posts', 'POST', content, signal);
    return created.id;
}
