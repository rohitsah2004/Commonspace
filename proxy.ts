import {THEME_HASH} from './lib/theme';
import { NextResponse } from 'next/server';
import { PUBLIC_CACHE, publicCacheableRequest } from './lib/cache-policy';

// Vinext's verified middleware merge owns singular response headers. Its config
// headers intentionally do not override the dynamic renderer's existing no-store.
export function proxy(request: Request) {
  // Vinext excludes dot-prefixed app directories. Rewrite this standard URL to a normal route.
  const response = new URL(request.url).pathname === '/.well-known/security.txt'
    ? NextResponse.rewrite(new URL('/api/security-contact', request.url)) : NextResponse.next();
  if (publicCacheableRequest(request)) response.headers.set('Cache-Control', PUBLIC_CACHE);
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=(), usb=()');
  response.headers.set('Cross-Origin-Opener-Policy', 'same-origin');
  response.headers.set('Content-Security-Policy-Report-Only', `default-src 'self'; img-src 'self' data: https:; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline' '${THEME_HASH}'; frame-ancestors 'self'; base-uri 'self'; form-action 'self'`);
  // HSTS belongs to the HTTPS hosting edge; do not duplicate an unverified platform policy.
  return response;
}
