import { searchPublic } from '../../../lib/search';
import { CONTENT_TYPES, DIFFICULTIES, type ContentType, type Difficulty } from '../../../lib/types';

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const q = (params.get('q') ?? '').trim().slice(0, 200);
  const type = params.get('type') || undefined;
  const difficulty = params.get('difficulty') || undefined;
  if (type && !CONTENT_TYPES.includes(type as ContentType) || difficulty && !DIFFICULTIES.includes(difficulty as Difficulty)) {
    return Response.json({ error: 'Invalid content type or difficulty.' }, { status: 400 });
  }
  const limit = Math.max(1, Math.min(30, Number.parseInt(params.get('limit') ?? '8', 10) || 8));
  const results = q.length < 2 ? [] : await searchPublic({ q, type: type as ContentType | undefined,
    difficulty: difficulty as Difficulty | undefined, tags: params.getAll('tag').slice(0, 8), limit });
  // Snippets are text, never trusted markup. Escape HTML-sensitive characters even in the JSON wire representation.
  const body = JSON.stringify({ results }).replace(/</g, '\\u003c').replace(/>/g, '\\u003e').replace(/&/g, '\\u0026');
  return new Response(body, { headers: { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=30' } });
}
