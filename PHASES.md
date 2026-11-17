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
