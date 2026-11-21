import { CONTENT_TYPES, DIFFICULTIES, RESOURCE_KINDS, type ContentMetadata } from './types';

export function validateMetadata(
  input: Record<string, unknown>,
  safeURL: (value: string) => string,
): ContentMetadata {
  const type = input.type === undefined ? 'post' : input.type;
  if (!CONTENT_TYPES.includes(type as never)) throw Error('Unknown content type.');
  const difficulty = input.difficulty === undefined ? '' : input.difficulty;
  if (difficulty !== '' && !DIFFICULTIES.includes(difficulty as never)) {
    throw Error('Unknown difficulty.');
  }
  const metadata: ContentMetadata = { type: type as ContentMetadata['type'], difficulty: difficulty as ContentMetadata['difficulty'] };
  for (const field of ['sourceTitle', 'sourceAuthor'] as const) {
    if (input[field] !== undefined) {
      if (typeof input[field] !== 'string' || input[field].length > 200) throw Error('Source text must be within 200 characters.');
      metadata[field] = input[field].trim();
    }
  }
  if (input.sourceUrl !== undefined) {
    if (typeof input.sourceUrl !== 'string' || input.sourceUrl.length > 2048) throw Error('Invalid source URL.');
    const url = safeURL(input.sourceUrl);
    if (input.sourceUrl && (!url || new URL(url).protocol !== 'https:' || new URL(url).username || new URL(url).password)) throw Error('Use an HTTPS source URL without credentials.');
    metadata.sourceUrl = url;
  }
  for (const field of ['longVerbatim', 'bookCodeWarning'] as const) {
    if (input[field] !== undefined) {
      if (typeof input[field] !== 'boolean') throw Error('Invalid draft notice.');
      if (input[field]) metadata[field] = true;
    }
  }
  if (input.sessionReview !== undefined) {
    if (typeof input.sessionReview !== 'boolean') throw Error('Invalid session review marker.');
    if (input.sessionReview) metadata.sessionReview = true;
  }
  if (input.excerpt !== undefined) {
    if (typeof input.excerpt !== 'string' || input.excerpt.length > 500) throw Error('Keep the excerpt within 500 characters.');
    metadata.excerpt = input.excerpt.trim();
  }
  if (input.reviewedAt !== undefined) {
    if (typeof input.reviewedAt !== 'number' || !Number.isSafeInteger(input.reviewedAt)
      || input.reviewedAt < Date.UTC(2000, 0, 1) || input.reviewedAt > Date.now() + 86400000) {
      throw Error('Last reviewed must be a valid date, no later than tomorrow.');
    }
    metadata.reviewedAt = input.reviewedAt;
  }
  if (input.snapshotUpdatedAt !== undefined) {
    if (typeof input.snapshotUpdatedAt !== 'number' || !Number.isSafeInteger(input.snapshotUpdatedAt) || input.snapshotUpdatedAt < Date.UTC(2000, 0, 1) || input.snapshotUpdatedAt > Date.now() + 366 * 86400000) throw Error('Invalid snapshot timestamp.');
    metadata.snapshotUpdatedAt = input.snapshotUpdatedAt;
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
    const kind = input.resourceKind === undefined ? 'other' : input.resourceKind;
    if (!RESOURCE_KINDS.includes(kind as never)) throw Error('Unknown resource kind.');
    metadata.resourceUrl = url;
    metadata.takeaway = (input.takeaway as string | undefined)?.trim() ?? '';
    metadata.resourceKind = kind as ContentMetadata['resourceKind'];
  }
  return metadata;
}
