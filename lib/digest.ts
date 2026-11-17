import { database, publicRows, siteUrl, getSiteSettings } from './server';
import { parseRows } from './queries';
import { TYPE_LABELS, CONTENT_TYPES } from './types';
import { emailReady, hash, mail } from './mail';
import { env } from 'cloudflare:workers';

type Digest = { id: string; through: number; text: string; subject: string };
export async function sendDigest() {
  if (!emailReady()) return Response.json({ error: 'Connect email delivery first.' }, { status: 503 });
  const db = database();
  let active = await db.prepare("SELECT value FROM settings WHERE key='digest:active'").first<{value:string}>();
  if (!active) {
    const last = await db.prepare("SELECT value FROM settings WHERE key='digest:last'").first<{value:string}>();
    const since = Number(last?.value || 0); const through = Date.now();
    const items = parseRows(await publicRows()).filter(item => item.row.published_at > since && item.row.published_at <= through);
    if (!items.length) return Response.json({ sent: 0, more: false, message: 'No newly published items since the last digest.' });
    const site = await getSiteSettings();
    const groups = CONTENT_TYPES.map(type => {
      const selected = items.filter(item => (item.content.type || 'post') === type);
      return selected.length ? TYPE_LABELS[type].plural + '\n\n' + selected.map(item => item.content.title + '\n' + (item.content.subtitle || item.content.takeaway || '') + '\n' + siteUrl() + '/post/' + item.row.slug).join('\n\n') : '';
    }).filter(Boolean).join('\n\n');
    const digest: Digest = { id: 'digest-' + crypto.randomUUID(), through,
      subject: site.title + ' — knowledge digest', text: site.title + '\n\n' + groups };
    // First writer wins: retries and concurrent requests use the same frozen content/idempotency keys.
    await db.prepare("INSERT OR IGNORE INTO settings (key,value) VALUES ('digest:active',?)").bind(JSON.stringify(digest)).run();
    active = await db.prepare("SELECT value FROM settings WHERE key='digest:active'").first<{value:string}>();
  }
  if (!active) throw Error('Digest unavailable.');
  const digest = JSON.parse(active.value) as Digest;
  const pending = await db.prepare("SELECT id,email FROM subscribers WHERE status='confirmed' AND created_at<=? AND id NOT IN (SELECT subscriber_id FROM deliveries WHERE post_id=?) ORDER BY id LIMIT 10").bind(digest.through, digest.id).all<{id:string;email:string}>();
  let sent = 0;
  for (const subscriber of pending.results) {
    const token = subscriber.id + '.' + await hash('unsubscribe:' + subscriber.id + ':' + (env as {RESEND_API_KEY?:string}).RESEND_API_KEY);
    await mail(subscriber.email, digest.subject, digest.text + '\n\nUnsubscribe: ' + siteUrl() + '/subscription?unsubscribe=1&token=' + token, digest.id + '-' + subscriber.id);
    await db.prepare('INSERT OR IGNORE INTO deliveries (id,post_id,subscriber_id,sent_at) VALUES (?,?,?,?)').bind(digest.id + '-' + subscriber.id, digest.id, subscriber.id, Date.now()).run();
    sent++;
  }
  const remaining = await db.prepare("SELECT id FROM subscribers WHERE status='confirmed' AND created_at<=? AND id NOT IN (SELECT subscriber_id FROM deliveries WHERE post_id=?) LIMIT 1").bind(digest.through, digest.id).first();
  if (!remaining) {
    await db.batch([
      db.prepare("INSERT INTO settings (key,value) SELECT 'digest:last',? WHERE EXISTS (SELECT 1 FROM settings WHERE key='digest:active' AND value=?) ON CONFLICT(key) DO UPDATE SET value=excluded.value WHERE CAST(settings.value AS INTEGER)<CAST(excluded.value AS INTEGER)").bind(String(digest.through), active.value),
      db.prepare("DELETE FROM settings WHERE key='digest:active' AND value=?").bind(active.value),
    ]);
  }
  return Response.json({ sent, more: !!remaining, digest: digest.id }, { headers: { 'Cache-Control': 'no-store' } });
}
