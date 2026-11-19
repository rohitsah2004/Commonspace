import { resourceURL, assertPublicDNS } from './safe-link-check';
import { htmlToClipText } from './clip-html';
import { finishClip } from './clip-content';
const MAX_BYTES = 2_000_000;
const OK_TYPES = new Set(['text/html', 'application/xhtml+xml', 'text/plain', 'text/markdown', 'text/x-markdown']);
export class ClipError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}
export function checkClipURL(raw: string): URL {
  try {
    if (raw.length > 2048) throw Error();
    const url = resourceURL(raw.trim());
    if (/(^|\.)(localdomain|corp|intranet)$/.test(url.hostname)) throw Error();
    url.hash = ''; return url;
  } catch { throw new ClipError('Use a public HTTPS link without credentials or a custom port.'); }
}
export function rewriteClipGitHub(url: URL): URL {
  const parts = url.pathname.split('/').filter(Boolean);
  if (url.hostname === 'github.com' && parts.length >= 5 && parts[2] === 'blob')
    return checkClipURL(`https://raw.githubusercontent.com/${parts[0]}/${parts[1]}/${parts.slice(3).join('/')}`);
  if (url.hostname === 'github.com' && parts.length === 2)
    return checkClipURL(`https://raw.githubusercontent.com/${parts[0]}/${parts[1]}/HEAD/README.md`);
  if (url.hostname === 'gist.github.com' && parts.length === 2)
    return checkClipURL(`https://gist.githubusercontent.com/${parts[0]}/${parts[1]}/raw`);
  return url;
}
async function readBounded(response: Response): Promise<string> {
  if (!response.body) throw new ClipError('The page was empty.', 422);
  if (Number(response.headers.get('content-length')) > MAX_BYTES) { await response.body.cancel(); throw new ClipError('That page is too large.', 413); }
  const reader = response.body.getReader(); const bytes = new Uint8Array(MAX_BYTES); let size = 0;
  try {
    while (true) {
      const { value, done } = await reader.read(); if (done) break;
      if (size + value.byteLength > MAX_BYTES) throw new ClipError('That page is too large.', 413);
      bytes.set(value, size); size += value.byteLength;
    }
  } finally { await reader.cancel().catch(() => {}); reader.releaseLock(); }
  return new TextDecoder('utf-8').decode(bytes.subarray(0, size));
}
export async function clipUrl(raw: string, signal: AbortSignal, fetcher: typeof fetch = fetch) {
  let url = rewriteClipGitHub(checkClipURL(raw));
  for (let hop = 0; hop <= 3; hop++) {
    signal.throwIfAborted();
    try { await assertPublicDNS(url.hostname, signal, fetcher); } catch { throw new ClipError('That address could not be verified as public.', 502); }
    const response = await fetcher(url.href, { signal, redirect: 'manual', headers: {
      'User-Agent': 'CommonplaceClipper/1.0 (+https://blogs.rohitsah.com)', Accept: 'text/html,text/markdown,text/plain;q=0.9',
    } }).catch(() => { throw new ClipError('Could not reach that page.', 502); });
    if (response.status >= 300 && response.status < 400) {
      await response.body?.cancel(); const location = response.headers.get('location');
      if (!location || hop === 3) throw new ClipError('Too many redirects.', 502);
      try { url = checkClipURL(new URL(location, url).href); } catch { throw new ClipError('That redirect address is not allowed.', 400); }
      continue;
    }
    if ([401, 403, 429].includes(response.status)) { await response.body?.cancel(); throw new ClipError('That site blocked automated access. Paste the text instead.', 502); }
    if ([404, 410].includes(response.status)) { await response.body?.cancel(); throw new ClipError('Page not found.', 404); }
    if (!response.ok) { await response.body?.cancel(); throw new ClipError('That page returned an error.', 502); }
    const type = (response.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
    if (!OK_TYPES.has(type)) { await response.body?.cancel(); throw new ClipError('Only web pages and text/Markdown files are supported (no PDFs yet).', 415); }
    const body = await readBounded(response);
    const extracted = type === 'text/html' || type === 'application/xhtml+xml' ? await htmlToClipText(body)
      : { text: body, title: body.match(/^#\s+(.+)$/m)?.[1]?.trim() || '' };
    signal.throwIfAborted(); const done = finishClip(extracted.text);
    if (done.text.length < 300) throw new ClipError('Not enough readable text. This page may need JavaScript. Paste the text instead.', 422);
    return { ...done, title: extracted.title.slice(0, 200), sourceUrl: url.href };
  }
  throw new ClipError('Too many redirects.', 502);
}
