export type ContentType = 'post' | 'note' | 'cheatsheet' | 'resource';
export type Difficulty = 'beginner' | 'intermediate' | 'advanced';
export const CONTENT_TYPES: ContentType[] = ['post', 'note', 'cheatsheet', 'resource'];
export const TYPE_LABELS: Record<ContentType, { singular: string; plural: string; path: string }> = {
  post: { singular: 'Post', plural: 'Posts', path: '/posts' },
  note: { singular: 'Note', plural: 'Notes', path: '/notes' },
  cheatsheet: { singular: 'Cheat sheet', plural: 'Cheat sheets', path: '/cheatsheets' },
  resource: { singular: 'Resource', plural: 'Resources', path: '/resources' },
};
export const DIFFICULTIES: Difficulty[] = ['beginner', 'intermediate', 'advanced'];
export const RESOURCE_KINDS = ['tool', 'lab', 'ctf', 'cert', 'paper', 'video', 'course', 'book', 'other'] as const;
export type ResourceKind = typeof RESOURCE_KINDS[number];
export type ContentMetadata = {
  type?: ContentType;
  difficulty?: Difficulty | '';
  reviewedAt?: number;
  snapshotUpdatedAt?: number;
  resourceUrl?: string;
  takeaway?: string;
  resourceKind?: ResourceKind;
};
