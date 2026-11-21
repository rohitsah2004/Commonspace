import { nodeText } from '../headings';
import type { DocNode } from '../content';
const words = (text: string) => text.toLowerCase().match(/[\p{L}\p{N}]+(?:['’-][\p{L}\p{N}]+)*/gu) || [];
export function hasCopiedRun(source: string, output: string, length = 25): boolean {
    const a = words(source), b = words(output);
    if (a.length < length || b.length < length)
        return false;
    const runs = new Set<string>();
    for (let i = 0; i <= a.length - length; i++)
        runs.add(a.slice(i, i + length).join(' '));
    for (let i = 0; i <= b.length - length; i++)
        if (runs.has(b.slice(i, i + length).join(' ')))
            return true;
    return false;
}
const STOP = new Set('a an the and or of to in on for with from by as is are at introduction chapter section part'.split(' '));
export function sectionTerms(title: string): string[] {
    return [...new Set(words(title).filter(w => w.length > 2 && !STOP.has(w)))].slice(0, 6);
}
export function missingSections(sections: string[], note: string): string[] {
    const tokens = new Set(words(note));
    return sections.filter(title => { const terms = sectionTerms(title); return terms.length ? !terms.every(term => tokens.has(term)) : !note.toLowerCase().includes(title.toLowerCase()); });
}
export function bookCodeWarnings(source: string, nodes: DocNode[]): string[] {
    const warnings: string[] = [];
    let i = 0;
    const walk = (items: DocNode[]) => {
        for (const item of items) {
            if (item.tag === 'pre') {
                i++;
                if (!source.includes(nodeText(item.children || [])))
                    warnings.push('Code block ' + i + ' was not found verbatim in the supplied chapter text.');
            }
            else
                walk(item.children || []);
        }
    };
    walk(nodes);
    return warnings;
}
