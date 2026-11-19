import { CONTENT_TYPES, DIFFICULTIES } from './types';

export const ASSIST_RESULT_SCHEMA = {
  type: 'object', additionalProperties: false,
  required: ['title', 'subtitle', 'excerpt', 'type', 'difficulty', 'tags', 'markdown'],
  properties: {
    title: { type: 'string' }, subtitle: { type: 'string' }, excerpt: { type: 'string' },
    type: { type: 'string', enum: CONTENT_TYPES }, difficulty: { type: 'string', enum: DIFFICULTIES },
    tags: { type: 'array', items: { type: 'string' }, maxItems: 6 }, markdown: { type: 'string' },
  },
} as const;
export type AssistResult = {
  title: string; subtitle: string; excerpt: string; type: typeof CONTENT_TYPES[number];
  difficulty: typeof DIFFICULTIES[number]; tags: string[]; markdown: string;
};
export function validateAssistResult(input: unknown): AssistResult {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw Error('Invalid AI JSON.');
  const value = input as Record<string, unknown>;
  const keys = ASSIST_RESULT_SCHEMA.required;
  if (Object.keys(value).length !== keys.length || keys.some(key => !Object.hasOwn(value, key))) throw Error('Invalid AI JSON fields.');
  for (const [key, limit] of [['title', 200], ['subtitle', 500], ['excerpt', 500], ['markdown', 120000]] as const) {
    if (typeof value[key] !== 'string' || value[key].length > limit) throw Error('Invalid AI ' + key);
  }
  if (!(value.title as string).trim() || !CONTENT_TYPES.includes(value.type as never) || !DIFFICULTIES.includes(value.difficulty as never)
    || !Array.isArray(value.tags) || value.tags.length > 6 || value.tags.some(t => typeof t !== 'string' || t.length > 40)) throw Error('Invalid AI metadata.');
  return value as AssistResult;
}

export const ASSIST_METADATA_SCHEMA = {
  type: 'object', additionalProperties: false, required: ['tags', 'excerpt'],
  properties: { tags: ASSIST_RESULT_SCHEMA.properties.tags, excerpt: { type: 'string' } },
} as const;
export function validateAssistMetadata(input: unknown): { tags: string[]; excerpt: string } {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw Error('Invalid AI metadata.');
  const value = input as Record<string, unknown>;
  if (Object.keys(value).length !== 2 || !Array.isArray(value.tags) || value.tags.length > 6
    || value.tags.some(t => typeof t !== 'string' || t.length > 40)
    || typeof value.excerpt !== 'string' || value.excerpt.length > 500
    || JSON.stringify(value).includes('⟦KEEP_')) throw Error('Invalid AI metadata.');
  return value as { tags: string[]; excerpt: string };
}
