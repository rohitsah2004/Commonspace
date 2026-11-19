import { normalizeTag } from './slug';
import { secretWarnings } from './assist-secrets';
export type AssistTaxonomy = { tags: string[]; collections: string[] };
export async function loadAssistTaxonomy(db: D1Database): Promise<AssistTaxonomy> {
  const [tags, collections] = await Promise.all([
    db.prepare("SELECT DISTINCT j.value AS tag FROM posts p, json_each(p.draft,'$.tags') j WHERE p.deleted_at IS NULL AND j.type='text' UNION SELECT DISTINCT j.value AS tag FROM posts p, json_each(p.published,'$.tags') j WHERE p.deleted_at IS NULL AND p.published IS NOT NULL AND j.type='text' ORDER BY tag LIMIT 200").all<{ tag: string }>(),
    db.prepare('SELECT name FROM collections ORDER BY name LIMIT 50').all<{ name: string }>(),
  ]);
  return { tags: [...new Set(tags.results.filter(row => !secretWarnings(row.tag).length).map(row => normalizeTag(row.tag)).filter(tag => tag && tag.length <= 40))],
    collections: collections.results.map(row => row.name.slice(0, 100)).filter(name => !secretWarnings(name).length) };
}
function oneEdit(a: string, b: string) {
  if (Math.abs(a.length - b.length) > 1) return false;
  let i = 0, j = 0, edits = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) { i++; j++; continue; }
    if (++edits > 1) return false;
    if (a.length >= b.length) i++;
    if (b.length >= a.length) j++;
  }
  return edits + Number(i < a.length || j < b.length) <= 1;
}
export function normalizeAssistTags(suggested: string[], existing: string[], maxNew = 2): string[] {
  const known = [...new Set(existing.map(normalizeTag).filter(Boolean))]; let added = 0;
  const result: string[] = [];
  for (const raw of suggested) {
    let tag = normalizeTag(raw); if (!tag || tag.length > 40) continue;
    if (!known.includes(tag)) {
      const near = known.filter(k => Math.min(k.length, tag.length) >= 5 && oneEdit(k, tag));
      if (near.length === 1) tag = near[0];
    }
    if (result.includes(tag)) continue;
    if (!known.includes(tag) && added++ >= maxNew) continue;
    result.push(tag); if (result.length === 6) break;
  }
  return result;
}
