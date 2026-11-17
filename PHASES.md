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
