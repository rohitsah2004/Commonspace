import type { DocNode } from './content';
import { CODE_LANGUAGES } from './highlight';

export const MARKDOWN_LIMIT = 300 * 1024;
const text = (value: string): DocNode => ({ text: value });
const block = (tag: string, children: DocNode[]): DocNode => ({ tag, children });
function url(value: string, image = false): string {
  if (image && /^\/media\/[a-zA-Z0-9.-]+$/.test(value)) return value;
  try { const u = new URL(value); return (image ? ['https:'] : ['http:', 'https:']).includes(u.protocol) ? u.href : ''; } catch { return ''; }
}
export function markdownInline(value: string, depth = 0): DocNode[] {
  if (depth > 12) return [text(value)];
  const nodes: DocNode[] = [];
  const pattern = /\\([\\`*_\[\]<>|])|(`+)([^\n]*?)\2|(!?)\[([^\]\n]*)\]\(([^\s)]+)\)|(\*\*|__)([^\n]+?)\7|(\*|_)([^\n]+?)\9/g;
  let at = 0;
  for (const m of value.matchAll(pattern)) {
    if (m.index! > at) nodes.push(text(value.slice(at, m.index)));
    if (m[1]) nodes.push(text(m[1]));
    else if (m[2]) nodes.push(block('code', [text(m[3])]));
    else if (m[5] !== undefined) {
      const href = url(m[6], !!m[4]);
      nodes.push(href ? m[4] ? { tag: 'img', src: href, alt: m[5], children: [] }
        : { tag: 'a', href, children: markdownInline(m[5], depth + 1) } : text(m[0]));
    } else nodes.push(block(m[7] ? 'strong' : 'em', markdownInline(m[8] ?? m[10], depth + 1)));
    at = m.index! + m[0].length;
  }
  if (at < value.length) nodes.push(text(value.slice(at)));
  return nodes;
}
const cells = (line: string) => line.trim().replace(/^\||\|$/g, '').split(/(?<!\\)\|/).map(s => s.trim().replace(/\\\|/g, '|'));
export function parseMarkdown(source: string): { metadata: Record<string, unknown>; body: DocNode[]; title: string } {
  if (new TextEncoder().encode(source).length > MARKDOWN_LIMIT) throw Error('Choose Markdown under 300 KB.');
  const lines = source.replace(/\r\n?/g, '\n').split('\n'); const metadata: Record<string, unknown> = {};
  if (lines[0]?.trim() === '---') {
    const end = lines.findIndex((line, i) => i > 0 && line.trim() === '---');
    if (end > 0) {
      for (const line of lines.slice(1, end)) {
        const m = /^([a-zA-Z]+):\s*(.*)$/.exec(line); if (!m) continue;
        const key = m[1]; if (!['title','subtitle','excerpt','tags','type','difficulty','series','position','resourceUrl','resourceKind','takeaway','reviewedAt'].includes(key)) continue;
        let value: unknown = m[2].trim();
        try { value = JSON.parse(value as string); } catch { value = (value as string).replace(/^(['"])(.*)\1$/, '$2'); }
        if (key === 'tags' && typeof value === 'string') value = value.replace(/^\[|\]$/g, '').split(',').map(t => t.trim().replace(/^['"]|['"]$/g, '')).filter(Boolean);
        if ((key === 'position' || key === 'reviewedAt') && typeof value === 'string') value = Number(value);
        metadata[key] = value;
      }
      lines.splice(0, end + 1);
    }
  }
  const body: DocNode[] = []; let title = ''; let i = 0;
  while (i < lines.length) {
    const line = lines[i]; if (!line.trim()) { i++; continue; }
    const fence = /^\s*(`{3,}|~{3,})(\S*)\s*$/.exec(line);
    if (fence) {
      const code: string[] = []; i++;
      while (i < lines.length && !(lines[i].trim().startsWith(fence[1]) && /^([`~])\1*\s*$/.test(lines[i].trim()))) code.push(lines[i++]);
      if (i < lines.length) i++;
      const aliases: Record<string,string> = { js:'javascript',ts:'typescript',sh:'bash',shell:'bash',ps1:'powershell',yml:'yaml',py:'python',golang:'go',plaintext:'text' };
      const lang = aliases[fence[2].toLowerCase()] || fence[2].toLowerCase();
      body.push({ tag: 'pre', language: (CODE_LANGUAGES as readonly string[]).includes(lang) ? lang : 'text', children: [text(code.join('\n'))] }); continue;
    }
    const heading = /^(#{1,6})\s+(.+)$/.exec(line);
    if (heading) { if (heading[1].length === 1 && !title) title = heading[2]; else body.push(block(heading[1].length <= 2 ? 'h2' : 'h3', markdownInline(heading[2]))); i++; continue; }
    if (/^\s*>/.test(line)) {
      const quote: string[] = []; while (i < lines.length && /^\s*>/.test(lines[i])) quote.push(lines[i++].replace(/^\s*> ?/, ''));
      // One-level quote parsing avoids recursive input-driven stack growth.
      body.push(block('blockquote', [block('p', markdownInline(quote.join('\n')))])); continue;
    }
    const list = /^\s*(?:([-+*])|\d+[.)])\s+(.+)$/.exec(line);
    if (list) {
      const children: DocNode[] = []; const ordered = !list[1];
      while (i < lines.length) { const m = /^\s*(?:([-+*])|\d+[.)])\s+(.+)$/.exec(lines[i]); if (!m || !m[1] !== ordered) break; children.push(block('li', markdownInline(m[2]))); i++; }
      body.push(block(ordered ? 'ol' : 'ul', children)); continue;
    }
    if (line.includes('|') && i + 1 < lines.length && /^\s*\|?\s*:?-{3,}/.test(lines[i + 1])) {
      const rows = [block('tr', cells(line).map(c => block('th', markdownInline(c))))]; i += 2;
      while (i < lines.length && lines[i].includes('|') && lines[i].trim()) rows.push(block('tr', cells(lines[i++]).map(c => block('td', markdownInline(c)))));
      body.push(block('table', [block('tbody', rows)])); continue;
    }
    const paragraph = [line]; i++;
    while (i < lines.length && lines[i].trim() && !/^(?:#{1,6}\s|\s*>|\s*[-+*]\s|\s*\d+[.)]\s|\s*`{3,}|\s*~{3,})/.test(lines[i]) && !(lines[i].includes('|') && /^\s*\|?\s*:?-{3,}/.test(lines[i + 1] || ''))) paragraph.push(lines[i++]);
    body.push(block('p', markdownInline(paragraph.join('\n'))));
  }
  return { metadata, title, body };
}
