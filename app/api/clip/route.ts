import { authorizeWrite, database, json } from '../../../lib/server';
import { getChatGPTUser } from '../../chatgpt-auth';
import { clipUrl, checkClipURL, ClipError } from '../../../lib/clip-fetch';
import { clipInput } from '../../../lib/clip-content';
import { claimClipQuota, refundClipQuota } from '../../../lib/clip-quota';
async function readURL(request: Request) {
  if (Number(request.headers.get('content-length')) > 16000) throw Error();
  const reader = request.body?.getReader(); if (!reader) throw Error();
  const bytes = new Uint8Array(16000); let size = 0;
  try { while (true) { const { value, done } = await reader.read(); if (done) break; if (size + value.length > bytes.length) throw Error(); bytes.set(value, size); size += value.length; } }
  finally { await reader.cancel().catch(() => {}); reader.releaseLock(); }
  const value: unknown = JSON.parse(new TextDecoder().decode(bytes.subarray(0, size)));
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).length !== 1 || !('url' in value) || typeof value.url !== 'string') throw Error();
  return checkClipURL(value.url).href;
}
export async function POST(request: Request) {
  const denied = await authorizeWrite(request); if (denied) return denied;
  const user = await getChatGPTUser(); if (!user) return json({ error: 'Owner access required.' }, 403);
  let url: string;
  try { url = await readURL(request); }
  catch (error) { return json({ error: error instanceof ClipError ? error.message : 'Send one public HTTPS link as {"url":"https://..."}.' }, 400); }
  const reservedAt = Date.now();
  try {
    if (!await claimClipQuota(database(), user.userId, reservedAt)) {
      const response = json({ error: 'Daily link limit reached (20). Try again after midnight UTC.' }, 429);
      response.headers.set('Retry-After', String(Math.ceil((86400000 - Date.now() % 86400000) / 1000))); return response;
    }
  } catch { return json({ error: 'Link protection is unavailable. Try again later.' }, 503); }
  const controller = new AbortController(); const cancel = () => controller.abort();
  const timer = setTimeout(cancel, 15000); request.signal.addEventListener('abort', cancel, { once: true });
  if (request.signal.aborted) controller.abort();
  try { return json(clipInput(await clipUrl(url, controller.signal))); }
  catch (error) {
    try { await refundClipQuota(database(), user.userId, reservedAt); }
    catch { return json({ error: 'Link clipping failed and the quota refund could not be confirmed.' }, 503); }
    return json({ error: controller.signal.aborted ? 'The page took too long to load or the request was cancelled.' : error instanceof ClipError ? error.message : 'Could not read that page.' }, controller.signal.aborted ? 504 : error instanceof ClipError ? error.status : 502);
  } finally { clearTimeout(timer); request.signal.removeEventListener('abort', cancel); }
}
