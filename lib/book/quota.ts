import { hash } from '../mail';
export async function claimBookQuota(db: D1Database, owner: string, scope: 'assist-book' | 'book-fetch', at = Date.now()) {
    const key = await hash(owner + ':' + scope + ':' + new Date(at).toISOString().slice(0, 10));
    const start = Math.floor(at / 86400000) * 86400000, limit = scope === 'assist-book' ? 150 : 20;
    const result = await db.batch([
        db.prepare('DELETE FROM rate_limits WHERE window_start < ?').bind(at - 86400000),
        db.prepare('INSERT INTO rate_limits (key,window_start,count) VALUES (?,?,1) ON CONFLICT(key) DO UPDATE SET count=count+1 WHERE count<? RETURNING count').bind(key, start, limit),
    ]);
    return { key, claimed: result[1].results.length === 1 };
}
export async function refundBookQuota(db: D1Database, key: string) {
    await db.batch([db.prepare('UPDATE rate_limits SET count=count-1 WHERE key=? AND count>0').bind(key)]);
}
