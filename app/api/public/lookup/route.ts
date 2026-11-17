import { publicItems, toCard } from '../../../../lib/queries';
export async function GET(request: Request) {
  const raw = new URL(request.url).searchParams.get('ids') ?? '';
  const ids = raw ? [...new Set(raw.split(','))] : [];
  if (ids.length > 100 || ids.some(id => !/^[A-Za-z0-9-]{1,100}$/.test(id))) return Response.json({ error: 'Provide at most 100 valid IDs.' }, { status: 400 });
  const allowed = new Set(ids);
  return Response.json({ items: (await publicItems()).filter(item => allowed.has(item.row.id)).map(toCard) }, { headers: { 'Cache-Control': 'public, max-age=30' } });
}
