export function SearchSnippet({ text, query }: { text: string; query: string }) {
  const q = query.trim();
  const index = text.toLowerCase().indexOf(q.toLowerCase());
  if (!q || index < 0) return <>{text}</>;
  return <>{text.slice(0, index)}<mark>{text.slice(index, index + q.length)}</mark>{text.slice(index + q.length)}</>;
}
