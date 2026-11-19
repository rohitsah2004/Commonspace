const NAMED: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', dollar: '$', vert: '|', lpar: '(', rpar: ')', sol: '/', bsol: '\\', grave: '`', equals: '=', colon: ':', semi: ';', lowbar: '_' };
export function decodeClipEntities(value: string): string {
  return value.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (match, entity: string) => {
    if (entity[0] !== '#') return NAMED[entity.toLowerCase()] ?? match;
    const n = entity[1].toLowerCase() === 'x' ? parseInt(entity.slice(2), 16) : parseInt(entity.slice(1), 10);
    return n > 0 && n <= 0x10ffff && !(n >= 0xd800 && n <= 0xdfff) ? String.fromCodePoint(n) : '\uFFFD';
  });
}
function fenced(code: string) {
  const fence = '`'.repeat(Math.max(2, ...(code.match(/`+/g) || []).map(run => run.length)) + 1);
  return '\n\n' + fence + 'text\n' + code + '\n' + fence + '\n\n';
}
export async function htmlToClipText(html: string): Promise<{ text: string; title: string }> {
  const title = decodeClipEntities(html.match(/<title\b[^>]*>([\s\S]*?)<\/title\s*>/i)?.[1] || '').replace(/\s+/g, ' ').trim();
  // Two passes: removed subtrees never reach text extraction, even with malformed/no end tags.
  const cleaned = await new HTMLRewriter().on('script,style,noscript,nav,footer,aside,form,svg,iframe,template,button,select,title,head,[hidden],[aria-hidden="true"]', {
    element(el) { el.remove(); },
  }).transform(new Response(html)).text();
  const out: string[] = []; let pre: string | null = null, inline: string | null = null, pending = '';
  const push = (value: string) => { if (value) out.push(value); };
  function emitText(value: string) {
    const decoded = decodeClipEntities(value);
    if (pre !== null) pre += decoded;
    else if (inline !== null) inline += decoded;
    else {
      let normalized = decoded.replace(/\s+/g, ' ');
      if (/\s$/.test(out.at(-1) || '')) normalized = normalized.trimStart();
      push(normalized);
    }
  }
  await new HTMLRewriter().on('*', {
    element(el) {
      const tag = el.tagName;
      if (tag === 'pre') {
        pre = ''; el.onEndTag(() => { push(fenced(pre || '')); pre = null; }); return;
      }
      if (pre !== null) return;
      if (tag === 'code') {
        inline = ''; el.onEndTag(() => {
          const code = inline || ''; inline = null;
          const marker = '`'.repeat(Math.max(0, ...(code.match(/`+/g) || []).map(run => run.length)) + 1);
          push(code.includes('\n') ? fenced(code) : marker + code + marker);
        }); return;
      }
      if (inline !== null) return;
      if (/^h[1-4]$/.test(tag)) { push('\n\n' + '#'.repeat(Number(tag[1])) + ' '); el.onEndTag(() => push('\n\n')); }
      else if (tag === 'li') push('\n- ');
      else if (['p', 'div', 'tr', 'br', 'section', 'article', 'main', 'blockquote'].includes(tag)) { push('\n\n'); if (tag !== 'br') el.onEndTag(() => push('\n\n')); }
      else if (tag === 'td' || tag === 'th') push(' | ');
    },
  }).onDocument({
    text(chunk) { pending += chunk.text; if (chunk.lastInTextNode) { emitText(pending); pending = ''; } },
  }).transform(new Response(cleaned)).text();
  if (pending) emitText(pending);
  // A malformed document can omit explicit closing tags. Keep extracted code fenced.
  if (pre !== null) push(fenced(pre));
  if (inline !== null) push(fenced(inline));
  return { text: out.join(''), title };
}
