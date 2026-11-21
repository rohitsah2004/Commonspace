import type { BookContext } from './types';
export const isBookMode = (mode: string) => mode === 'book_chunk' || mode === 'book_chapter';
export function validateBookContext(value: unknown): BookContext {
    if (!value || typeof value !== 'object' || Array.isArray(value))
        throw Error('Provide chapter metadata.');
    const v = value as Record<string, unknown>;
    if (Object.keys(v).some(k => !['title', 'chapterTitle', 'chapterNumber', 'sections'].includes(k))
        || typeof v.title !== 'string' || v.title.length > 200 || typeof v.chapterTitle !== 'string' || !v.chapterTitle.trim() || v.chapterTitle.length > 200
        || !Number.isInteger(v.chapterNumber) || Number(v.chapterNumber) < 1 || Number(v.chapterNumber) > 40
        || !Array.isArray(v.sections) || v.sections.some(s => typeof s !== 'string' || s.length > 200))
        throw Error('Invalid chapter metadata.');
    return v as BookContext;
}
