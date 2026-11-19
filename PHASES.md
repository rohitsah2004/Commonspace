# Security knowledge hub implementation log

This branch is repository-only. No deployment or production tests are authorized.
Existing migrations and generated scripts/vendor/UI source remain untouched.

## Phase 1 — content foundation

- Added strict optional content metadata, with missing type normalized to `post` and HTTPS-only resource URLs.
- Added typed public query/card helpers, tag slugs, related-item ranking, and the typecheck command.
- Preserved scheduled visibility and legacy document validation.
- Checks: `npx tsc --noEmit`, `npm run lint`, `npm run build`, and the loopback `python3 tests/integration.py` passed.
- Baseline lint: the initial repository had 108 lint errors. Existing dynamic-payload `any` annotations are recorded as warnings in an explicit legacy file allowlist; new modules remain strict. Standard anchors are intentional in Vinext/Sites, so Next's Link-only rule is disabled. The existing contenteditable DOM inspector is exempt from React Compiler's immutability inference (it intentionally edits DOM nodes). Fixed the render-time save-ref assignment and synchronous theme-state effect. Remaining legacy warnings are visible, not silently suppressed.
- Follow-up: later phases add editor controls and public type routes; no schema change was needed here.

## Phase 2 — canonical URLs and editable site settings

- Replaced the hardcoded origin with `siteUrl()` and an HTTPS-only `SITE_URL` environment setting; metadata, canonical/share URLs, RSS, sitemap, robots and emails now use it.
- Added a strict `site` settings record, provider, owner API action and management form. Defaults preserve the current hero and brand copy.
- Updated canonical-domain and Medium import instructions without production validation values.
- Checks: typecheck, lint, build and the loopback integration suite passed. Verified both the unset fallback and configured `https://blog.rohitsah.com` in local metadata/RSS/sitemap/robots. Local Worker env changes require a dev-server restart. Added a sitemap return type after the canonical-output check caught a function-reference typo.
- Files: lib/server.ts, lib/site-settings.ts, app/components/site-*.tsx, layout/home/ui, metadata/feed/email routes, manage API/UI, env declarations, DOMAIN-SETUP.md.
- Follow-up: set SITE_URL in the real hosting environment only after DNS/HTTPS validation; no deployment was performed.

## Phase 3 — typed editor and public browsing

- Added type/difficulty/resource/review-date controls and tag suggestions to the existing editor without replacing its save/version/schedule flow. Resource-only empty bodies are allowed; other types retain the publish body requirement.
- Added paginated type listings, URL-based multi-tag/difficulty/sort filters, tag index/detail pages, type-specific article badges and resource calls to action, and top-tag/type navigation.
- Added regression assertions for strict metadata, legacy defaults, HTTPS resource links, public type/tag pages, and unpublished-content filtering. Tightened null handling for optional metadata.
- Checks: all four required commands passed; legacy lint warnings remain visible. No forbidden generated/configuration paths changed.
- Files: app/components/content-fields.tsx, content-card.tsx, listing.tsx, knowledge-nav.tsx; type/tag routes and API; surgical editor/article/sidebar changes; tests/hub.py and integration hook; public/blog.css.
- Follow-up: homepage body payload removal and debounced search are the next phase; Saved navigation is added when its route exists.

## Phase 4 — lightweight payloads and server search

- Homepage receives cards only, never full document bodies. Added a public scored search endpoint with min query length, type/tag/difficulty filters, a hard 30-result cap, HTML-safe JSON snippets, and a 30-second public cache policy.
- Added a 200 ms debounced, abortable search hook, safe text highlighting, type badges in suggestions, and `/` focus in addition to Cmd/Ctrl+K.
- Article metadata/body/related/series reuse request-scoped parsed public items; related ranking uses tag overlap then type then recency.
- Checks: all four commands passed. Added explicit tests proving title > tag > subtitle > body ordering, min-length/cap/filter behavior and absence of full-body sentinel text in homepage HTML.
- Files: lib/queries.ts, lib/search.ts, app/api/search/route.ts, app/components/use-search.ts/search-snippet.tsx, surgical home/page/article changes and tests.
- Follow-up: rate limiting is deliberately added in the security phase; no public-page HTML caching yet.

## Phase 5 — code and cheat-sheet reading

- Replaced the generic tokenizer with a dependency-free, language-aware forward scanner for all requested languages. JS private fields and HTTP fragments are no longer treated as hash comments; output remains React text nodes.
- Added SSR-compatible code blocks with accessible clipboard feedback, deterministic heading IDs/anchor links, H3 editing, and a desktop-sticky/mobile-collapsible ToC.
- Added wider/dense cheat sheets, reviewed dates, Markdown copy and print/PDF controls, plus print CSS that removes chrome and avoids breaks inside code/tables. Long cheat sheets naturally span pages rather than shrinking illegibly.
- Added the initial safe Markdown serializer here because cheat-sheet copy needs it; phase 12 adds parsing/frontmatter and downloads.
- Checks: all four required commands passed. Additional pure-module tests cover tokenizer reconstruction/comment rules/slug deduplication; disposable local SSR checks cover copy controls, duplicate heading IDs, ToC links and print/Markdown actions.
- Files: lib/highlight.ts, headings.ts, markdown.ts; app/components/document-body.tsx, copy-code.tsx, table-of-contents.tsx, cheatsheet-actions.tsx; surgical RichBody/editor/article/CSS changes; tests/unit.mjs.
- Follow-up: clipboard/print behavior requires normal browser permissions; print page count depends on content length. No production browser or data was used.

## Phase 6 — reader saving and progress

- Added strict, capped browser-only saved items with safe storage handling, cross-tab subscriptions, accessible bookmark toggles, navigation count, and saved-list JSON import/export.
- Added /saved with chunked public availability/title refresh and explicit unavailable/offline states. Lookup accepts at most 100 IDs and only returns published cards.
- Added bookmark controls to home/type/tag cards, article headers and collection steps; collection completion is browser-local and syncs across tabs.
- Checks: all four required commands passed. Unit tests cover corrupted/blocked storage, the 500-item limit, strict import fields and projecting cards into saved entries. Local lookup tests cover draft/deleted filtering and the 100-ID cap.
- Files: lib/saved.ts, progress.ts; /saved and /api/public/lookup; bookmark-button.tsx, collection-steps.tsx; surgical card/sidebar/home/article/collection changes and tests.
- Follow-up: saved items and progress intentionally do not sync across devices; use the JSON export/import to move saved items. No accounts or database bookmark records were added.

## Phase 7 — maintained learning paths

- Added validated collection edit/delete/reorder actions and management UI, including audience and estimated hours. Optional metadata uses the existing settings table; no schema change is needed.
- Reordering snapshots previous drafts and atomically checks all submitted versions. It changes position only in each matching draft/live/scheduled snapshot and cannot publish private body edits.
- Collection pages retain numbered steps, local completion progress and bookmarks; added estimated duration and featured 'Start here' labeling. Collection URLs now appear in the sitemap.
- Checks: all four required commands passed. Disposable local tests also verified stale reorder rejection, revision creation, metadata edits, collection deletion without broken posts, and live/private body isolation.
- Files: lib/collection-metadata.ts, manage-collections.ts, app/components/collection-manager.tsx, surgical manage API/UI/server collection/sitemap/page changes.
- Follow-up: deleting a collection clears its featured setting but deliberately leaves post content intact.

## Phase 8 — security knowledge homepage

- Replaced the dense homepage implementation with a small re-export to a normally formatted hub component.
- Added settings-driven hero and section copy, optional featured learning path, four-item type rows, top tags, newsletter/RSS, and a 20-item paginated browse grid retaining grid/list mode and debounced search.
- Server assembles lightweight cards only; rows reuse one parsed public dataset. Resources never load remote favicons/images. Existing explicitly saved copy is preserved; fresh default settings now suit security knowledge.
- Checks: typecheck, lint, build and the full loopback integration suite passed, including the full-body-payload sentinel assertion.
- Files: lib/hub-copy.ts, site-settings.ts; app/components/hub-home.tsx and settings form; surgical app/page.tsx/home shim and CSS.
- Follow-up: public HTML still intentionally varies with owner status until the next caching-safety phase.

## Phase 9 — identity-free public cache boundary

- Public pages no longer call isOwner or serialize owner-dependent controls. A single client ownership provider reads no-store /api/me; studio routes keep server authorization.
- Verified anonymous and owner public HTML contain no owner chrome, while /api/me returns the correct boolean and private routes remain uncached.
- Added explicit public GET/HEAD-only cache policy via Vinext's supported proxy merge, preserving RSC vary headers and excluding RSC/prefetch/private/API requests. Verified installed Vinext source: next.config headers do not override an existing renderer no-store, but middleware owns singular response headers; local runtime assertions confirm the proxy behavior.
- Added feed ETag/304 and generated drizzle/0002_damp_puff_adder.sql. Local EXPLAIN changed from SCAN posts to SEARCH using posts_public_idx(deleted_at,published_at); the CASE sort still uses a temporary B-tree.
- Checks: all four commands passed, plus explicit owner/anonymous/cache/private/ETag assertions. No deployment or production access.
- Cache limitation: fresh TTL is 60 seconds; the requested SWR=300 can serve older HTML during revalidation. This is not a hard 60-second scheduled-publication SLA. Keep no-store when exact-time freshness is mandatory.

## Phase 10 — feeds and distribution

- Added escaped TechArticle/Article JSON-LD, snapshot modification timestamps, meaningful sitemap dates, safe full-body RSS HTML, feed filters, categories and JSON Feed 1.1 with ETags.
- Added configurable security.txt (404 until a contact is set), canonical redirect, LinkedIn/canonical copy helpers, X sharing and Medium import guidance.
- Checks: all four required commands passed; additional loopback assertions verified well-formed RSS, atom self link, JSON Feed/ETag, sitemap routes and unset-contact 404.
- Files: lib/html.ts, feeds.ts, snapshot.ts, sitemap.ts, document-schema.ts; feed/security routes, article structured data and distribution components; surgical validation/editor/share changes.
- Follow-up: old snapshots without an explicit modification timestamp use their known publication timestamp, never private draft update times. Configure securityContact before publishing security.txt.

## Phase 11 — security and privacy

- Added supported proxy security headers and report-only CSP, local Manrope WOFF2 fonts and two preloads, D1 fixed-window salted-IP rate counters, an actual subscription honeypot, and Worker-safe JPEG APP1 metadata removal.
- Audited all nine POST routes: owner content/files/uploads/manage/newsletter use authorizeWrite; public analytics/subscribe enforce same origin and limits; subscription uses same origin and secret confirmation/unsubscribe tokens. Revisions are read-only and owner protected. No missing owner guard found in owner writes.
- Checks: all four required commands passed after rerunning integration without concurrent rate-threshold requests. Local assertions verified 429/Retry-After, report-only/security headers and removal of Google font links; JPEG unit checks passed. Local browser preview loaded successfully.
- Files: proxy.ts, lib/rate-limit.ts/jpeg.ts, generated drizzle/0003_melted_lockheed.sql and schema, fonts/license, subscription/upload hooks, SECURITY.md and environment declarations.
- Follow-ups: RATE_LIMIT_SALT (>=32 random characters) is required; missing configuration fails closed. HSTS is left to the HTTPS hosting edge until its existing policy is verified. Sites cross-origin iframe verification requires a staging deployment, prohibited in this task; CSP remains report-only. SECURITY.md gives enforcement steps. Explicit owner-authored HTTPS images can still contact their specified hosts; no new third-party public-page requests were added.

## Phase 12 — Markdown portability, dates and theme

- Added bounded Markdown/frontmatter parsing, safe inline formatting, lists, quotes, tables, mapped fenced languages and uploaded/HTTPS images. Imports pass the unchanged strict content validator; unsupported formatting stays text. Studio paste/file import and per-draft .md download are available; owner ZIP backups include draft Markdown alongside original JSON/assets.
- Extracted safeURL verbatim to a dependency-free module (content re-exports it) so Markdown serialization can be tested independently. Added exact theme-bootstrap CSP hash, pre-paint root/body synchronization and neutral UTC article/editor/manage dates.
- Checks: all four required commands passed; Markdown formatting/frontmatter/table/code round-trip and invalid URL/size tests passed. Browser verified dark mode persists on reload with both html/body classes synchronized.
- Files: lib/markdown-parser.ts, markdown-import.ts, url.ts, theme.ts; MarkdownTools, surgical studio/export/layout/date/theme/proxy edits and unit tests.
- Follow-ups: the simple Markdown subset deliberately degrades unsupported/nested syntax to readable text. The theme script is hashed; framework inline scripts still need a supported nonce/hash strategy before CSP enforcement. UTC was chosen instead of adding a timezone setting.

## Phase 13 — explicit digest and resource maintenance

- Added owner/same-origin digest batches with frozen message content, confirmed subscribers only, provider idempotency keys, unsubscribe tokens and the existing delivery ledger. Last-digest time advances only when the batch finishes; retries resume the active digest.
- Added owner-only resource health listing/check action and broken-link badges in manage. Checks rotate oldest-first, max 20/run, HEAD only, HTTPS/443, no credentials/IP literals/local hosts, DNS A/AAAA private/reserved guards, three redirects, five-second deadline per URL, no stored bodies.
- Checks: all four required commands passed. Mock-network tests cover unsafe destinations/private DNS and redirect limits. No actual digest or external resource request was sent during tests.
- Files: lib/digest.ts, resource-check.ts, safe-link-check.ts; /api/digest and /api/resources/check; MaintenanceTools and surgical manage integration; SECURITY.md.
- Follow-ups: real delivery needs Resend secrets and verified sender. Workers cannot pin fetch to the preflight DNS address; rebinding defense also depends on platform outbound isolation. This limitation and safe-porting requirement are explicit in SECURITY.md.

## Phase 14 — complete regression coverage and handoff

- Extended loopback tests for owner/cross-origin rejection, identity-free cached HTML, headers, collection edits/reorder CAS/revisions/delete, published-only lookup/cap, escaped RSS/full HTML/categories/ETag, JSON Feed, JSON-LD closing-script safety, sitemap, security contact/redirect and Markdown ZIP drafts. Added isolated mocked-mail digest retry/ledger/confirmed-only tests; rate threshold runs last.
- Final tests exposed Vinext's dot-directory exclusion. Fixed standard security.txt routing through its verified proxy rewrite to a normal API handler; tested configured contact and canonical redirect. Finished machine-readable UTC time labels in owner tools.
- Updated README with all routes, content types, browser-local saving/progress, feeds/search, Markdown/Obsidian portability, runtime variables, rate thresholds, migrations and local-only verification. Added CSP-ENFORCEMENT.md with exact staging-to-enforcement steps.
- Checks: npx tsc --noEmit, npm run lint, npm run build and python3 tests/integration.py all passed on the final source. Lint has 0 errors and 105 visible legacy warnings. git diff --check passed; no forbidden scripts/vendor/.openai/components/ui changes; no secrets or local runtime data tracked.
- Files: tests/integration.py, hub.py, digest.mjs; README.md, CSP-ENFORCEMENT.md; security routing correction and shared DateTime with surgical owner UI edits.
- Intentionally not executed: deployment, production tests, real email delivery, live resource probes, DNS changes, and enforced-CSP/Sites iframe verification. These need the owner's later authorized release/staging environment. Worker DNS pinning and SWR/print/Markdown subset limitations remain documented above and in SECURITY.md/README.md.

## Owner-only AI assistant — codex/ai-assistant

- Added owner-only, no-store /api/assist readiness and same-origin POST formatting. Format/Polish/Outline prompts isolate pasted text as delimited JSON data, prohibit invented facts and code edits, and return Markdown/frontmatter only. The endpoint cannot save or publish content.
- Added a server-only OpenAI Chat Completions adapter with owner-chosen AI_MODEL, store:false, max_completion_tokens <=6000, bounded provider/output bodies, generic errors, secret-echo rejection and a 60-second cancellable request. Other providers are explicitly unsupported/disabled, including the Anthropic stub.
- Responses pass required frontmatter checks, the existing Markdown importer and unchanged validateContent whitelist; original fenced blocks are compared to parsed output and changed/missing blocks produce warnings. An atomic hashed-owner/day counter reuses rate_limits for 30 valid configured attempts per UTC day; no new migration. Raw input/output is never logged or stored by the endpoint.
- Added a native dialog beside Import Markdown with readiness gating, privacy notice, hints/modes, cancellation, before/after preview, code warnings, discard and confirmation before replacing a nonempty draft. Applying reuses the existing Markdown onImport callback/dirty/autosave path and preserves cover/files/collection. No edits to the dense studio file were needed.
- Files: lib/ai.ts, assist-prompt.ts, assist-content.ts, assist-quota.ts, assist-limits.ts; app/api/assist/route.ts, app/components/ai-assistant.tsx and minimal MarkdownTools integration; env declarations, scoped CSS, README.md/SECURITY.md and tests.
- Verification: npx tsc --noEmit, npm run lint, npm run build, node --test tests/unit.mjs tests/digest.mjs, and python3 tests/integration.py all passed. Lint retains the prior 105 warnings with 0 errors. Provider tests mock fetch and use real temporary SQLite for quota SQL, covering authorization, size limits, hostile/missing-frontmatter/oversized/truncated output, injection, code warnings, no key leakage/logging/storage, timeout/cancel, cap and day rollover. Loopback tests verify real owner/origin guards, disabled configuration, no-store and unchanged post versions. Client bundle check found no provider endpoint/token-control code. No protected scripts/vendor/components/ui/migrations changes.
- Limitations: no real provider call or credential configuration; owner must choose a Chat Completions-compatible model. Local browser preview was blocked by the mock sign-in 403, so the enabled dialog's interactive provider flow was not browser-verified. Prompts/warnings do not guarantee factual or unfenced-command fidelity; human review is mandatory. Provider retention/billing policies still apply despite store:false; set a monthly spend limit. No deployment or production tests were performed.

## AI formatter runtime fix — codex/fix-ai-formatting

- Reproduced the production symptom in the local Cloudflare Worker: redirect:error throws TypeError before any provider request. Node-only mocked tests had not exposed the runtime incompatibility. Cloudflare's Request documentation confirms only follow/manual are supported.
- Changed the OpenAI adapter to manual redirect handling; the existing non-2xx rejection still fails closed on every 3xx and never forwards Authorization. Fixed the same unsupported option in the resource checker's DNS preflight. Added regressions for provider/resolver redirects and safe error separation between provider failures and invalid drafts, with no provider body/header disclosure.
- Verified a real synthetic-note request through the local Worker returned HTTP 200 and validated content after the fix. Separate short and near-limit synthetic provider diagnostics also passed. No production notes were read, modified or sent to the provider; temporary diagnostic logs and local model configuration were removed before the normal suite.
- All five required checks passed: typecheck, lint (0 errors, prior 105 warnings), build, node --test tests/unit.mjs tests/digest.mjs, and loopback integration. No new migrations or protected-path changes. Following the owner's standing instruction, merge and deploy this fix after validation.

## Readable RSS subscription flow — codex/rss-follow-page

- Verified the deployed /feed.xml returns HTTP 200 and valid RSS containing published items. Browser inspection confirmed the reported confusing page was raw XML rather than a feed/server failure.
- Added /follow with a canonical, selectable feed address, copy feedback/manual clipboard fallback and three reader setup steps. Homepage RSS calls to action now open this guide; raw /feed.xml and HTML feed autodiscovery remain unchanged for existing readers.
- Reused the existing Shell, typography, panels, theme tokens and responsive layout. Added loopback assertions for guide navigation, canonical feed URL and unchanged well-formed XML.
- All five checks passed (typecheck, lint with prior 105 warnings/0 errors, build, Node unit/digest tests, loopback integration). Browser preview automation timed out, so interactive clipboard/visual QA was limited. No schema or protected-path changes. Merge/deploy follows the owner's standing preference.

## Structured AI drafting improvements — 2026-11-18

- Replaced Markdown frontmatter responses with strict JSON schemas; full actions return metadata/body and metadata-only uses its own tags/excerpt schema. Server validation rejects malformed output and never turns errors into titles.
- Added mode × editor-type prompts, D1 taxonomy context, canonical tags with unambiguous near-match mapping, and a two-new-tag limit. Collections remain owner-selected.
- Protect fenced blocks, inline code and URLs with per-request placeholders; reject missing, duplicate, altered or unknown tokens and post-conversion fenced-code differences.
- Added shared secret heuristics, explicit send consent enforced server-side, and assistant-input redaction. No raw/provider content is logged. Heuristics cannot detect all secrets.
- Retry once on 429/5xx within a shared deadline; reserve quota atomically, refund provider/validation failures and cancellation against the original UTC day, retain counted provider request rejections.
- Added metadata-only and rough-notes-to-cheat-sheet actions, local TODO review, and editable excerpt persistence through JSON snapshots, Markdown, cards/feeds/social descriptions.
- No dependencies, SQL migrations, existing-content rewrites, or provider-key changes. Existing hosting identity/audience preserved.
- Checks: TypeScript, production build, lint (0 errors / 105 pre-existing warnings), unit/mock-provider tests and localhost integration. Browser: real OpenAI full-format and metadata previews with synthetic input, secret-consent/redaction and local TODO extraction verified. A metadata schema wiring error found during real-provider QA was fixed and covered by exact request-key regression checks.
- Embeddings/Vectorize NOT enabled: the available Sites hosting schema/tools offer no supported Vectorize index provisioning or binding. README records the prerequisite and visibility-safe indexing/search plan; keyword search and tag-related notes remain active. Do not claim semantic search is live.

## Owner-only link clipping — 2026-11-18

- Added `/api/clip` and fetch/extraction/quota modules, plus From link / Load link controls inside the existing AI dialog. Loading only extracts text; the owner explicitly starts the existing cheat-sheet formatting flow afterward. `/api/assist`, provider adapter and assist prompts/protection/quota modules are unchanged.
- Reused public DNS preflight at every destination, including redirects and GitHub/raw/gist rewrites. Enforced HTTPS/no-credentials/standard port, request/URL/page limits, three redirects, a 15-second deadline and content-type restrictions. No cookies or provider credentials are forwarded. DNS checks are not a transport-level address-pinning guarantee; existing hosting egress isolation remains necessary.
- Added separate atomic 20-successful-clips/day UTC counters with failure/cancellation refunds and explicit refund-failure errors. Clip requests write only quota counters, never content.
- HTML extraction uses real HTMLRewriter, strips noise in a separate pass, buffers text chunks for entity decoding and preserves preformatted whitespace with collision-safe code fences. Truncation keeps or omits fenced blocks atomically; source-header length is included in the assist character budget.
- Client snapshots source attribution with the model result and appends safe Based on link nodes in full previews/Apply. Metadata-only Apply remains metadata-only. Errors/cancellation leave draft/input unchanged; successful loading changes only assistant input, not the editor. No automatic AI request or publication.
- Validation: TypeScript, build, lint (0 errors / existing 105 warnings), unit/mock fetch+SQLite quota checks, and localhost integration passed. Separate local workerd tests verify real HTMLRewriter, operators/entities/blank-line code fidelity, streamed chunks, malformed fences and hidden/navigation/script removal.
- Browser QA: loaded the public Commonspace GitHub README via raw rewrite; verified selected cheat-sheet mode and existing secret scan. Then used synthetic input for a real OpenAI preview and Apply, verifying code and client-added attribution in an unpublished local draft. The disposable local draft was removed afterward. No production content was changed.
- No dependency, migration, environment-secret, audience or Site-identity changes. Extraction is heuristic; unsupported/JS-only pages require pasted text. Attribution does not grant publication rights. README records behavior and limits.
