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
