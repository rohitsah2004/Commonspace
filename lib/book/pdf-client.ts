import { BOOK_MAX_BYTES, BOOK_MAX_PAGES, type BookPDF, type BookPage, type BookOutline, type BookLine } from './types';
export async function readBookPDF(file: File, progress: (page: number, total: number) => void, signal: AbortSignal): Promise<BookPDF> {
    if (file.size > BOOK_MAX_BYTES)
        throw Error('Choose a PDF under 60 MB.');
    const bytes = await file.arrayBuffer();
    if (new TextDecoder().decode(bytes.slice(0, 5)) !== '%PDF-')
        throw Error('Choose a PDF file.');
    const fingerprint = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))).map(x => x.toString(16).padStart(2, '0')).join('');
    // This module is imported only after an owner selects a PDF in the studio.
    const pdfjs = await import('pdfjs-dist');
    const worker = await import('pdfjs-dist/build/pdf.worker.min.mjs?worker&url');
    const workerURL = new URL(worker.default, window.location.href);
    if (workerURL.origin !== window.location.origin)
        throw Error('The PDF worker must be served by this site.');
    pdfjs.GlobalWorkerOptions.workerSrc = workerURL.href;
    const task = pdfjs.getDocument({ data: bytes, useWasm: false, disableWorkerRendering: true, useWorkerFetch: false,
        disableFontFace: true, useSystemFonts: true, disableAutoFetch: true, disableRange: true, disableStream: true, verbosity: 0 });
    let encrypted = false;
    task.onPassword = () => { encrypted = true; void task.destroy(); };
    const abort = () => { void task.destroy(); };
    signal.addEventListener('abort', abort, { once: true });
    if (signal.aborted)
        abort();
    try {
        const doc = await task.promise;
        if (doc.numPages > BOOK_MAX_PAGES)
            throw Error('Choose a PDF with at most 1,000 pages.');
        const outline: BookOutline[] = [];
        const walk = async (items: Awaited<ReturnType<typeof doc.getOutline>>, level: number): Promise<void> => {
            for (const item of items || []) {
                try {
                    const destination = typeof item.dest === 'string' ? await doc.getDestination(item.dest) : item.dest;
                    const ref = destination?.[0];
                    const page = typeof ref === 'number' ? ref + 1 : ref ? await doc.getPageIndex(ref) + 1 : 0;
                    if (page)
                        outline.push({ title: item.title.trim(), page, level });
                }
                catch { /* An unresolved bookmark is retained through page-heading fallback. */ }
                await walk(item.items, level + 1);
            }
        };
        await walk(await doc.getOutline(), 1);
        const pages: BookPage[] = [];
        for (let number = 1; number <= doc.numPages; number++) {
            signal.throwIfAborted();
            const page = await doc.getPage(number), content = await page.getTextContent();
            const lines: BookLine[] = [];
            let text = '', size = 0, y: number | null = null, right: number | null = null;
            const flush = () => { if (text.trim())
                lines.push({ text: text.trimEnd(), size }); text = ''; size = 0; right = null; };
            for (const item of content.items) {
                if (!('str' in item))
                    continue;
                if (y !== null && Math.abs(item.transform[5] - y) > 2)
                    flush();
                // Adjacent PDF glyph runs can split a flag or command; add a space only for a measured gap.
                if (text && right !== null && item.transform[4] - right > Math.max(1, item.height * .15) && !text.endsWith(' ') && !item.str.startsWith(' '))
                    text += ' ';
                text += item.str;
                size = Math.max(size, Math.abs(item.transform[3]) || item.height || 12);
                y = item.transform[5];
                right = item.transform[4] + item.width;
                if (item.hasEOL)
                    flush();
            }
            flush();
            pages.push({ number, text: lines.map(l => l.text).join('\n'), lines });
            page.cleanup();
            progress(number, doc.numPages);
        }
        if (!pages.some(p => p.text.trim().length > 0))
            throw Error('No extractable text; OCR is not supported.');
        return { fingerprint, pages, outline };
    }
    catch (error) {
        if (signal.aborted)
            throw Error('PDF reading cancelled.');
        if (encrypted || error instanceof Error && /password|encrypted/i.test(error.message))
            throw Error('Encrypted PDFs are not supported. Choose an unencrypted copy.');
        throw error instanceof Error && /1,000|extractable|OCR/.test(error.message) ? error : Error('Could not extract this PDF. It may be encrypted or damaged.');
    }
    finally {
        signal.removeEventListener('abort', abort);
        await task.destroy();
    }
}
