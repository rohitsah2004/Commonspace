import { BOOK_CHUNK_SIZE } from './types';
export function chapterChunks(text: string, size = BOOK_CHUNK_SIZE, overlap = 400): string[] {
    if (size < 1000 || overlap < 0 || overlap >= size)
        throw Error('Invalid chunk size.');
    const chunks: string[] = [];
    let at = 0;
    while (at < text.length) {
        const end = Math.min(text.length, at + size);
        chunks.push(text.slice(at, end));
        if (end === text.length)
            break;
        at = end - overlap;
    }
    return chunks.length ? chunks : [''];
}
/** Every summary is included in exactly one merge group, with no slicing. */
export function summaryGroups(summaries: string[], limit = 14000): string[][] {
    const groups: string[][] = [];
    let group: string[] = [], length = 0;
    for (const summary of summaries) {
        if (summary.length > limit)
            throw Error('A chunk summary is too large to merge without loss. Retry that chapter.');
        if (length + summary.length + 2 > limit && group.length) {
            groups.push(group);
            group = [];
            length = 0;
        }
        group.push(summary);
        length += summary.length + 2;
    }
    if (group.length)
        groups.push(group);
    return groups;
}
