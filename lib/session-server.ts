import { authorizeWrite, isOwner, database, json } from './server';
import { getChatGPTUser } from '../app/chatgpt-auth';
import { SessionError, sessionID } from './session-input';
export async function sessionRequest(request: Request, write: boolean, work: (owner: string, db: D1Database) => Promise<Response>) {
  try {
    if (write) { const denied = await authorizeWrite(request); if (denied) return denied; }
    else if (!await isOwner()) return json({ error: 'Owner access required.' }, 403);
    const user = await getChatGPTUser(); if (!user) return json({ error: 'Owner access required.' }, 403);
    return await work(user.userId, database());
  }
  catch (error) { return json({ error: error instanceof SessionError ? error.message : 'Session storage is unavailable. Try again.' }, error instanceof SessionError ? error.status : 503); }
}
export async function requireSession(db: D1Database, owner: string, id: string) {
  sessionID(id);
  const row = await db.prepare('SELECT id,name,platform,difficulty,status,created_at,updated_at FROM sessions WHERE id=? AND owner_id=?').bind(id, owner).first();
  if (!row) throw new SessionError('Session not found.', 404);
  return row;
}
export async function touchSession(db: D1Database, owner: string, id: string) {
  await db.prepare('UPDATE sessions SET updated_at=? WHERE id=? AND owner_id=?').bind(Date.now(), id, owner).run();
}
