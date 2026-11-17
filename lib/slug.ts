export function slugify(value: string): string {
  return value.normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

/** Display text remains unchanged; equality and links use the normalized slug. */
export function normalizeTag(value: string): string {
  return slugify(value.trim().replace(/^#+/, ''));
}

export function uniqueSlug(value: string, seen: Map<string, number>): string {
  const base = slugify(value) || 'section';
  const count = (seen.get(base) ?? 0) + 1;
  seen.set(base, count);
  return count === 1 ? base : `${base}-${count}`;
}
