import { database, json } from './server';
import { validateCollectionMetadata } from './collection-metadata';

type Input = Record<string, unknown>;
function identifier(value: unknown): string {
  if (typeof value !== 'string' || !/^[A-Za-z0-9-]{1,100}$/.test(value)) throw Error('Invalid collection ID.');
  return value;
}

/** Called only after authorizeWrite; batch operations retain CAS and snapshot isolation. */
export async function manageCollection(input: Input): Promise<Response | null> {
  if (!['updateCollection', 'deleteCollection', 'reorderCollection'].includes(String(input.action))) return null;
  const db = database(); const id = identifier(input.id);
  if (!await db.prepare('SELECT id FROM collections WHERE id=?').bind(id).first()) return json({ error: 'Collection not found.' }, 404);
  if (input.action === 'deleteCollection') {
    await db.batch([
      db.prepare('DELETE FROM collections WHERE id=?').bind(id),
      db.prepare('DELETE FROM settings WHERE key=?').bind('collection:' + id),
      db.prepare("UPDATE settings SET value=json_set(value,'$.featuredCollection','') WHERE key='site' AND json_extract(value,'$.featuredCollection')=?").bind(id),
    ]);
    return json({ ok: true });
  }
  if (input.action === 'updateCollection') {
    if (typeof input.name !== 'string' || !input.name.trim() || input.name.length > 100 || typeof input.description !== 'string' || input.description.length > 1000) throw Error('Invalid collection name or description.');
    const metadata = validateCollectionMetadata(input);
    await db.batch([
      db.prepare('UPDATE collections SET name=?,description=? WHERE id=?').bind(input.name.trim(), input.description.trim(), id),
      db.prepare('INSERT INTO settings (key,value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').bind('collection:' + id, JSON.stringify(metadata)),
    ]);
    return json({ ok: true });
  }
  if (!Array.isArray(input.postIds) || !input.postIds.length || input.postIds.length > 100 || new Set(input.postIds).size !== input.postIds.length) throw Error('Provide 1–100 unique post IDs.');
  const versions = input.versions;
  if (!versions || typeof versions !== 'object' || Array.isArray(versions)) throw Error('Post versions are required. Reload the collection before reordering.');
  const expected = input.postIds.map(value => {
    const postId = identifier(value); const version = (versions as Record<string, unknown>)[postId];
    if (!Number.isSafeInteger(version) || Number(version) < 1) throw Error('A post version is missing.');
    return { id: postId, version };
  });
  const serialized = JSON.stringify(expected); const count = expected.length; const now = Date.now();
  const cte = `WITH expected AS (SELECT json_extract(value,'$.id') AS id,json_extract(value,'$.version') AS version,CAST(key AS INTEGER) AS position FROM json_each(?)),eligible AS MATERIALIZED (SELECT p.id,p.draft,p.version,e.position FROM posts p JOIN expected e ON p.id=e.id AND p.version=e.version WHERE p.deleted_at IS NULL AND json_extract(p.draft,'$.series')=?)`;
  const snapshot = db.prepare(cte + ` INSERT INTO revisions (id,post_id,content,version,created_at) SELECT lower(hex(randomblob(16))),id,draft,version,? FROM eligible WHERE (SELECT COUNT(*) FROM eligible)=?`).bind(serialized, id, now, count);
  // Position-only edits apply independently to draft/live/scheduled snapshots. No draft body is published here.
  const update = db.prepare(cte + ` UPDATE posts SET draft=json_set(draft,'$.position',(SELECT position FROM eligible e WHERE e.id=posts.id)),published=CASE WHEN json_extract(published,'$.series')=? THEN json_set(published,'$.position',(SELECT position FROM eligible e WHERE e.id=posts.id)) ELSE published END,scheduled=CASE WHEN json_extract(scheduled,'$.series')=? THEN json_set(scheduled,'$.position',(SELECT position FROM eligible e WHERE e.id=posts.id)) ELSE scheduled END,updated_at=?,version=version+1 WHERE id IN (SELECT id FROM eligible) AND (SELECT COUNT(*) FROM eligible)=?`).bind(serialized, id, id, id, now, count);
  const results = await db.batch([snapshot, update]);
  if (results[1].meta.changes !== count) return json({ error: 'A collection item changed. Reload before reordering.' }, 409);
  return json({ ok: true });
}
