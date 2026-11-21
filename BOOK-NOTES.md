# Book Notes

Open **Studio → Book notes**. Select a PDF or import a direct public HTTPS PDF link, review chapter titles and page ranges, optionally enter a title/author/source URL, then Start. Every page must be in exactly one included chapter or explicitly excluded. All generated items are unpublished drafts in `Notes: <Book Title>`; review and publish in the normal editor.

## Data flow

Uploaded PDF bytes remain in the browser. PDF.js is loaded on selection, with its production worker bundled on the same origin. It reads text and bookmarks without OCR, external font services, a CDN, or eval. Encrypted, damaged and image-only files get clear errors. Limits are 60 MiB, 1,000 pages and 40 reviewed chapter ranges.

Link imports use owner-only, same-origin `POST /api/book/fetch`: a streaming relay, not storage. The server resolves public DNS on every hop using the existing checker, rejects private addresses/IP literals/credentials/custom ports, permits three redirects, sets 10-second connection and 60-second total deadlines, and caps bytes during streaming. Responses are PDF magic checked and `no-store`; upstream cookies, authorization and response details are not forwarded. The existing DNS checker uses Cloudflare's DNS-over-HTTPS service. Download pages and links requiring a login should be downloaded manually and uploaded instead.

Only bounded chapter text or summary chunks go through the existing `/api/assist` flow. Book calls use the existing server-only OpenAI adapter, secret detection, URL protection, taxonomy normalization, strict structured JSON, Markdown parsing and content validation. This preserves the assistant's current JSON contract rather than adding fragile frontmatter parsing. `book_chunk` returns a note; `book_chapter` returns a required note and either a cheat sheet or explicit `null`. Other assistant modes retain their existing contracts and limits.

## Coverage and recovery

Chapters use bookmarks, heading heuristics, then equal page ranges. Repeating margins/page numbers are removed heuristically; inspect the extracted text before starting. More than 40 detected starts are grouped into consecutive review ranges. Larger chapters are split into approximately 15,000-character chunks with 400-character overlap. Every chunk is summarized, and every summary participates in bounded hierarchical merges. Oversized checklists or summaries stop with a retry/split message instead of silently dropping text.

Subheading key terms are checked against the note. One automatic follow-up attempts missing sections; unresolved gaps remain in the report with Regenerate and Add missed sections actions. This checks section labels, not semantic completeness. Code blocks absent verbatim from the original extracted chapter get a non-blocking notice. Drafts containing 25 consecutive copied words get a small informational “Long verbatim passage” indicator.

Pause stops between requests; cancel aborts the active request. Completed drafts remain available. Local storage contains only a plan/document hash, collection ID, statuses, counts and draft IDs—never PDF bytes or source text. After refresh, reselect the same PDF and recreate the same reviewed plan and details. Completed drafts are reused; interrupted chapters restart from their source text. Optimistic versioned saves protect existing drafts, and retry lookup recovers interrupted create responses. Browsers with Web Locks prevent the same job from running in two tabs at once; keep one generation tab open per job in other browsers. Changing the plan creates a separate recovery identity.

Book generation has a separate `assist-book` quota of 150 calls/day; PDF relay uses `book-fetch`, 20/day, both UTC. Provider timeouts, invalid outputs and refundable provider failures restore the book-generation reservation. Calls are sequential, with a short delay; the UI estimates minimum API calls and approximate source tokens, without pricing. Summary merges and coverage follow-ups consume additional calls. No new migration, binding or production secret is required beyond the existing configured AI key/model and rate-limit infrastructure.

## Verification

Run `node tests/unit.mjs`, `npx tsc --noEmit`, `npm run lint` and `npm run build`. Existing integration checks run with AI disabled against the local preview: `python3 tests/integration.py`.

Run `node tests/book-csp.mjs` and open its printed local URL to test the bundled production PDF reader with the synthetic three-page fixture. Its enforced policy permits only same-origin scripts, workers and connections, with the existing inline-style allowance; it contains no unsafe-eval or external host exception. The fixture must report three pages, three bookmarks, preserved command text and zero policy violations. This isolates the PDF reader from development hot-reload overlays; full-site CSP enforcement still follows `CSP-ENFORCEMENT.md`.

Unit tests use mocked networking and real SQLite quota operations. They cover owner/origin guards, strict schemas, optional cheat sheets, source metadata compatibility, all-chunk inclusion, coverage follow-up, storage projection, draft-only recovery, independent quotas, private DNS/redirect/type/magic checks and streamed byte limits.

Local live validation used the synthetic fixture with OpenAI and saved unpublished note/cheat-sheet drafts. Direct-link import passed mocked streaming/SSRF tests, but its live sample check could not complete because the local connection to cloudflare-dns.com was reset. No DNS guard was bypassed. A narrow development middleware serves the exact PDF.js worker asset unchanged to avoid Vite 8 injecting browser hot-reload code into a worker. Release builds use the bundled worker URL and passed the separate enforced-CSP browser check.
