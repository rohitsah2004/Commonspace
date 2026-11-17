export const defaultHubCopy = {
  startHere: 'Start here', startHereText: 'A guided path through useful security knowledge.',
  cheatSheets: 'Latest cheat sheets', notes: 'Latest notes', posts: 'Latest posts', resources: 'Top resources',
  tags: 'Explore a topic', browse: 'Browse everything', viewAll: 'View all',
  emptyTitle: 'Your next useful discovery is on its way.',
  emptyText: 'Explore another topic or return soon for new material.',
  searchPlaceholder: 'Search techniques, commands, notes, and resources…',
  searching: 'Searching the knowledge hub…',
};
export type HubCopy = typeof defaultHubCopy;
export function validateHubCopy(input: unknown): HubCopy {
  if (input === undefined) return defaultHubCopy;
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw Error('Invalid hub copy.');
  const result = { ...defaultHubCopy };
  for (const key of Object.keys(result) as (keyof HubCopy)[]) {
    const value = (input as Record<string, unknown>)[key];
    if (value === undefined) continue;
    if (typeof value !== 'string' || value.length > 500) throw Error('Invalid hub copy for ' + key);
    result[key] = value.trim();
  }
  return result;
}
