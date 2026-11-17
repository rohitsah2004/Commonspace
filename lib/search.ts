import { plainText } from './content';
import { listPublic, publicItems, toCard, type Card, type PublicFilters } from './queries';

export type SearchHit = Card & { snippet: string };
export async function searchPublic(filters: PublicFilters): Promise<SearchHit[]> {
  const items = await publicItems();
  const { items: matches } = await listPublic(filters, items);
  const q = filters.q!.trim().toLowerCase();
  return matches.map(item => {
    const body = plainText(item.content.body).replace(/\s+/g, ' ').trim();
    const index = body.toLowerCase().indexOf(q);
    const start = Math.max(0, index - 45);
    const snippet = index >= 0 ? (start ? '…' : '') + body.slice(start, start + 180) + (start + 180 < body.length ? '…' : '')
      : (item.content.takeaway || item.content.subtitle || body).slice(0, 180);
    return { ...toCard(item), snippet };
  });
}
