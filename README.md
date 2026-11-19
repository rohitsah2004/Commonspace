# Commonplace

Public source for a personal publishing platform. No production data, credentials, or private content is included. Configure your own hosting identity, database, file storage, owner account, and optional email service before deploying.


A public personal publication with an owner-only writing studio. Built with Vinext, React, Cloudflare D1 and R2, and Sites-managed authentication.

## Experiences

- `/`: public stories and live search
- `/post/:slug`: articles with author profile, images, captions, tables, highlighted code, attachments, series navigation, and sharing metadata
- `/about`, `/collections`, `/collections/:slug`, `/feed.xml`: author, reading paths, RSS
- `/studio`: private editor, autosaved drafts, explicit publishing, scheduled snapshots
- `/studio/manage`: profile, collections, analytics, subscribers, revisions, trash, ZIP/JSON exports, domain instructions

## Access and persistence

Sites dispatch supplies verified identity headers. A configured `OWNER_EMAIL` can bind the initial owner Site user ID; all subsequent owner authorization uses that pinned ID. Every private data endpoint and write action checks ownership server-side. Write actions also require a same-origin request.

Drafts, live snapshots, scheduled snapshots, revisions, and trash are separate. Public queries choose a scheduled snapshot only after its timestamp; they do not depend on an open browser, cron, or a worker writing a publish flag. Scheduling a new version preserves the current visible snapshot. Restoring trash produces a private draft.

Images use opaque R2 URLs and can be read by anyone who knows the URL. Attachments are owner-only until referenced by a currently published story. Deleting or unpublishing removes anonymous attachment access. Full ZIP downloads stream every R2 asset and a complete JSON export. Keep exports private: they include drafts and subscriber records. Exports are manual; there is no external backup scheduler or automatic import UI.

## Optional email delivery

Configure `RESEND_API_KEY` and `NEWSLETTER_FROM` as server secrets in Sites, then deploy to apply the environment revision. The sender domain must be verified with the provider. Signup stays unavailable until both values exist; RSS remains available. Subscribers confirm by email, newsletter sends target confirmed subscribers only, and messages include unsubscribe links. Sending a story is an explicit author action in Publication tools. The app does not automatically email on publication. Delivery is batched with provider idempotency keys and a local delivery ledger.

No email provider credentials are committed. `.dev.vars` is ignored; use a local test owner only in local previews. See `.env.example` for key names.

## Domain

See DOMAIN-SETUP.md. `blog.rohitsah.com` is registered and awaits DNS verification. The working canonical origin remains the current Sites URL until the domain is verified and canonical configuration is updated.

## Analytics

Approximate first-party article views, deduplicated by a browser session/article/day hash. Only date, post ID and referrer hostname are stored; owner views are skipped. No IPs or full referrer URLs are stored in app analytics. Automated traffic can affect counts.

## Development and verification

Use the Sites plugin lifecycle helpers for dependency installation, builds and publication. Generate schema migrations with `npm run db:generate`; append migrations after production deployment, never edit applied migrations. Run `npx tsc --noEmit` for type checks. `python3 tests/integration.py` tests the loopback development server only and creates disposable local records; it must never target production. It checks owner access, scheduled visibility, revision restore, attachments, ZIP integrity and file contents, analytics deduplication, trash restore and disconnected email behavior.

## Security knowledge hub

Content types are **Post**, **Note**, **Cheat sheet**, and **Resource**. Existing content defaults to Post. Add up to eight tags, optional difficulty, and a collection. Cheat sheets have reviewed dates, table of contents, copyable code, Markdown copy and print/PDF controls. Resources require an HTTPS URL and support kind/takeaway fields; their cards load no remote favicons or images.

Browse `/posts`, `/notes`, `/cheatsheets`, `/resources`, `/tags`, and `/tags/:slug`. Type/tag pages have shareable query filters (`tag` repeated for multiple tags, `difficulty`, `sort`, `page`, and `q`). The homepage features a configurable learning path, newest items by type and paginated browsing. Search uses `/api/search` with title/tag/subtitle/body ranking, a two-character minimum, debounced cancellation and at most 30 lightweight results. Homepage/card payloads contain excerpts, never document bodies.

`/saved` keeps up to 500 bookmarks **in this browser's localStorage only**, with JSON import/export and cross-tab sync. There is no account or cross-device sync. Unpublished/deleted items become unavailable on refresh. Collection completion is also browser-local. Blocked or corrupt browser storage produces a safe empty/error state.

Feeds: `/feed.xml` remains RSS 2.0 with escaped full HTML, tag categories and ETags; `/feed.json` is JSON Feed 1.1. Both support `?type=cheatsheet` and repeated `tag` filters. Articles include safe JSON-LD; sitemap includes all knowledge and collection routes. Set the security contact under Site settings to enable `/.well-known/security.txt`; `/security.txt` redirects to its canonical URL.

## Markdown / Obsidian workflow

In the studio choose **Import Markdown**, paste text or choose a `.md` file (maximum 300 KB), review the replacement and save. Supported formatting includes h2/h3, bold/emphasis, inline/fenced code, quotes, lists, HTTP(S) links, uploaded/HTTPS images and tables. A top-level h1 supplies an empty title. Simple frontmatter accepts `title`, `subtitle`, `tags`, `type`, `difficulty`, `series`, `position`, and resource metadata. Imported documents pass the same strict content validator as normal saves. Unsupported syntax stays readable text; this is a deliberately bounded subset, not a complete CommonMark/YAML implementation.

Use **Download .md** to move a draft into Obsidian or another editor. Full owner ZIP backups include `posts/<slug>.md` for every stored draft plus the original JSON and R2 assets. Uploaded media references remain `/media/...`; keep the associated assets when moving to another system. Export archives include private data and must stay private. Per-post Markdown is the current draft; the original JSON preserves all live/scheduled/revision snapshots.

## Runtime configuration and security

- `OWNER_EMAIL`: verified initial owner binding; subsequent checks use the pinned owner ID.
- `SITE_URL`: canonical HTTPS origin, e.g. `https://blog.rohitsah.com`. If absent the existing Sites URL remains the fallback. Complete DNS/HTTPS verification first; see DOMAIN-SETUP.md.
- `RATE_LIMIT_SALT`: required random server secret, at least 32 characters. Search/analytics/subscribe return 503 until configured. Counters store salted hashes, never raw IPs, and are cleaned after 24 hours. Limits: search 60/minute, analytics 120/minute, signup 5/10 minutes. Cloudflare must overwrite trusted CF-Connecting-IP at ingress.
- `RESEND_API_KEY`, `NEWSLETTER_FROM`: optional email secrets and verified sender. Tests require these to be absent. Digests are explicit owner actions in the Subscribers tab; they group new publications since the last completed digest, send only to confirmed subscribers, and use resumable batches/idempotency/ledger records.
- Site settings: brand/hero/section copy, featured collection and security contact. Dates use UTC.

Resource checks are explicit owner actions in Subscribers, max 20 oldest-first per run. They use DNS/private-range checks, HTTPS HEAD, three redirects and five-second deadlines. Results are visible only in manage. Worker fetch cannot pin a resolved IP; preserve hosting outbound isolation against DNS rebinding, as described in SECURITY.md.

Fonts are self-hosted. Proxy middleware adds nosniff, referrer/permissions policies, COOP and **report-only** CSP. The theme bootstrap has an exact SHA-256 hash. Framework inline scripts need supported hashes/nonces and Sites frame origins must be verified before enforcement. HSTS is left to the hosting edge until its existing policy is checked. See SECURITY.md for the precise enforcement checklist and threat boundaries.

Public HTML excludes visitor identity; `/api/me` hydrates owner chrome separately. Public GET/HEAD pages use CDN fresh TTL 60 seconds and stale-while-revalidate 300 seconds. SWR can extend stale responses; this is not a hard 60-second scheduling guarantee. Owner/studio/preview responses remain uncached.

## Phase verification and database changes

PHASES.md records one commit per phase, changed modules, checks and limitations. Added generated migrations: `0002_damp_puff_adder.sql` (public-post index) and `0003_melted_lockheed.sql` (rate counters). Apply pending generated migrations through the normal hosting process before releasing this code. Existing migrations are unchanged. No deployment was performed for this upgrade.

Run a loopback dev server at `127.0.0.1:5173` with a disposable local owner, D1/R2 and RATE_LIMIT_SALT, then run:

```sh
npx tsc --noEmit
npm run lint
npm run build
python3 tests/integration.py
```

The suite verifies scheduled snapshots/revisions/trash, metadata, visibility, search ranking, local-storage helpers, collection CAS, feed/XML/JSON-LD safety, security headers/origin/owner guards, Markdown round-trip/ZIP and rate-limit 429. It uses local disposable records and mocked link networking; it never sends email or tests against production. Run the suite once at a time; the final threshold test intentionally exhausts the local search window. Wait for the next window before rerunning (or clear only disposable local rate counters). Legacy files still emit visible lint warnings; newly added modules retain strict linting.

The step-by-step staging checklist for switching CSP to enforcement is in [CSP-ENFORCEMENT.md](CSP-ENFORCEMENT.md). It includes the Sites parent-origin check, framework nonce/hash coverage and required regression flows.

## Optional owner-only AI formatting

The studio includes **Format with AI** with Format, Polish, Outline, **Suggest tags and excerpt**, and **Rough notes to cheat sheet** modes. Type-specific instructions use your hint or current editor type. Use **Use current draft text** to load the editor body. Metadata mode applies only tags/excerpt and retains the current title, body and other fields. **Review TODOs** lists draft TODO lines locally without a provider request. Review Before/After, then Apply and confirm changes; publishing remains a separate owner action. Covers, files and collections remain owner-selected. Errors never become draft titles or content.

Server settings:

- `OPENAI_API_KEY`: server secret, never browser code, Git, screenshots or logs.
- `AI_MODEL`: model supporting Chat Completions, `max_completion_tokens` and strict JSON-schema Structured Outputs. No hardcoded default.
- `AI_PROVIDER`: `openai` (the default); other values disable the feature.

`app/api/assist/route.ts` authorizes owner/same-origin requests, validates a 20,000-character input and reserves an atomic D1 quota (30/day, UTC). `lib/ai.ts` sends a native fetch to `https://api.openai.com/v1/chat/completions` with `store:false` and `response_format:json_schema` / `strict:true`. Full output has title, subtitle, excerpt, type, difficulty, tags and body-only Markdown. Metadata mode uses a smaller schema containing only tags and excerpt. Every field is validated again server-side, then the Markdown passes the existing safe editor parser. Requests share a 60-second deadline, with at most one retry after 600 ms for 429/5xx. Metadata uses a 1,500-token completion cap; other modes use 6,000. JSON/Markdown/envelope size limits remain bounded. No streaming, tools or publishing authority.

Fenced blocks (including fence delimiters), inline code and HTTP(S)/media URLs are replaced with random request-local placeholders before sending. Non-metadata responses must return every placeholder exactly once in the body; missing, altered, duplicated or unknown placeholders are rejected. Originals are restored before safe parsing; fenced code differences after conversion reject the result as a backstop. Close incomplete fences first. The Markdown parser is deliberately bounded: unsupported constructs may be rejected rather than silently changing code. Review factual claims and rendered output yourself.

A shared client/server heuristic checks private-key blocks, AWS keys, common API tokens, Bearer credentials, password/secret assignments, private IPv4 addresses and hash-like values. The UI offers redaction of the assistant input or explicit **Send this text anyway**; the server requires confirmation if detected values remain. Only category names appear in warnings. Detection is approximate and cannot guarantee every secret is found. Redaction does not change the editor draft; review the assistant input before sending.

The owner-only route loads up to 200 existing tags and 50 collection names from D1 as untrusted prompt context. It normalizes tags to lowercase-kebab, maps only unambiguous one-edit near-matches of at least five characters, deduplicates, caps output at six tags and at most two new tags. Collections are context only and never assigned by AI. Possible secrets in taxonomy labels are omitted. User text, hints and taxonomy are sent to OpenAI; request-local raw/model output is not stored in D1/R2/application logs. Only hashed quota counters persist until the reviewed draft is saved normally. `store:false` is not a guarantee of zero provider retention.

Provider outages/rate limits, transport failures, cancellation/timeouts, invalid output and protection failures refund the exact reserved UTC day's count. Successful responses and provider 400/other non-transient request rejections count; retries consume one reservation. A failed refund returns an explicit error rather than claiming success. Provider charges may still occur, including on cancellation or retried calls; configure and monitor your provider budget.

The optional `excerpt` is stored in existing content JSON, editable in the studio, included in Markdown exports/imports, and used by cards, feeds and social descriptions with legacy fallbacks. No migration or new dependency is needed. Existing posts are not rewritten or backfilled.

Tests use a disposable placeholder key and mocked provider fetch with real SQLite quota SQL. They cover strict output, injection isolation, literal protection, secret consent/redaction, taxonomy normalization, metadata mode, retries/refunds, timeout/cancel, owner/origin checks, and quota exhaustion. See the [Structured Outputs documentation](https://developers.openai.com/api/docs/guides/structured-outputs?api-mode=chat) for the API contract.

### Semantic search / embeddings: hosting prerequisite

Embeddings and semantic search are **not enabled**. The current Sites hosting contract exposes managed D1/R2, and the available Sites tools provide no Vectorize provisioning/binding operation. Vectorize requires a provisioned index and a Worker binding; adding an unrecognized manifest field or issuing embeddings without somewhere to store/query them would not provide a working feature. Current keyword search and tag-based related notes remain available.

When supported hosting is available, use `text-embedding-3-small` with a matching index dimension/metric, versioned content hashes, background idempotent indexing, save/publish/unpublish/delete hooks, and a bounded backfill. Keep owner-draft and public indexes isolated; re-check published visibility in D1 before returning any match. Public semantic queries need rate/cost limits and keyword fallback; studio suggestions need debounce/cancellation. Never allow stale vectors for unpublished/deleted material to disclose private content. This is a separate feature from `/api/assist`, requiring real index setup before activation. See [Cloudflare Vectorize setup](https://developers.cloudflare.com/vectorize/get-started/intro/).

Cloudflare Worker outbound calls use `redirect: manual` and reject redirect responses. This preserves fail-closed credential handling without the unsupported Fetch `error` mode. Provider and DNS-redirect regressions are covered by tests.

Reader-facing RSS buttons open `/follow`, a subscription guide with a copyable canonical feed address and clipboard fallback. Feed readers and HTML autodiscovery continue to use `/feed.xml`; the raw RSS format and subscriber URL are unchanged.
