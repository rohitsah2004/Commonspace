export type CollectionMetadata = { audience?: string; estimatedHours?: number };
export function validateCollectionMetadata(value: Record<string, unknown>): CollectionMetadata {
  const result: CollectionMetadata = {};
  if (value.audience !== undefined && value.audience !== '') {
    if (typeof value.audience !== 'string' || value.audience.length > 80) throw Error('Audience must be at most 80 characters.');
    result.audience = value.audience.trim();
  }
  if (value.estimatedHours !== undefined && value.estimatedHours !== '') {
    if (typeof value.estimatedHours !== 'number' || !Number.isFinite(value.estimatedHours) || value.estimatedHours <= 0 || value.estimatedHours > 1000) throw Error('Estimated hours must be between 0 and 1000.');
    result.estimatedHours = Math.round(value.estimatedHours * 10) / 10;
  }
  return result;
}
