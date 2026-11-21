'use client';

import { BookSourceFields } from './book-source';
import type { Content } from '../../lib/content';
import { CONTENT_TYPES, DIFFICULTIES, RESOURCE_KINDS, TYPE_LABELS, type ContentType, type Difficulty, type ResourceKind } from '../../lib/types';

export default function ContentFields({ content, onChange }: { content: Content; onChange: (patch: Partial<Content>) => void }) {
  const type = content.type ?? 'post';
  return <section className="contentfields"><BookSourceFields content={content} onChange={onChange}/>
    <label>Content type<select value={type} onChange={e => onChange({ type: e.target.value as ContentType })}>
      {CONTENT_TYPES.map(t => <option key={t} value={t}>{TYPE_LABELS[t].singular}</option>)}
    </select></label>
    <label>Excerpt<textarea rows={3} maxLength={500} value={content.excerpt ?? ''} onChange={e => onChange({ excerpt: e.target.value })}/><small>A complete summary for cards and feeds. Leave blank to use the body preview.</small></label>
    <label>Difficulty<select value={content.difficulty ?? ''} onChange={e => onChange({ difficulty: e.target.value as Difficulty | '' })}>
      <option value="">Not specified</option>
      {DIFFICULTIES.map(d => <option key={d} value={d}>{d[0].toUpperCase() + d.slice(1)}</option>)}
    </select></label>
    {type === 'resource' && <>
      <label>Resource URL<input type="url" required maxLength={2048} placeholder="https://" value={content.resourceUrl ?? ''} onChange={e => onChange({ resourceUrl: e.target.value })}/></label>
      <label>One line takeaway<textarea rows={3} maxLength={280} value={content.takeaway ?? ''} onChange={e => onChange({ takeaway: e.target.value })}/></label>
      <label>Resource kind<select value={content.resourceKind ?? 'other'} onChange={e => onChange({ resourceKind: e.target.value as ResourceKind })}>
        {RESOURCE_KINDS.map(kind => <option key={kind} value={kind}>{kind}</option>)}
      </select></label>
      <small>A resource can be published without a body. Its HTTPS link is required.</small>
    </>}
    {type === 'cheatsheet' && <>
      <label>Last reviewed<input type="date"
        value={content.reviewedAt ? new Date(content.reviewedAt).toISOString().slice(0, 10) : ''}
        onChange={e => onChange({ reviewedAt: e.target.value ? Date.parse(e.target.value + 'T00:00:00Z') : undefined })}/></label>
      <button type="button" className="chip" onClick={() => onChange({ reviewedAt: Date.now() })}>Mark reviewed today</button>
    </>}
  </section>;
}
