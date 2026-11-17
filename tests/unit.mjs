import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';

// Import dependency-free TS modules without adding a runtime or test-framework dependency.
async function pureModule(path) {
  const source = await readFile(new URL(path, import.meta.url), 'utf8');
  const code = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 } }).outputText;
  return import('data:text/javascript;base64,' + Buffer.from(code).toString('base64'));
}
const { tokenize, CODE_LANGUAGES } = await pureModule('../lib/highlight.ts');
const { slugify, normalizeTag, uniqueSlug } = await pureModule('../lib/slug.ts');
assert.equal(slugify('  Cloud — Sécurity!  '), 'cloud-security');
assert.equal(normalizeTag('#Cloud Security'), 'cloud-security');
const seen = new Map();
assert.equal(uniqueSlug('Repeated heading', seen), 'repeated-heading');
assert.equal(uniqueSlug('Repeated heading', seen), 'repeated-heading-2');
for (const language of CODE_LANGUAGES) {
  const text = `const field = "safe <script>"; #fragment\n42`;
  assert.equal(tokenize(text, language).map(t => t.text).join(''), text);
}
assert(!tokenize('class X { #private = 1; }', 'javascript').some(t => t.kind === 'comment'));
assert(!tokenize('https://example.org/#fragment', 'http').some(t => t.kind === 'comment'));
assert(tokenize('$value = 42 # comment', 'powershell').some(t => t.kind === 'variable'));
assert(tokenize('where EventID == 4624 // comment', 'kql').some(t => t.kind === 'keyword'));
assert(tokenize('enabled: true # comment', 'yaml').some(t => t.kind === 'comment'));
assert(tokenize('const text = "# is a string";', 'javascript').some(t => t.kind === 'string'));
console.log('PASS: tag/heading slugs and language-aware tokenizer safety.');
