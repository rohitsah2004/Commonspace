import { NextResponse } from 'next/server';
import { PUBLIC_CACHE, publicCacheableRequest } from './lib/cache-policy';

// Vinext's verified middleware merge owns singular response headers. Its config
// headers intentionally do not override the dynamic renderer's existing no-store.
export function proxy(request: Request) {
  const response = NextResponse.next();
  if (publicCacheableRequest(request)) response.headers.set('Cache-Control', PUBLIC_CACHE);
  return response;
}
