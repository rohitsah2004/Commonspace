import { authorizeWrite, isOwner, json } from '../../../../lib/server';
import { checkResources, resourceChecks } from '../../../../lib/resource-check';
export async function GET() {
  if (!await isOwner()) return json({ error: 'Owner access required.' }, 403);
  return json({ resources: await resourceChecks() });
}
export async function POST(request: Request) {
  const denied = await authorizeWrite(request); if (denied) return denied;
  try { return json({ resources: await checkResources() }); }
  catch { return json({ error: 'Could not check resources.' }, 502); }
}
