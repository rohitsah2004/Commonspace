import { env } from 'cloudflare:workers';
import { database } from './server';
import { hash } from './mail';

const policies = { search: [60, 60], analytics: [120, 60], subscribe: [5, 600] } as const;
export async function rateLimit(request: Request, scope: keyof typeof policies): Promise<Response | null> {
  const salt = env.RATE_LIMIT_SALT;
  if (!salt || salt.length < 32) return Response.json({ error: 'Public request protection is not configured.' }, { status: 503, headers: { 'Cache-Control': 'no-store' } });
  // CF-Connecting-IP is overwritten by Cloudflare at the trusted ingress. Never use X-Forwarded-For.
  // Loopback has one shared identity; changing client headers cannot bypass local limits.
  const host = new URL(request.url).hostname;
  const ip = host === '127.0.0.1' || host === 'localhost' ? 'loopback' : request.headers.get('cf-connecting-ip');
  if (!ip) return Response.json({ error: 'Trusted client address unavailable.' }, { status: 503 });
  const [limit, seconds] = policies[scope]; const now = Date.now();
  const start = Math.floor(now / (seconds * 1000)) * seconds * 1000;
  const key = await hash(salt + ':' + scope + ':' + ip) + ':' + start;
  const db = database();
  const results = await db.batch([
    db.prepare('DELETE FROM rate_limits WHERE window_start < ?').bind(now - 86400000),
    db.prepare('INSERT INTO rate_limits (key,window_start,count) VALUES (?,?,1) ON CONFLICT(key) DO UPDATE SET count=count+1 RETURNING count').bind(key, start),
  ]);
  const count = Number((results[1].results[0] as { count: number }).count);
  return count > limit ? Response.json({ error: 'Too many requests. Please try again shortly.' }, { status: 429,
    headers: { 'Retry-After': String(Math.max(1, Math.ceil((start + seconds * 1000 - now) / 1000))), 'Cache-Control': 'no-store' } }) : null;
}
