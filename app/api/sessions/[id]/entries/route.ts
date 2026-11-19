import { json } from '../../../../../lib/server';
import { sessionRequest, requireSession, touchSession } from '../../../../../lib/session-server';
import { sessionJSON, entryFields, fields, sessionID, SessionError } from '../../../../../lib/session-input';
type Context = { params: Promise<{ id: string }> };
export async function POST(request: Request, context: Context) {
  return sessionRequest(request, true, async (owner, db) => {
    const { id } = await context.params; await requireSession(db, owner, id);
    const value = entryFields(await sessionJSON(request)); const entryId = crypto.randomUUID(), now = Date.now();
    const entry = await db.prepare('INSERT INTO session_entries (id,session_id,owner_id,type,phase,content,created_at) SELECT ?,?,?,?,?,?,MAX(?,(SELECT COALESCE(MAX(created_at)+1,?) FROM session_entries WHERE session_id=? AND owner_id=?)) WHERE EXISTS (SELECT 1 FROM sessions WHERE id=? AND owner_id=?) AND (SELECT COUNT(*) FROM session_entries WHERE session_id=? AND owner_id=?)<500 RETURNING id,session_id,type,phase,content,created_at').bind(entryId, id, owner, value.type, value.phase ?? 'other', value.content, now, now, id, owner, id, owner, id, owner).first();
    if (!entry) { await requireSession(db, owner, id); throw new SessionError('This session has 500 entries. Delete an entry before adding another.', 409); }
    await touchSession(db, owner, id); return json({ entry }, 201);
  });
}
export async function PATCH(request: Request, context: Context) {
  return sessionRequest(request, true, async (owner, db) => {
    const { id } = await context.params; await requireSession(db, owner, id);
    const value = entryFields(await sessionJSON(request), true); const entryId = sessionID(typeof value.id === 'string' ? value.id : '');
    const entry = await db.prepare('UPDATE session_entries SET type=COALESCE(?,type),phase=COALESCE(?,phase),content=COALESCE(?,content) WHERE id=? AND session_id=? AND owner_id=? RETURNING id,session_id,type,phase,content,created_at').bind(value.type ?? null, value.phase ?? null, value.content ?? null, entryId, id, owner).first();
    if (!entry) throw new SessionError('Entry not found.', 404);
    await touchSession(db, owner, id); return json({ entry });
  });
}
export async function DELETE(request: Request, context: Context) {
  return sessionRequest(request, true, async (owner, db) => {
    const { id } = await context.params; await requireSession(db, owner, id);
    const value = await sessionJSON(request); fields(value, ['id']); const entryId = sessionID(typeof value.id === 'string' ? value.id : '');
    const deleted = await db.prepare('DELETE FROM session_entries WHERE id=? AND session_id=? AND owner_id=? RETURNING id').bind(entryId, id, owner).first();
    if (!deleted) throw new SessionError('Entry not found.', 404);
    await touchSession(db, owner, id); return json({ deleted: true });
  });
}
