import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';

// Import dependency-free TS modules without adding a runtime or test-framework dependency.
async function moduleURL(file) {
  const source = await readFile(file, 'utf8');
  let code = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 } }).outputText;
  for (const match of [...code.matchAll(/from ["']([^"']+)["']/g)]) {
    const spec = match[1];
    const target = spec === 'react' ? import.meta.resolve('react')
      : spec.startsWith('.') ? await moduleURL(new URL(spec.endsWith('.ts') ? spec : spec + '.ts', file)) : null;
    if (target) code = code.replace(match[0], 'from ' + JSON.stringify(target));
  }
  return 'data:text/javascript;base64,' + Buffer.from(code).toString('base64');
}
async function pureModule(path) { return import(await moduleURL(new URL(path, import.meta.url))); }
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

const { validateSaved, readSaved, toggleSaved, SAVED_KEY } = await pureModule('../lib/saved.ts');
const valid = { id: 'test-id', slug: 'test-item', title: 'Saved fixture', type: 'note', savedAt: Date.now() };
assert.equal(validateSaved([valid]).length, 1);
assert.throws(() => validateSaved([{ ...valid, type: 'invalid' }]));
assert.throws(() => validateSaved([{ ...valid, extra: 'unexpected' }]));
assert.throws(() => validateSaved(Array.from({ length: 501 }, (_, i) => ({ ...valid, id: String(i) }))));
assert.deepEqual(readSaved({ getItem() { return '{broken'; } }), []);
assert.deepEqual(readSaved({ getItem() { throw Error('Storage blocked'); } }), []);
const memory = new Map();
globalThis.window = { localStorage: { getItem: key => memory.get(key) ?? null, setItem: (key, value) => memory.set(key, value) } };
assert.equal(toggleSaved({ ...valid, excerpt: 'Extra card fields are deliberately projected away.' }), true);
assert.equal(JSON.parse(memory.get(SAVED_KEY)).length, 1);
assert.equal(toggleSaved(valid), true);
assert.equal(JSON.parse(memory.get(SAVED_KEY)).length, 0);
window.localStorage.setItem = () => { throw Error('Storage blocked'); };
assert.equal(toggleSaved(valid), false);
delete globalThis.window;
console.log('PASS: strict saved imports, corrupted/blocked storage, cap, card projection and toggles.');
