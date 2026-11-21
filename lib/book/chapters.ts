import { BOOK_MAX_CHAPTERS, type BookChapter, type BookOutline, type BookPage } from './types';
const normalized = (text: string) => text.trim().replace(/\s+/g, ' ').toLowerCase();
export function cleanPages(pages: BookPage[]): BookPage[] {
    const counts = new Map<string, Set<number>>();
    for (const page of pages) {
        const lines = page.text.split('\n');
        for (const line of [...lines.slice(0, 2), ...lines.slice(-2)]) {
            const key = normalized(line);
            if (key && line.length <= 180) {
                if (!counts.has(key))
                    counts.set(key, new Set());
                counts.get(key)!.add(page.number);
            }
        }
    }
    const repeats = new Set([...counts].filter(([, seen]) => pages.length >= 3 && seen.size >= Math.max(3, Math.ceil(pages.length * .6))).map(([key]) => key));
    return pages.map(page => {
        const lines = page.text.split('\n');
        const retained = lines.map((line, i) => {
            if (i > 1 && i < lines.length - 2)
                return true;
            if (/^\s*(?:page\s+)?\d+(?:\s*(?:\/|of)\s*\d+)?\s*$/i.test(line))
                return false;
            return !repeats.has(normalized(line));
        });
        return { ...page, text: lines.filter((_, i) => retained[i]).join('\n'), lines: page.lines.filter((_, i) => retained[i]) };
    });
}
const chapterHeading = /^(?:chapter|part)\s+(?:\d+|[ivxlcdm]+)\b|^\d{1,2}[.)]\s+\S/i;
export function chapterFromRange(pages: BookPage[], outline: BookOutline[], id: string, title: string, startPage: number, endPage: number, included = true): BookChapter {
    if (!title.trim() || title.length > 200 || !Number.isInteger(startPage) || !Number.isInteger(endPage) || startPage < 1 || endPage < startPage || endPage > pages.length)
        throw Error('Use a chapter title and valid page range.');
    const selected = pages.slice(startPage - 1, endPage);
    const text = selected.map(page => page.text).join('\n\n');
    const sections = [...new Set([
            ...outline.filter(o => o.title !== title && o.page >= startPage && o.page <= endPage).map(o => o.title),
            ...selected.flatMap(page => {
                const sizes = page.lines.map(l => l.size).sort((a, b) => a - b);
                const median = sizes[Math.floor(sizes.length / 2)] || 12;
                return page.lines.filter(l => l.text.trim().length > 3 && l.text.length <= 160 && (l.size >= median * 1.2 || /^\d+(?:\.\d+)+\s+\S/.test(l.text))).map(l => l.text.trim());
            }),
        ])].filter(s => s !== title && s.trim());
    return { id, title: title.trim(), startPage, endPage, text, chars: text.length, sections, included };
}
export function detectChapters(pages: BookPage[], outline: BookOutline[]): BookChapter[] {
    const topLevel = outline.filter(o => o.level === 1).length === 1 && outline.filter(o => o.level === 2).length > 1 ? 2 : 1;
    let starts = outline.filter(o => o.level === topLevel && o.page >= 1 && o.page <= pages.length).sort((a, b) => a.page - b.page);
    starts = starts.filter((o, i) => !i || o.page !== starts[i - 1].page);
    if (!starts.length)
        starts = pages.flatMap(page => {
            const sizes = page.lines.map(l => l.size);
            const typical = [...sizes].sort((a, b) => a - b)[Math.floor(sizes.length / 2)] || 12;
            const line = page.lines.slice(0, 8).find(l => chapterHeading.test(l.text.trim()) || (/^\d+(?:\.\d+)*\s+\S/.test(l.text) && l.size >= typical * 1.2));
            return line ? [{ title: line.text.trim().slice(0, 200), page: page.number, level: 1 }] : [];
        });
    if (!starts.length) {
        const width = Math.max(1, Math.ceil(pages.length / Math.min(BOOK_MAX_CHAPTERS, Math.max(1, Math.ceil(pages.length / 25)))));
        starts = pages.filter((_, i) => i % width === 0).map((p, i) => ({ title: 'Chapter ' + (i + 1), page: p.number, level: 1 }));
    }
    // Do not silently lose excess outline chapters: review groups combine consecutive ranges.
    if (starts.length > BOOK_MAX_CHAPTERS) {
        const width = Math.ceil(starts.length / BOOK_MAX_CHAPTERS);
        starts = starts.filter((_, i) => i % width === 0);
    }
    const list = starts.map((s, i) => chapterFromRange(pages, outline, 'chapter-' + i, s.title.slice(0, 200) || 'Chapter ' + (i + 1), s.page, (starts[i + 1]?.page || pages.length + 1) - 1));
    if (starts[0]?.page > 1)
        list.unshift(chapterFromRange(pages, outline, 'front-matter', 'Front matter', 1, starts[0].page - 1));
    // If front matter adds a 41st group, combine it into the first reviewed range.
    if (list.length > BOOK_MAX_CHAPTERS) {
        const first = list.shift()!;
        list[0] = chapterFromRange(pages, outline, list[0].id, list[0].title, first.startPage, list[0].endPage);
    }
    return list;
}
export function pageCoverage(pageCount: number, chapters: Pick<BookChapter, 'startPage' | 'endPage' | 'included'>[], excluded: number[]) {
    const counts = Array<number>(pageCount).fill(0);
    const exclusions = new Set(excluded);
    for (const chapter of chapters.filter(c => c.included))
        for (let p = chapter.startPage; p <= chapter.endPage; p++)
            if (p >= 1 && p <= pageCount)
                counts[p - 1]++;
    const unassigned: number[] = [], conflicts: number[] = [];
    counts.forEach((count, i) => { const p = i + 1; if (!count && !exclusions.has(p))
        unassigned.push(p); if (count > 1 || count > 0 && exclusions.has(p))
        conflicts.push(p); });
    return { unassigned, conflicts, covered: pageCount - unassigned.length - conflicts.length, complete: !unassigned.length && !conflicts.length };
}
export function pageRanges(pages: number[]): string {
    const ranges: string[] = [];
    let start = 0, end = 0;
    for (const p of [...pages, -1]) {
        if (!start) {
            start = end = p;
            continue;
        }
        if (p === end + 1) {
            end = p;
            continue;
        }
        ranges.push(start === end ? String(start) : start + '–' + end);
        start = end = p;
    }
    return ranges.join(', ');
}
