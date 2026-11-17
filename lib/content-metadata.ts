import { CONTENT_TYPES, DIFFICULTIES, RESOURCE_KINDS, type ContentMetadata } from './types';

export function validateMetadata(
  input: Record<string, unknown>,
  safeURL: (value: string) => string,
): ContentMetadata {
  const type = input.type === undefined ? 'post' : input.type;
  if (!CONTENT_TYPES.includes(type as never)) throw Error('Unknown content type.');
  const difficulty = input.difficulty ?? '';
  if (difficulty !== '' && !DIFFICULTIES.includes(difficulty as never)) {
    throw Error('Unknown difficulty.');
  }
  const metadata: ContentMetadata = { type: type as ContentMetadata['type'], difficulty: difficulty as ContentMetadata['difficulty'] };
  if (input.reviewedAt !== undefined) {
    if (typeof input.reviewedAt !== 'number' || !Number.isSafeInteger(input.reviewedAt)
      || input.reviewedAt < Date.UTC(2000, 0, 1) || input.reviewedAt > Date.now() + 86400000) {
      throw Error('Last reviewed must be a valid date, no later than tomorrow.');
    }
    metadata.reviewedAt = input.reviewedAt;
  }
  if (type === 'resource') {
    if (typeof input.resourceUrl !== 'string' || input.resourceUrl.length > 2048) {
      throw Error('Resources need an HTTPS URL.');
    }
    const url = safeURL(input.resourceUrl);
    if (!url || new URL(url).protocol !== 'https:' || new URL(url).username || new URL(url).password) {
      throw Error('Resources need an HTTPS URL without embedded credentials.');
    }
    if (input.takeaway !== undefined && (typeof input.takeaway !== 'string' || input.takeaway.length > 280)) {
      throw Error('Keep the resource takeaway within 280 characters.');
    }
    const kind = input.resourceKind ?? 'other';
    if (!RESOURCE_KINDS.includes(kind as never)) throw Error('Unknown resource kind.');
    metadata.resourceUrl = url;
    metadata.takeaway = (input.takeaway as string | undefined)?.trim() ?? '';
    metadata.resourceKind = kind as ContentMetadata['resourceKind'];
  }
  return metadata;
}
