import type { DocNode } from './content';
import { uniqueSlug } from './slug';
export type Heading = { id: string; text: string; level: number };
export function nodeText(nodes: DocNode[]): string { return nodes.map(n => n.text ?? nodeText(n.children ?? [])).join(''); }
export function getHeadings(nodes: DocNode[]): Heading[] {
  const seen = new Map<string, number>(); const headings: Heading[] = [];
  function walk(list: DocNode[]) {
    for (const node of list) {
      if (node.tag === 'h2' || node.tag === 'h3') {
        const text = nodeText(node.children ?? []);
        headings.push({ id: uniqueSlug(text, seen), text, level: node.tag === 'h2' ? 2 : 3 });
      }
      walk(node.children ?? []);
    }
  }
  walk(nodes); return headings;
}
