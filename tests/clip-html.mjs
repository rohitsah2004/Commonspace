// Real Cloudflare HTMLRewriter; local workerd only, no external network.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';
import { Miniflare } from 'miniflare';
const source = await readFile(new URL('../lib/clip-html.ts', import.meta.url), 'utf8');
const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2022 } }).outputText;
const mf = new Miniflare({ modules: true, script: code + '\nexport default {async fetch(request) {return Response.json(await htmlToClipText(await request.text()));}};', compatibilityDate: '2026-05-15', host: '127.0.0.1', port: 0 });
try {
  const raw = 'echo "a && b < c > d"\nprintf \'$(id) | cat\'\n\n\nkeep blank lines\n``` inside\n';
  const escaped = raw.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;');
  const html = '<html><head><title>Code &amp; notes</title></head><body><nav>NO_NAV</nav><main><h1>Example</h1><p>Introduction &amp; context.</p><pre><code>' + escaped + '</code></pre><p>Use <code>curl &amp;&amp; cat</code>.</p><script>NO_SCRIPT</script><footer>NO_FOOTER</footer><div hidden>NO_HIDDEN</div></main></body></html>';
  const result = await (await mf.dispatchFetch('https://local.test/', { method:'POST', body:html })).json();
  assert.equal(result.title,'Code & notes');assert(result.text.includes(raw));assert(result.text.includes('`curl && cat`'));
  for (const noise of ['NO_NAV','NO_SCRIPT','NO_FOOTER','NO_HIDDEN']) assert(!result.text.includes(noise),noise);
  assert(!result.text.includes('Code & notes'));
  const malformed = await (await mf.dispatchFetch('https://local.test/',{method:'POST',body:'<p>Read this first.</p><pre>echo &lt;x&gt;'})).json();
  assert(malformed.text.includes('echo <x>'));assert(malformed.text.trim().endsWith('```'));
  // A stream deliberately splits entity bytes across chunks.
  const bytes = new TextEncoder().encode('<p>A &amp; B &#x26; C</p><pre>x &lt; y &amp;&amp; z</pre>');
  const stream = new ReadableStream({start(controller){for(const value of bytes)controller.enqueue(Uint8Array.of(value));controller.close();}});
  const split = await (await mf.dispatchFetch('https://local.test/',{method:'POST',body:stream,duplex:'half'})).json();
  assert(split.text.includes('A & B & C'));assert(split.text.includes('x < y && z'));
  console.log('PASS: real Worker HTML extraction, entity/code fidelity, chunked text, hidden/noise removal and malformed fences.');
} finally { await mf.dispose(); }
