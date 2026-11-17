# Security

Only the pinned owner can manage content, exports, uploads, subscribers and settings. Owner mutations require a same-origin request plus Sites authentication. Public confirmation/unsubscribe mutations instead require a valid secret token and same origin. Public subscription and analytics endpoints require same origin and are rate limited; public search is rate limited too.

Stored documents use a strict tag/attribute/protocol whitelist. Renderers escape text; JSON-LD escapes `<`. Public query helpers exclude private/deleted snapshots. Public HTML never includes owner identity or controls; `/api/me` and owner routes are no-store. Remote resource images/favicons are never fetched. Fonts are self-hosted. Reader-supplied external images in owner-authored documents may still request their explicit HTTPS host.

Analytics stores hashed browser-session/article/day IDs, not raw IPs. Rate-limit counters store salted SHA-256 client identifiers and expire opportunistically after 24 hours. Configure RATE_LIMIT_SALT with at least 32 random characters; missing configuration fails closed (503). Cloudflare must be the trusted ingress overwriting CF-Connecting-IP; never expose an origin that accepts spoofed ingress headers.

JPEG uploads remove APP1 metadata, including EXIF/GPS and XMP. Other image formats are preserved; metadata stripping for those formats is not promised.

Security headers are set by Vinext proxy middleware. CSP is report-only to preserve Sites embedding. Before enforcement: collect violations in a staging deployment, inventory Sites parent origins and auth/frame/connect/script needs, allow only verified origins, replace inline framework script allowances with supported nonces/hashes, and verify login, preview, editor, clipboard and Sites iframe. Then rename the header to Content-Security-Policy. Do not add X-Frame-Options DENY. Verify the hosting edge's HSTS before adding any app HSTS header.

Report issues privately using the configured `/.well-known/security.txt` contact. Until a contact is configured, that route returns 404; do not publish sensitive reports in public GitHub issues.

No production data or live external delivery is used by the loopback test suite.

The owner-only resource checker uses HEAD, HTTPS/443 only, no credentials, a shared 5-second deadline per URL, up to three redirects, and 20 URLs per explicit run. Each hop is checked with trusted DNS-over-HTTPS for both address families and fails closed for private/reserved answers. Only status/code/time are stored. Worker fetch does its own DNS lookup: application code cannot pin the resolved socket, so DNS rebinding protection also depends on the hosting platform's outbound network isolation. Keep that isolation enabled; do not port this checker to an unrestricted server without address-pinned transport. External DNS/HEAD requests occur only on the owner's explicit check action.
