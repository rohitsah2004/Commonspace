import type { Content, DocNode } from './content';
import { safeURL } from './url';
import { nodeText } from './headings';

const escapeText = (text: string) => text.replace(/([\\`*_\[\]<>])/g, '\\$1');
function inline(nodes: DocNode[]): string { return nodes.map(node => {
  if (node.text !== undefined) return escapeText(node.text);
  const value = inline(node.children ?? []);
  if (node.tag === 'strong' || node.tag === 'b') return '**' + value + '**';
  if (node.tag === 'em' || node.tag === 'i') return '*' + value + '*';
  if (node.tag === 'code') return '`' + nodeText(node.children ?? []).replace(/`/g, '\\`') + '`';
  if (node.tag === 'a') return '[' + value + '](' + safeURL(node.href || '').replace(/\)/g, '%29') + ')';
  if (node.tag === 'img') return '![' + escapeText(node.alt || '') + '](' + safeURL(node.src || '', true).replace(/\)/g, '%29') + ')';
  if (node.tag === 'br') return '  \n';
  return value;
}).join(''); }

export function nodesToMarkdown(nodes: DocNode[]): string {
  return nodes.map(node => {
    const children = node.children ?? [];
    if (node.text !== undefined) return escapeText(node.text);
    if (node.tag === 'h2' || node.tag === 'h3') return (node.tag === 'h2' ? '## ' : '### ') + inline(children) + '\n\n';
    if (node.tag === 'pre') {
      const text = nodeText(children); const longest = Math.max(2, ...(text.match(/`+/g) ?? []).map(s => s.length));
      const fence = '`'.repeat(longest + 1);
      return `${fence}${node.language || 'text'}\n${text}\n${fence}\n\n`;
    }
    if (node.tag === 'blockquote') return nodesToMarkdown(children).trim().split('\n').map(line => '> ' + line).join('\n') + '\n\n';
    if (node.tag === 'ul' || node.tag === 'ol') return children.map((child, i) => (node.tag === 'ol' ? `${i + 1}. ` : '- ') + nodesToMarkdown(child.children ?? []).trim().replace(/\n/g, '\n  ')).join('\n') + '\n\n';
    if (node.tag === 'table') {
      const rows: DocNode[] = [];
      const walk = (list: DocNode[]) => list.forEach(n => { if (n.tag === 'tr') rows.push(n); else walk(n.children ?? []); });
      walk(children);
      return rows.map((row, i) => { const cells = (row.children ?? []).map(c => inline(c.children ?? []).replace(/\|/g, '\\|').replace(/\n/g, ' ')); return '| ' + cells.join(' | ') + ' |\n' + (i === 0 ? '| ' + cells.map(() => '---').join(' | ') + ' |\n' : ''); }).join('') + '\n';
    }
    if (node.tag === 'figure') return nodesToMarkdown(children) + '\n';
    if (['p', 'div', 'li', 'figcaption'].includes(node.tag || '')) return inline(children) + '\n\n';
    return inline([node]);
  }).join('').trimEnd() + '\n';
}

export function contentToMarkdown(content: Content): string {
  const fields = { title: content.title, subtitle: content.subtitle, tags: content.tags, type: content.type || 'post',
    difficulty: content.difficulty || '', series: content.series || '', position: content.position || 0,
    ...(content.type === 'resource' ? { resourceUrl: content.resourceUrl, resourceKind: content.resourceKind, takeaway: content.takeaway } : {}),
    ...(content.reviewedAt ? { reviewedAt: content.reviewedAt } : {}) };
  return '---\n' + Object.entries(fields).map(([key, value]) => key + ': ' + JSON.stringify(value ?? '')).join('\n')
    + '\n---\n\n' + nodesToMarkdown(content.body);
}
