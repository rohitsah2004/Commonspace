import { blank, validateContent, type Content } from './content';
import { parseMarkdown } from './markdown-parser';
export function importMarkdown(source: string, current: Content = blank()): Content {
  const parsed = parseMarkdown(source);
  return validateContent({ ...current, ...parsed.metadata,
    title: parsed.metadata.title || current.title || parsed.title || 'Imported note', body: parsed.body });
}
