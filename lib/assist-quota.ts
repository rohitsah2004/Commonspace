import { hash } from './mail';
export async function claimAssistQuota(db: D1Database, ownerId: string, now = Date.now()): Promise<boolean> {
  const start = Math.floor(now / 86400000) * 86400000;
  const day = new Date(start).toISOString().slice(0, 10);
  const key = await hash(ownerId + ':assist:' + day);
  const result = await db.batch([
    db.prepare('DELETE FROM rate_limits WHERE window_start < ?').bind(now - 86400000),
    db.prepare('INSERT INTO rate_limits (key,window_start,count) VALUES (?,?,1) ON CONFLICT(key) DO UPDATE SET count=count+1 WHERE count<30 RETURNING count').bind(key, start),
  ]);
  return result[1].results.length === 1;
}

/** Refund the exact reservation's UTC day, even if the call crosses midnight. */
export async function refundAssistQuota(db: D1Database, ownerId: string, reservedAt: number): Promise<void> {
  const day = new Date(reservedAt).toISOString().slice(0, 10);
  const key = await hash(ownerId + ':assist:' + day);
  await db.batch([db.prepare('UPDATE rate_limits SET count=count-1 WHERE key=? AND count>0').bind(key)]);
}
