import { ENTRY_TYPES, SESSION_PHASES, SESSION_TEXT_LIMIT } from './session-types';
export class SessionError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}
export function sessionID(value: string) {
  if (!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(value)) throw new SessionError('Invalid session or entry ID.');
  return value;
}
export async function sessionJSON(request: Request): Promise<Record<string, unknown>> {
  const max = 130000;
  if (Number(request.headers.get('content-length')) > max) throw new SessionError('Request too large.', 413);
  const reader = request.body?.getReader(); if (!reader) throw new SessionError('Provide a JSON object.');
  const bytes = new Uint8Array(max); let size = 0;
  try {
    while (true) {
      const { value, done } = await reader.read(); if (done) break;
      if (size + value.length > max) throw new SessionError('Request too large.', 413);
      bytes.set(value, size); size += value.length;
    }
  } finally { await reader.cancel().catch(() => {}); reader.releaseLock(); }
  let value: unknown;
  try { value = JSON.parse(new TextDecoder().decode(bytes.subarray(0, size))); } catch { throw new SessionError('Provide valid JSON.'); }
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new SessionError('Provide a JSON object.');
  return value as Record<string, unknown>;
}
export function fields(value: Record<string, unknown>, allowed: string[]) {
  if (!Object.keys(value).length || Object.keys(value).some(k => !allowed.includes(k))) throw new SessionError('Invalid fields.');
}
export function sessionFields(value: Record<string, unknown>, partial = false): Record<string, unknown> {
  fields(value, ['name', 'platform', 'difficulty', 'status']);
  if ((!partial || value.name !== undefined) && (typeof value.name !== 'string' || !value.name.trim() || value.name.length > 200)) throw new SessionError('Use a session name of 1–200 characters.');
  if ((!partial || value.platform !== undefined) && (typeof value.platform !== 'string' || value.platform.length > 100)) throw new SessionError('Use a platform of up to 100 characters.');
  if ((!partial || value.difficulty !== undefined) && (typeof value.difficulty !== 'string' || !['beginner', 'intermediate', 'advanced'].includes(value.difficulty))) throw new SessionError('Choose a difficulty.');
  if ((!partial || value.status !== undefined) && (typeof value.status !== 'string' || !['active', 'done'].includes(value.status))) throw new SessionError('Choose active or done.');
  return { ...value, ...(typeof value.name === 'string' ? { name: value.name.trim() } : {}) };
}
export function entryFields(value: Record<string, unknown>, partial = false) {
  fields(value, partial ? ['id', 'type', 'phase', 'content'] : ['type', 'phase', 'content']);
  if (partial && Object.keys(value).every(k => k === 'id')) throw new SessionError('Provide an entry change.');
  if ((!partial || value.type !== undefined) && !ENTRY_TYPES.includes(value.type as never)) throw new SessionError('Choose an entry type.');
  if (value.phase !== undefined && !SESSION_PHASES.includes(value.phase as never)) throw new SessionError('Choose a phase.');
  if ((!partial || value.content !== undefined) && (typeof value.content !== 'string' || !value.content.trim() || value.content.length > SESSION_TEXT_LIMIT)) throw new SessionError('Use 1–20,000 characters.');
  // Intentionally do not trim/normalize entry content.
  return value;
}
