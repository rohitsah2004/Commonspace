// Run `node tests/book-csp.mjs`, then open the printed local URL in a browser.
// This tests the production PDF module independently of framework development overlays.
import { build } from 'vite';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { extname, resolve, sep } from 'node:path';
const root = fileURLToPath(new URL('./book-csp/', import.meta.url));
const output = resolve(fileURLToPath(new URL('../work/book-csp-check/', import.meta.url)));
await build({ configFile: false, root, publicDir: fileURLToPath(new URL('./fixtures/', import.meta.url)), build: { outDir: output, emptyOutDir: true } });
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript', '.pdf': 'application/pdf' };
const policy = "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; worker-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'none'";
createServer(async (request, response) => {
  const path = resolve(output, '.' + new URL(request.url, 'http://localhost').pathname.replace(/\/$/, '/index.html'));
  if (!path.startsWith(output + sep)) { response.writeHead(403).end(); return; }
  try {
    const bytes = await readFile(path);
    response.writeHead(200, { 'Content-Type': types[extname(path)] || 'application/octet-stream', 'Content-Security-Policy': policy, 'Cache-Control': 'no-store' }).end(bytes);
  } catch { response.writeHead(404).end(); }
}).listen(5188, '127.0.0.1', () => console.log('CSP check: http://127.0.0.1:5188/ (Ctrl-C to stop)'));
