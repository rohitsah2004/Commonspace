import type { Content } from '../../lib/content';
import { safeURL } from '../../lib/url';
export function BookSource({ content }: {
    content: Content;
}) {
    if (!content.sourceTitle && !content.sourceAuthor && !content.sourceUrl)
        return null;
    const href = safeURL(content.sourceUrl || '');
    const safe = href.startsWith('https://') && !new URL(href).username && !new URL(href).password;
    return <aside className="booksource"><small>Based on {safe ? <a href={href} rel="noopener noreferrer" target="_blank">{content.sourceTitle || 'source'}</a> : content.sourceTitle || 'source'}{content.sourceAuthor ? ' by ' + content.sourceAuthor : ''}</small></aside>;
}
export function BookDraftNotices({ content }: {
    content: Content;
}) {
    return <>{content.longVerbatim && <small className="booknotice">Long verbatim passage</small>}{content.bookCodeWarning && <small className="booknotice">Some code blocks were not found verbatim in the chapter text.</small>}</>;
}
export function BookSourceFields({ content, onChange }: {
    content: Content;
    onChange: (patch: Partial<Content>) => void;
}) {
    return <details><summary>Source (optional)</summary><label>Source title<input maxLength={200} value={content.sourceTitle || ''} onChange={e => onChange({ sourceTitle: e.target.value })}/></label><label>Source author<input maxLength={200} value={content.sourceAuthor || ''} onChange={e => onChange({ sourceAuthor: e.target.value })}/></label><label>Source URL<input type="url" maxLength={2048} value={content.sourceUrl || ''} onChange={e => onChange({ sourceUrl: e.target.value })}/></label></details>;
}
