import { listPublic, publicItems } from './queries';
import { getProfile, getSiteSettings, siteUrl } from './server';
import { CONTENT_TYPES, type ContentType } from './types';
import { escapeHTML, feedHTML } from './html';
import { snapshotModified } from './snapshot';
import { PUBLIC_CACHE } from './cache-policy';

const xml = escapeHTML;
const cdata = (value: string) => '<![CDATA[' + value.replace(/\]\]>/g, ']]]]><![CDATA[>') + ']]>';
async function selected(request: Request) {
  const url = new URL(request.url); const type = url.searchParams.get('type');
  if (type && !CONTENT_TYPES.includes(type as ContentType)) throw Error('Unknown feed type.');
  const rows = await publicItems();
  return (await listPublic({ type: type as ContentType | undefined, tags: url.searchParams.getAll('tag') }, rows)).items;
}
async function response(request: Request, body: string, contentType: string) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(body));
  const etag = '"' + [...new Uint8Array(digest)].map(n => n.toString(16).padStart(2, '0')).join('') + '"';
  const headers = { ETag: etag, 'Cache-Control': PUBLIC_CACHE, 'Content-Type': contentType };
  return request.headers.get('if-none-match') === etag ? new Response(null, { status: 304, headers }) : new Response(body, { headers });
}
export async function rss(request: Request): Promise<Response> {
  try {
    const items = await selected(request); const profile = await getProfile(); const site = await getSiteSettings(); const origin = siteUrl();
    const self = origin + '/feed.xml' + new URL(request.url).search;
    const body = `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0" xmlns:content="http://purl.org/rss/1.0/modules/content/" xmlns:atom="http://www.w3.org/2005/Atom"><channel><title>${xml(site.title)} — ${xml(profile.name)}</title><link>${origin}</link><description>${xml(profile.bio)}</description><atom:link href="${xml(self)}" rel="self" type="application/rss+xml"/>${items.map(item => {
      const c = item.content; const url = origin + '/post/' + item.row.slug;
      return `<item><title>${xml(c.title)}</title><link>${url}</link><guid isPermaLink="true">${url}</guid><description>${xml(c.subtitle)}</description><pubDate>${new Date(item.row.published_at).toUTCString()}</pubDate>${c.tags.map(tag => `<category>${xml(tag)}</category>`).join('')}<content:encoded>${cdata(feedHTML(c, origin))}</content:encoded></item>`;
    }).join('')}</channel></rss>`;
    return response(request, body, 'application/rss+xml; charset=utf-8');
  } catch { return Response.json({ error: 'Invalid feed filters.' }, { status: 400 }); }
}
export async function jsonFeed(request: Request): Promise<Response> {
  try {
    const items = await selected(request); const profile = await getProfile(); const site = await getSiteSettings(); const origin = siteUrl();
    const body = JSON.stringify({ version: 'https://jsonfeed.org/version/1.1', title: site.title,
      home_page_url: origin, feed_url: origin + '/feed.json' + new URL(request.url).search, description: profile.bio,
      authors: [{ name: profile.name, url: origin + '/about' }],
      items: items.map(item => ({ id: origin + '/post/' + item.row.slug, url: origin + '/post/' + item.row.slug,
        title: item.content.title, content_html: feedHTML(item.content, origin), summary: item.content.subtitle,
        date_published: new Date(item.row.published_at).toISOString(), date_modified: new Date(snapshotModified(item)).toISOString(),
        tags: item.content.tags, ...(item.content.cover ? { image: new URL(item.content.cover, origin).href } : {}) })),
    });
    return response(request, body, 'application/feed+json; charset=utf-8');
  } catch { return Response.json({ error: 'Invalid feed filters.' }, { status: 400 }); }
}
