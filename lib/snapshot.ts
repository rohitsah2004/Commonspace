import type { PublicItem } from './queries';
/** Older snapshots have no separate edit timestamp; use their known publication time, never the private draft edit time. */
export function snapshotModified(item: PublicItem): number {
  return item.content.snapshotUpdatedAt ?? item.row.published_at;
}
