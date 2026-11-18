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

const { stripJPEGMetadata } = await pureModule('../lib/jpeg.ts');
const jpeg = new Uint8Array([255,216,255,225,0,8,69,120,105,102,0,0,255,224,0,4,1,2,255,218,0,2,1,2,255,217]);
assert.deepEqual([...stripJPEGMetadata(jpeg)], [255,216,255,224,0,4,1,2,255,218,0,2,1,2,255,217]);
assert.throws(() => stripJPEGMetadata(new Uint8Array([255,216,255,225,255,255])));
console.log('PASS: JPEG APP1/EXIF stripping preserves other segments and rejects malformed lengths.');

const { parseMarkdown } = await pureModule('../lib/markdown-parser.ts');
const { contentToMarkdown } = await pureModule('../lib/markdown.ts');
const md = '---\ntitle: "Markdown fixture"\ntags: ["Cloud Security", "Safe"]\ntype: "note"\ndifficulty: "beginner"\n---\n\n## Heading\n\n**Bold** and *emphasis* and `code` [link](https://example.org).\n\n```ps1\n$value = 42\n```\n\n> Quoted\n\n1. First\n2. Second\n\n| Name | Value |\n| --- | --- |\n| A | B |\n\n![local](/media/example.png)';
const parsed = parseMarkdown(md);
assert.equal(parsed.metadata.title, 'Markdown fixture');
assert.deepEqual(parsed.metadata.tags, ['Cloud Security', 'Safe']);
assert(parsed.body.some(n => n.tag === 'pre' && n.language === 'powershell'));
assert(parsed.body.some(n => n.tag === 'table'));
const round = parseMarkdown(contentToMarkdown({ ...parsed.metadata, cover:'', body: parsed.body }));
assert.deepEqual(round.metadata, { ...parsed.metadata, subtitle:'', series:'', position:0 });
assert.deepEqual(round.body, parsed.body);
assert.equal(parseMarkdown('# A title\n\n<script>never HTML</script>').title, 'A title');
assert.throws(() => parseMarkdown('x'.repeat(300 * 1024 + 1)));
assert.equal(JSON.stringify(parseMarkdown('[bad](javascript:alert) ![bad](http://example.org/image)')).includes('"href"'), false);
console.log('PASS: Markdown frontmatter, safe formatting, code languages, tables, round-trip and size cap.');

const { publicAddress, resourceURL, checkHTTPS } = await pureModule('../lib/safe-link-check.ts');
for (const ip of ['127.0.0.1','10.1.1.1','169.254.169.254','172.16.0.1','192.168.1.1','100.64.0.1','0.0.0.0','::1','fe80::1','fc00::1','::ffff:127.0.0.1','2001:db8::1']) assert(!publicAddress(ip), ip);
assert(publicAddress('93.184.216.34')); assert(publicAddress('2606:4700:4700::1111'));
for (const value of ['http://example.org','https://localhost/','https://127.0.0.1','https://0x7f000001','https://[::1]','https://example.org:8443','https://user:pass@example.org']) assert.throws(() => resourceURL(value));
let outbound = 0;
const mock = async (url, options) => {
  if (String(url).startsWith('https://cloudflare-dns.com/')) return Response.json({Status:0,Answer:[{type:1,data:'93.184.216.34'}]});
  outbound++; assert.equal(options.method,'HEAD'); assert.equal(options.redirect,'manual');
  return new Response(null,{status:302,headers:{location:'https://localhost/private'}});
};
assert.equal((await checkHTTPS('https://example.org', mock)).status,'broken'); assert.equal(outbound,1);
let redirects = 0;
const redirectMock = async (url) => String(url).startsWith('https://cloudflare-dns.com/')
  ? Response.json({Status:0,Answer:[{type:1,data:'93.184.216.34'}]}) : (redirects++, new Response(null,{status:302,headers:{location:'/next'}}));
assert.equal((await checkHTTPS('https://example.org', redirectMock)).status,'broken'); assert.equal(redirects,4);
const privateDNS = async () => Response.json({Status:0,Answer:[{type:1,data:'10.0.0.1'}]});
assert.equal((await checkHTTPS('https://example.org', privateDNS)).status,'broken');
console.log('PASS: link-check private DNS/IP/credential/port guards and redirect cap with mocked networking only.');

// Includes the real assist route/provider/pipeline with mocked external networking.
await import('./assist.mjs');
