import { authorizeWrite, json } from '../../../lib/server';
import { sendDigest } from '../../../lib/digest';
export async function POST(request: Request) {
  const denied = await authorizeWrite(request); if (denied) return denied;
  try { return await sendDigest(); } catch { return json({ error: 'Digest delivery failed. Retry to resume the same batch safely.' }, 502); }
}
