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

On branch `codex/ai-assistant`, the studio's Markdown controls include **Format with AI**. Paste raw notes, a draft or transcript, choose Format / Polish / Outline, optionally suggest a type and up to six tags, then review Before/After. Changed or missing original fenced code blocks produce prominent warnings. **Apply to draft** uses the existing dirty/autosave/versioning path, requires confirmation before replacing nonempty text, and preserves owner-selected cover, attachments and collection. Discard, errors and cancellation leave the original draft/text unchanged. The assistant never publishes and its API never writes content. Review commands, URLs, hashes and factual claims yourself: prompts and code warnings cannot guarantee a model's factual fidelity.

Configure these only in the **Sites server environment**, then apply that environment revision when you choose to deploy:

- `OPENAI_API_KEY`: server secret. Never put it in browser code, Git, screenshots, logs or a committed environment file.
- `AI_MODEL`: required model ID chosen by the owner. There is no hardcoded/default model. Choose a model available to your account that supports Chat Completions, system/user messages and `max_completion_tokens`.
- `AI_PROVIDER`: optional, defaults to `openai`. Other values, including the documented Anthropic stub, keep the feature disabled. No alternate endpoint or arbitrary provider URL is accepted.

Owner-only GET `/api/assist` returns just `{ready:boolean}` with no-store. POST requires the existing owner/same-origin guard. Until key and model are configured, the studio control stays disabled and POST returns 503. Input is capped at 20,000 JavaScript string characters, the request envelope is bounded, output is capped at 6,000 completion tokens / 120 KB Markdown / 256 KB provider JSON, and each provider request has a 60-second deadline. An atomic D1 counter allows 30 configured, valid attempts per owner per UTC day; failed, cancelled or invalid-model-output attempts still count because they may incur cost. Invalid input/not-ready requests do not consume the quota. No migration is needed beyond the existing `rate_limits` table.

The server calls only `https://api.openai.com/v1/chat/completions` with `store:false`, bounded `max_completion_tokens`, and no tools or automatic retries. It sends the prompt, pasted text and optional hints to the configured provider. It stores neither raw text nor model output in D1, R2 or application logs; only hashed owner/day quota counters are persisted. Applying the preview later stores the reviewed draft through normal autosave. Provider-side retention/processing is governed by your provider agreement; `store:false` is not a promise of zero provider retention. Set a **monthly spend limit/budget at the provider**, and monitor usage there. Cancelling is best effort and may not stop already incurred provider charges.

Output must contain frontmatter and passes the existing Markdown import plus strict content whitelist before it can be previewed or applied. Raw HTML stays literal text, unsafe URLs cannot become active links, publishing timestamps/collection/file choices are removed, and provider errors are never echoed. Input is delimited JSON data with explicit anti-injection instructions; there is no action/tool/publish executor for model text to reach.

Adapter verified against the [official Chat Completions API reference](https://developers.openai.com/api/reference/resources/chat/subresources/completions/methods/create). `max_tokens` is deprecated, so the adapter uses the documented `max_completion_tokens` bound. Model compatibility and account access must be checked when choosing `AI_MODEL`; routine tests use mocked provider calls. A separate local Worker diagnostic with synthetic notes confirmed the adapter works in the deployed runtime. Tests use only a disposable placeholder key and mocked fetch, including provider failures, secret-echo rejection, timeout/cancel and quota exhaustion with real SQLite SQL.

Cloudflare Worker outbound calls use `redirect: manual` and reject redirect responses. This preserves fail-closed credential handling without the unsupported Fetch `error` mode. Provider and DNS-redirect regressions are covered by tests.
