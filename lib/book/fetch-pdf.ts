import { resourceURL, assertPublicDNS } from '../safe-link-check';
import { BOOK_MAX_BYTES } from './types';
export class BookFetchError extends Error {
    constructor(message: string, public status = 400) { super(message); }
}
export function bookURL(raw: string): URL {
    try {
        if (raw.length > 2048)
            throw Error();
        const url = resourceURL(raw.trim());
        url.hash = '';
        return url;
    }
    catch {
        throw new BookFetchError('Use a direct public HTTPS PDF link without credentials or a custom port.');
    }
}
export async function streamPDF(raw: string, signal: AbortSignal, fetcher: typeof fetch = fetch): Promise<Response> {
    const controller = new AbortController();
    const abort = () => controller.abort();
    const total = setTimeout(abort, 60000);
    signal.addEventListener('abort', abort, { once: true });
    if (signal.aborted)
        controller.abort();
    const cleanup = () => { clearTimeout(total); signal.removeEventListener('abort', abort); };
    try {
        let url = bookURL(raw);
        let response!: Response;
        for (let hop = 0; hop <= 3; hop++) {
            const connect = setTimeout(abort, 10000);
            try {
                await assertPublicDNS(url.hostname, controller.signal, fetcher);
                response = await fetcher(url.href, { method: 'GET', redirect: 'manual', signal: controller.signal,
                    headers: { Accept: 'application/pdf', 'User-Agent': 'Commonplace-PDF/1.0' } });
            }
            finally {
                clearTimeout(connect);
            }
            if (response.status >= 300 && response.status < 400) {
                await response.body?.cancel();
                const location = response.headers.get('location');
                if (!location || hop === 3)
                    throw new BookFetchError('Too many PDF redirects. Download the PDF and upload it instead.', 502);
                url = bookURL(new URL(location, url).href);
                continue;
            }
            break;
        }
        if (!response.ok || !response.body) {
            await response.body?.cancel();
            throw new BookFetchError('This link could not be downloaded. If it needs login, download then upload the PDF.', 502);
        }
        const type = (response.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
        if (type !== 'application/pdf' && (!url.pathname.toLowerCase().endsWith('.pdf') || type.includes('html'))) {
            await response.body.cancel();
            throw new BookFetchError('This link is a web page, not a direct PDF link. Download then upload the PDF.', 415);
        }
        if (Number(response.headers.get('content-length')) > BOOK_MAX_BYTES) {
            await response.body.cancel();
            throw new BookFetchError('Choose a PDF under 60 MB.', 413);
        }
        let bytes = 0;
        const limited = response.body.pipeThrough(new TransformStream<Uint8Array, Uint8Array>({
            transform(chunk, stream) {
                bytes += chunk.byteLength;
                if (bytes > BOOK_MAX_BYTES) {
                    controller.abort();
                    throw new BookFetchError('PDF exceeds 60 MB.', 413);
                }
                stream.enqueue(chunk);
            },
        }));
        const reader = limited.getReader();
        const initial: Uint8Array[] = [];
        let length = 0;
        while (length < 5) {
            const item = await reader.read();
            if (item.done)
                break;
            initial.push(item.value);
            length += item.value.length;
        }
        const magic = new Uint8Array(5);
        let at = 0;
        for (const part of initial) {
            const take = part.subarray(0, Math.min(5 - at, part.length));
            magic.set(take, at);
            at += take.length;
            if (at === 5)
                break;
        }
        if (new TextDecoder().decode(magic) !== '%PDF-') {
            await reader.cancel();
            throw new BookFetchError('This link is a web page, not a direct PDF link. Download then upload the PDF.', 415);
        }
        const body = new ReadableStream<Uint8Array>({
            start(stream) { for (const part of initial)
                stream.enqueue(part); },
            async pull(stream) {
                try {
                    const item = await reader.read();
                    if (item.done) {
                        cleanup();
                        stream.close();
                    }
                    else
                        stream.enqueue(item.value);
                }
                catch {
                    controller.abort();
                    cleanup();
                    stream.error(new Error('PDF download stopped or exceeded its limit. Download then upload the PDF.'));
                }
            },
            async cancel() { controller.abort(); cleanup(); await reader.cancel().catch(() => { }); },
        });
        return new Response(body, { headers: { 'Content-Type': 'application/pdf', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'Content-Disposition': 'attachment; filename="book.pdf"' } });
    }
    catch (error) {
        controller.abort();
        cleanup();
        if (error instanceof BookFetchError)
            throw error;
        throw new BookFetchError('The PDF could not be downloaded or took too long. Download then upload it instead.', 502);
    }
}
