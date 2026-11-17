/** Neutral UTC labels with machine-readable timestamps, shared by owner tools. */
export function DateTime({ value, detailed = false }: { value: string | number; detailed?: boolean }) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return <span>Unknown date</span>;
  const iso = date.toISOString();
  return <time dateTime={iso}>{detailed ? iso.slice(0, 19).replace('T', ' ') + ' UTC' : iso.slice(0, 10)}</time>;
}
