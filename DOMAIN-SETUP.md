# Canonical domain: blog.rohitsah.com

1. Register `blog.rohitsah.com` with the Sites host.
2. At the DNS provider for `rohitsah.com`, create the exact CNAME and TXT validation records returned by that registration. Do not reuse another site's verification values. Keep the main domain's records unchanged.
3. Wait until hostname validation and HTTPS certificate status are active. Check the subdomain loads correctly before switching canonicals.
4. Set the server environment variable `SITE_URL=https://blog.rohitsah.com` in the deployment environment. This is a public origin, not a secret. Do not put credentials in this URL.
5. The owner must redeploy a saved version to apply that environment revision. This repository upgrade does not deploy anything.
6. Verify canonical, Open Graph, sitemap, RSS, share and email links use the new origin. Leaving SITE_URL unset preserves the current Sites URL.
7. Only after canonical verification, open Medium's **Import a story** tool and import the published article using `https://blog.rohitsah.com/post/<slug>`. Check Medium's imported canonical link points back to that URL. Pasting the text into a fresh Medium story does not guarantee the original canonical is retained.

Production verification values and credentials are intentionally excluded from this repository.
