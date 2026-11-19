import { hash } from './mail';
const keyFor = (ownerId: string, at: number) => hash(ownerId + ':clip:' + new Date(at).toISOString().slice(0, 10));
export async function claimClipQuota(db: D1Database, ownerId: string, now = Date.now()): Promise<boolean> {
  const start = Math.floor(now / 86400000) * 86400000;
  const key = await keyFor(ownerId, now);
  const result = await db.batch([
    db.prepare('DELETE FROM rate_limits WHERE window_start < ?').bind(now - 86400000),
    db.prepare('INSERT INTO rate_limits (key,window_start,count) VALUES (?,?,1) ON CONFLICT(key) DO UPDATE SET count=count+1 WHERE count<20 RETURNING count').bind(key, start),
  ]);
  return result[1].results.length === 1;
}
export async function refundClipQuota(db: D1Database, ownerId: string, reservedAt: number): Promise<void> {
  await db.batch([db.prepare('UPDATE rate_limits SET count=count-1 WHERE key=? AND count>0').bind(await keyFor(ownerId, reservedAt))]);
}
