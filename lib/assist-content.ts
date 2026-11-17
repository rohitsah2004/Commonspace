import { blank, validateContent, type Content, type DocNode } from './content';
import { parseMarkdown } from './markdown-parser';
import { importMarkdown } from './markdown-import';
import { nodeText } from './headings';
import { ASSIST_MODES, type AssistMode, type AssistHints } from './assist-prompt';
import { CONTENT_TYPES, DIFFICULTIES, type ContentType } from './types';

import { ASSIST_INPUT_LIMIT } from './assist-limits';
export { ASSIST_INPUT_LIMIT } from './assist-limits';
export class AssistInputError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}
export function validateAssistInput(input: unknown): { text: string; mode: AssistMode; hints: AssistHints } {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new AssistInputError('Provide text and a formatting mode.');
  const value = input as Record<string, unknown>;
  if (Object.keys(value).some(key => !['text', 'mode', 'hints'].includes(key))) throw new AssistInputError('Invalid formatting request fields.');
  if (typeof value.text !== 'string') throw new AssistInputError('Provide text to format.');
  if (value.text.length > ASSIST_INPUT_LIMIT) throw new AssistInputError('Use at most 20,000 characters.', 413);
  if (!value.text.trim()) throw new AssistInputError('Provide text to format.');
  if (!ASSIST_MODES.includes(value.mode as AssistMode)) throw new AssistInputError('Choose Format, Polish or Outline.');
  const hints: AssistHints = {};
  if (value.hints !== undefined) {
    if (!value.hints || typeof value.hints !== 'object' || Array.isArray(value.hints)) throw new AssistInputError('Invalid formatting hints.');
    const h = value.hints as Record<string, unknown>;
    if (Object.keys(h).some(key => !['type', 'tags'].includes(key))) throw new AssistInputError('Invalid formatting hints.');
    if (h.type !== undefined) {
      if (!CONTENT_TYPES.includes(h.type as ContentType)) throw new AssistInputError('Invalid type hint.');
      hints.type = h.type as ContentType;
    }
    if (h.tags !== undefined) {
      if (!Array.isArray(h.tags) || h.tags.length > 6 || h.tags.some(t => typeof t !== 'string' || t.length > 40)) throw new AssistInputError('Use up to six tag hints of 40 characters each.');
      hints.tags = h.tags as string[];
    }
  }
  return { text: value.text, mode: value.mode as AssistMode, hints };
}
export async function readAssistInput(request: Request) {
  // JSON escapes can use six bytes per input character; bound the envelope too.
  const maxBytes = 130000;
  if (Number(request.headers.get('content-length')) > maxBytes) throw new AssistInputError('Use at most 20,000 characters.', 413);
  const reader = request.body?.getReader(); if (!reader) throw new AssistInputError('Provide text to format.');
  const chunks: Uint8Array[] = []; let size = 0;
  try {
    while (true) {
      const { value, done } = await reader.read(); if (done) break;
      size += value.length; if (size > maxBytes) throw new AssistInputError('Use at most 20,000 characters.', 413); chunks.push(value);
    }
  } finally { await reader.cancel().catch(() => {}); reader.releaseLock(); }
  const bytes = new Uint8Array(size); let at = 0;
  for (const chunk of chunks) { bytes.set(chunk, at); at += chunk.length; }
  let value: unknown; try { value = JSON.parse(new TextDecoder().decode(bytes)); }
  catch { throw new AssistInputError('Provide valid JSON with text and a formatting mode.'); }
  return validateAssistInput(value);
}
export function inputCodeBlocks(source: string): string[] {
  const lines = source.split('\n'); const blocks: string[] = [];
  for (let i = 0; i < lines.length; i++) {
    const opening = /^[ \t]*(`{3,}|~{3,})[^\r\n]*\r?$/.exec(lines[i]); if (!opening) continue;
    const fence = opening[1]; const closing = new RegExp('^[ \\t]*' + fence[0] + '{' + fence.length + ',}[ \\t]*\\r?$');
    const code: string[] = [];
    while (++i < lines.length && !closing.test(lines[i])) code.push(lines[i]);
    blocks.push(code.join('\n'));
  }
  return blocks;
}
export function codeWarnings(input: string, output: DocNode[]): string[] {
  const actual: string[] = [];
  function walk(nodes: DocNode[]) { for (const node of nodes) { if (node.tag === 'pre') actual.push(nodeText(node.children || [])); else walk(node.children || []); } }
  walk(output);
  return inputCodeBlocks(input).flatMap((code, i) => actual[i] === code ? [] : ['Code block ' + (i + 1) + ' differs from your original']);
}
export function validatedAssistContent(markdown: string): Content {
  if (new TextEncoder().encode(markdown).length > 120000) throw Error('AI output too large.');
  if (!/^---\r?\n/.test(markdown)) throw Error('AI frontmatter missing.');
  const parsed = parseMarkdown(markdown); const m = parsed.metadata;
  if (!['title','subtitle','type','difficulty','tags'].every(key => Object.hasOwn(m, key))
    || typeof m.title !== 'string' || !m.title.trim() || typeof m.subtitle !== 'string'
    || !DIFFICULTIES.includes(m.difficulty as never) || !Array.isArray(m.tags) || m.tags.length > 6 || m.tags.some(tag => typeof tag !== 'string')) throw Error('Invalid AI frontmatter.');
  const imported = importMarkdown(markdown, blank());
  // AI cannot choose collections, timestamps, cover images, file attachments or publishing state.
  return validateContent({ title: imported.title, subtitle: imported.subtitle, type: imported.type, difficulty: imported.difficulty,
    cover: '', tags: imported.tags.map(tag => tag.toLowerCase()), body: imported.body,
    resourceUrl: imported.resourceUrl, takeaway: imported.takeaway, resourceKind: imported.resourceKind, series: '', position: 0, attachments: [] });
}
