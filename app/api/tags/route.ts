import { getTagCounts } from '../../../lib/queries';
export async function GET() {
  return Response.json({ tags: await getTagCounts() }, { headers: { 'Cache-Control': 'public, max-age=30' } });
}
