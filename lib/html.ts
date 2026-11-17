import { safeURL, type DocNode, type Content } from './content';
import { DOCUMENT_TAGS } from './document-schema';
import { uniqueSlug } from './slug';
import { nodeText } from './headings';
export function escapeHTML(value: string): string {
  return value.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
}
export function nodesToHTML(nodes: DocNode[], origin: string): string {
  const seen = new Map<string, number>();
  function walk(list: DocNode[]): string {
    return list.map(node => {
      if (node.text !== undefined) return escapeHTML(node.text);
      const tag = node.tag || 'p';
      if (!DOCUMENT_TAGS.has(tag)) return walk(node.children ?? []);
      if (tag === 'img') {
        const src = safeURL(node.src || '', true);
        return src ? `<img src="${escapeHTML(new URL(src, origin).href)}" alt="${escapeHTML(node.alt || '')}">` : '';
      }
      if (tag === 'br') return '<br>';
      let attrs = '';
      if (tag === 'a') {
        const href = safeURL(node.href || '');
        if (!href) return walk(node.children ?? []);
        attrs = ` href="${escapeHTML(href)}" rel="noopener noreferrer"`;
      }
      if (tag === 'h2' || tag === 'h3') attrs = ` id="${uniqueSlug(nodeText(node.children ?? []), seen)}"`;
      if (tag === 'pre') attrs = ` data-language="${escapeHTML(node.language || 'text')}"`;
      return `<${tag}${attrs}>${walk(node.children ?? [])}</${tag}>`;
    }).join('');
  }
  return walk(nodes);
}
export function feedHTML(content: Content, origin: string): string {
  const cover = safeURL(content.cover, true);
  return (cover ? `<img src="${escapeHTML(new URL(cover, origin).href)}" alt="${escapeHTML(content.title)}">` : '')
    + (content.subtitle ? `<p>${escapeHTML(content.subtitle)}</p>` : '')
    + (content.type === 'resource' && content.resourceUrl ? `<p>${escapeHTML(content.takeaway || '')}</p><p><a href="${escapeHTML(safeURL(content.resourceUrl))}">Visit resource</a></p>` : '')
    + nodesToHTML(content.body, origin);
}
