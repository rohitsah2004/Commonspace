import { database, isOwner, publicRows } from './server';
import { parseRows } from './queries';
import { checkHTTPS, type LinkStatus } from './safe-link-check';
export type ResourceCheck = { id: string; title: string; url: string; lastChecked?: number; status?: LinkStatus; code?: number };
export async function resourceChecks(): Promise<ResourceCheck[]> {
  if (!await isOwner()) throw Error('Owner access required.');
  const rows = await database().prepare("SELECT key,value FROM settings WHERE key LIKE 'resource:%'").all<{key:string;value:string}>();
  const checks = new Map(rows.results.map(row => [row.key.slice(9), JSON.parse(row.value) as { lastChecked:number;status:LinkStatus;code?:number;url:string }]));
  return parseRows(await publicRows()).filter(item => item.content.type === 'resource').map(item => {
    const old = checks.get(item.row.id); const url = item.content.resourceUrl!;
    return { id: item.row.id, title: item.content.title, url, ...(old?.url === url ? old : {}) };
  });
}
export async function checkResources() {
  const rows = await resourceChecks();
  // Oldest unchecked/checked first so repeated explicit runs cover every item, 20 maximum each time.
  const batch = [...rows].sort((a,b) => (a.lastChecked || 0) - (b.lastChecked || 0)).slice(0,20);
  const results: ResourceCheck[] = [];
  for (const item of batch) {
    const check = await checkHTTPS(item.url);
    const value = { url: item.url, lastChecked: Date.now(), ...check };
    await database().prepare('INSERT INTO settings (key,value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').bind('resource:' + item.id, JSON.stringify(value)).run();
    results.push({ ...item, ...value });
  }
  return results;
}
