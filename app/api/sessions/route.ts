import { json } from '../../../lib/server';
import { sessionRequest } from '../../../lib/session-server';
import { sessionJSON, sessionFields, SessionError } from '../../../lib/session-input';
export async function GET(request: Request) {
  return sessionRequest(request, false, async (owner, db) => {
    const raw = new URL(request.url).searchParams.get('offset') || '0';
    if (!/^\d{1,7}$/.test(raw)) throw new SessionError('Invalid page.');
    const rows = await db.prepare('SELECT id,name,platform,difficulty,status,created_at,updated_at FROM sessions WHERE owner_id=? ORDER BY updated_at DESC,id LIMIT 51 OFFSET ?').bind(owner, Number(raw)).all();
    return json({ sessions: rows.results.slice(0, 50), hasMore: rows.results.length > 50 });
  });
}
export async function POST(request: Request) {
  return sessionRequest(request, true, async (owner, db) => {
    const value = sessionFields(await sessionJSON(request)); const id = crypto.randomUUID(), now = Date.now();
    await db.prepare('INSERT INTO sessions (id,owner_id,name,platform,difficulty,status,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?)').bind(id, owner, value.name, value.platform, value.difficulty, value.status, now, now).run();
    return json({ session: { id, name: value.name, platform: value.platform, difficulty: value.difficulty, status: value.status, created_at: now, updated_at: now } }, 201);
  });
}
