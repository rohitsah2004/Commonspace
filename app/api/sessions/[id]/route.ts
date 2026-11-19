import { json } from '../../../../lib/server';
import { sessionRequest, requireSession } from '../../../../lib/session-server';
import { sessionJSON, sessionFields, SessionError } from '../../../../lib/session-input';
type Context = { params: Promise<{ id: string }> };
export async function GET(request: Request, context: Context) {
  return sessionRequest(request, false, async (owner, db) => {
    const { id } = await context.params; const session = await requireSession(db, owner, id);
    const entries = await db.prepare('SELECT id,session_id,type,phase,content,created_at FROM session_entries WHERE session_id=? AND owner_id=? ORDER BY created_at,id').bind(id, owner).all();
    return json({ session, entries: entries.results });
  });
}
export async function PATCH(request: Request, context: Context) {
  return sessionRequest(request, true, async (owner, db) => {
    const { id } = await context.params; await requireSession(db, owner, id);
    const value = sessionFields(await sessionJSON(request), true);
    const session = await db.prepare('UPDATE sessions SET name=COALESCE(?,name),platform=COALESCE(?,platform),difficulty=COALESCE(?,difficulty),status=COALESCE(?,status),updated_at=? WHERE id=? AND owner_id=? RETURNING id,name,platform,difficulty,status,created_at,updated_at').bind(value.name ?? null, value.platform ?? null, value.difficulty ?? null, value.status ?? null, Date.now(), id, owner).first();
    if (!session) throw new SessionError('Session not found.', 404);
    return json({ session });
  });
}
export async function DELETE(request: Request, context: Context) {
  return sessionRequest(request, true, async (owner, db) => {
    const { id } = await context.params; await requireSession(db, owner, id);
    await db.prepare('DELETE FROM sessions WHERE id=? AND owner_id=?').bind(id, owner).run();
    return json({ deleted: true });
  });
}
