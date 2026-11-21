/** Values remain request-local. The model sees opaque, per-request identifiers. */
export function protectLiterals(input: string, options: { sourceText?: boolean } = {}) {
  const prefix = '⟦KEEP_' + crypto.randomUUID().replaceAll('-', '') + '_';
  const originals: string[] = [];
  const save = (value: string) => prefix + (originals.push(value) - 1) + '⟧';
  // Match fences with the same character and a closing fence at least as long.
  const lines = input.split('\n'); const parts: string[] = [];
  for (let i = 0; !options.sourceText && i < lines.length; i++) {
    const opening = /^[ \t]*(`{3,}|~{3,})[^\r\n]*\r?$/.exec(lines[i]);
    if (!opening) { parts.push(lines[i]); continue; }
    const fence = opening[1]; const closing = new RegExp('^[ \\t]*' + fence[0] + '{' + fence.length + ',}[ \\t]*\\r?$');
    const block = [lines[i]]; let closed = false;
    while (++i < lines.length) { block.push(lines[i]); if (closing.test(lines[i])) { closed = true; break; } }
    if (!closed) throw Error('Close your fenced code block before formatting.');
    parts.push(save(block.join('\n')));
  }
  const text = options.sourceText ? input.replace(/https?:\/\/[^\s<>"'`]+|\/media\/[^\s<>"'`]+/g, save) : parts.join('\n').replace(/(`+)([^`]|`(?!`))*?\1|https?:\/\/[^\s<>"'`]+|\/media\/[^\s<>"'`]+/g, save);
  function restore(markdown: string) {
    // Reject unknown, altered, missing and duplicated tokens before replacing anything.
    const seen = markdown.match(/⟦KEEP_[^⟧\n]*⟧/g) || [];
    const expected = originals.map((_, i) => prefix + i + '⟧');
    if (seen.length !== expected.length || expected.some(token => seen.filter(v => v === token).length !== 1)) throw Error('AI changed protected literals.');
    expected.forEach((token, i) => {
      if (/^[ \t]*(`{3,}|~{3,})/.test(originals[i])) {
        const line = markdown.split('\n').find(line => line.includes(token));
        if (line?.trim() !== token) throw Error('AI moved a fenced block into inline content.');
      }
    });
    return markdown.replace(/⟦KEEP_[^⟧\n]*⟧/g, token => originals[expected.indexOf(token)]);
  }
  function restoreSelected(markdown: string) {
    return markdown.replace(/⟦KEEP_[^⟧\n]*⟧/g, token => {
      const index = originals.findIndex((_, i) => token === prefix + i + '⟧');
      if (index < 0) throw Error('Unknown source literal.');
      return originals[index];
    });
  }
  return { text, restore, restoreSelected };
}
