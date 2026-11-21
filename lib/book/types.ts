import type { Content } from '../content';
export const BOOK_MAX_BYTES = 60 * 1024 * 1024;
export const BOOK_MAX_PAGES = 1000;
export const BOOK_MAX_CHAPTERS = 40;
export const BOOK_CHUNK_SIZE = 15000;
export type BookLine = {
    text: string;
    size: number;
};
export type BookPage = {
    number: number;
    text: string;
    lines: BookLine[];
};
export type BookOutline = {
    title: string;
    page: number;
    level: number;
};
export type BookChapter = {
    id: string;
    title: string;
    startPage: number;
    endPage: number;
    text: string;
    chars: number;
    sections: string[];
    included: boolean;
};
export type BookPDF = {
    fingerprint: string;
    pages: BookPage[];
    outline: BookOutline[];
};
export type BookContext = {
    title: string;
    chapterTitle: string;
    chapterNumber: number;
    sections: string[];
};
export type BookDraft = {
    content: Content;
    warnings: string[];
    longVerbatim: boolean;
};
export type ChapterState = {
    status: 'queued' | 'running' | 'done' | 'failed' | 'skipped';
    chunksTotal: number;
    chunksDone: number;
    sectionsTotal: number;
    sectionsCovered: number;
    gaps: string[];
    draftIds: string[];
    warnings: string[];
    error?: string;
};
