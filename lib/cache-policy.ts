// Public HTML has no request identity or private payloads. Fresh CDN responses have
// a 60-second TTL; scheduled visibility is evaluated at origin query time. SWR may
// serve stale HTML for up to 300 additional seconds while revalidating: this is not
// a hard 60-second publication deadline. Use no-store if exact-time freshness is required.
export const PUBLIC_CACHE = 'public, s-maxage=60, stale-while-revalidate=300';
export const PUBLIC_PATHS = ['/', '/about', '/posts', '/notes', '/cheatsheets', '/resources', '/tags', '/tags/:tag', '/post/:slug', '/collections', '/collections/:slug', '/feed.xml', '/sitemap.xml'];

export function publicCacheableRequest(request: Request): boolean {
  if (!['GET', 'HEAD'].includes(request.method) || request.headers.has('rsc') || request.headers.has('next-router-prefetch')) return false;
  const path = new URL(request.url).pathname;
  return ['/', '/about', '/posts', '/notes', '/cheatsheets', '/resources', '/tags', '/collections', '/feed.xml', '/sitemap.xml'].includes(path)
    || /^\/(post|tags|collections)\/[^/]+$/.test(path);
}
