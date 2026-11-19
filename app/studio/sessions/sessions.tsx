'use client';
import { useEffect, useRef, useState } from 'react';
import { ENTRY_TYPES, SESSION_PHASES, type Session, type SessionEntry, type EntryType, type SessionPhase } from '../../../lib/session-types';
type Detail = { session: Session; entries: SessionEntry[] };
async function api<T>(url: string, method = 'GET', body?: unknown): Promise<T> {
  const response = await fetch(url, { method, cache: 'no-store', ...(body ? { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : {}) });
  const value = await response.json() as { error?: string }; if (!response.ok) throw Error(value.error || 'Request failed.'); return value as T;
}
export default function Sessions() {
  const [sessions, setSessions] = useState<Session[]>([]), [detail, setDetail] = useState<Detail | null>(null);
  const [offset, setOffset] = useState(0), [hasMore, setHasMore] = useState(false);
  const [name, setName] = useState(''), [platform, setPlatform] = useState(''), [difficulty, setDifficulty] = useState('beginner');
  const [text, setText] = useState(''), [type, setType] = useState<EntryType>('command'), [phase, setPhase] = useState<SessionPhase>('recon');
  const [editing, setEditing] = useState<string | null>(null), [busy, setBusy] = useState(false), [error, setError] = useState(''), [message, setMessage] = useState('');
  const [deleting, setDeleting] = useState<{ kind: 'session' | 'entry'; id: string } | null>(null);
  const inFlight = useRef(false);
  const input = useRef<HTMLTextAreaElement>(null); const opening = useRef(0);
  useEffect(() => {
    let live = true;
    api<{ sessions: Session[]; hasMore: boolean }>('/api/sessions?offset=' + offset).then(data => { if (live) { setSessions(data.sessions); setHasMore(data.hasMore); } }).catch(e => { if (live) setError(e.message); });
    return () => { live = false; };
  }, [offset]);
  useEffect(() => { input.current?.focus(); }, [detail?.session.id]);
  async function perform(action: () => Promise<void>) {
    if (inFlight.current) return; inFlight.current = true; setBusy(true); setError(''); setMessage('');
    try { await action(); } catch (e) { setError(e instanceof Error ? e.message : 'Request failed. Your input is unchanged.'); } finally { inFlight.current = false; setBusy(false); }
  }
  async function open(id: string) {
    const version = ++opening.current;
    try { const data = await api<Detail>('/api/sessions/' + id); if (opening.current === version) { setDetail(data); setText(''); setEditing(null); setError(''); } } catch (e) { setError(e instanceof Error ? e.message : 'Could not open session.'); }
  }
  function append() {
    if (!detail || !text.trim() || text.length > 20000) return;
    const id = detail.session.id;
    perform(async () => {
      const data = await api<{ entry: SessionEntry }>('/api/sessions/' + id + '/entries', editing ? 'PATCH' : 'POST', { ...(editing ? { id: editing } : {}), type, phase, content: text });
      setDetail(old => old?.session.id === id ? { ...old, entries: editing ? old.entries.map(e => e.id === editing ? data.entry : e) : [...old.entries, data.entry] } : old);
      setText(''); setEditing(null); setMessage('Entry saved.'); input.current?.focus();
    });
  }
  return <div className="content sessionlogs"><div className="sectionhead"><div><p className="eyebrow">PRIVATE WORKSPACE</p><h1>Session logs</h1><p>Capture commands, output and findings as you work. Nothing here is public.</p></div><a className="chip" href="/studio">Writing workspace</a></div>
    <div role="status" aria-live="polite">{message}</div>{error && <p className="errorbox" role="alert">{error}</p>}
    <div className="sessionlayout"><aside className="sessionlist"><h2>Your sessions</h2><form onSubmit={e => { e.preventDefault(); if (text && !window.confirm('Discard the unsaved entry input?')) return; opening.current++; perform(async () => {
      const data = await api<{ session: Session }>('/api/sessions', 'POST', { name, platform, difficulty, status: 'active' });
      setSessions(old => [data.session, ...old]); setDetail({ session: data.session, entries: [] }); setName(''); setText(''); setEditing(null);
    }); }}><label>Name<input required maxLength={200} placeholder="HTB - Lame" value={name} onChange={e => setName(e.target.value)}/></label><label>Platform<input maxLength={100} value={platform} onChange={e => setPlatform(e.target.value)}/></label><label>Difficulty<select value={difficulty} onChange={e => setDifficulty(e.target.value)}>{['beginner','intermediate','advanced'].map(x => <option key={x}>{x}</option>)}</select></label><button className="primary" disabled={busy}>Create session</button></form>
      <ul>{sessions.map(s => <li key={s.id}><button className="textbutton" disabled={busy} aria-pressed={detail?.session.id === s.id} onClick={() => { if (text && !window.confirm('Discard the unsaved entry input?')) return; open(s.id); }}>{s.name} <small>{s.status} · {s.platform}</small></button></li>)}</ul>
      <div className="chips"><button disabled={!offset || busy} onClick={() => setOffset(Math.max(0, offset - 50))}>Previous</button><button disabled={!hasMore || busy} onClick={() => setOffset(offset + 50)}>Next</button></div></aside>
      <section className="sessiondetail">{detail ? <><h2>{detail.session.name}</h2><p>{detail.session.platform} · {detail.session.difficulty} · {detail.session.status}</p><div className="chips"><button disabled={busy} onClick={() => perform(async () => {
        const data = await api<{ session: Session }>('/api/sessions/' + detail.session.id, 'PATCH', { status: detail.session.status === 'active' ? 'done' : 'active' });
        setDetail(old => old ? { ...old, session: data.session } : old); setSessions(old => old.map(s => s.id === data.session.id ? data.session : s));
      })}>{detail.session.status === 'active' ? 'Mark done' : 'Reopen'}</button><button disabled={busy} className="textbutton danger" onClick={() => setDeleting({ kind: 'session', id: detail.session.id })}>Delete session</button></div>
      <form onSubmit={e => { e.preventDefault(); append(); }}><h3>{editing ? 'Edit entry' : 'Quick capture'}</h3><div className="formrow"><label>Entry type<select disabled={busy} value={type} onChange={e => setType(e.target.value as EntryType)}>{ENTRY_TYPES.map(x => <option key={x}>{x}</option>)}</select></label><label>Phase<select disabled={busy} value={phase} onChange={e => setPhase(e.target.value as SessionPhase)}>{SESSION_PHASES.map(x => <option key={x}>{x}</option>)}</select></label></div><label>Entry text<textarea ref={input} rows={7} value={text} readOnly={busy} spellCheck={false} onChange={e => setText(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); append(); } }}/></label><small>{text.length.toLocaleString()} / 20,000 characters · Ctrl/Cmd+Enter saves</small><div className="chips"><button className="primary" disabled={busy || !text.trim() || text.length > 20000 || (!editing && detail.entries.length >= 500)}>{editing ? 'Save entry' : 'Add entry'}</button>{editing && <button type="button" disabled={busy} onClick={() => { setEditing(null); setText(''); }}>Cancel edit</button>}</div></form>
      <p>{detail.entries.length} / 500 entries</p><ol className="sessionentries">{detail.entries.map((entry, i) => <li key={entry.id}><div className="sectionhead"><small>#{i + 1} · {entry.type} · {entry.phase} · <time dateTime={new Date(entry.created_at).toISOString()}>{new Date(entry.created_at).toISOString()}</time></small><div className="chips"><button disabled={busy} onClick={() => { if (text && !window.confirm('Discard the unsaved entry input?')) return; setEditing(entry.id); setType(entry.type); setPhase(entry.phase); setText(entry.content); input.current?.focus(); }}>Edit</button><button disabled={busy} onClick={() => setDeleting({ kind: 'entry', id: entry.id })}>Delete</button></div></div><pre>{entry.content}</pre></li>)}</ol></> : <p>Create or open a session to start capturing.</p>}</section></div>
      {deleting && <div className="modalback"><section className="confirmbox" role="dialog" aria-modal="true" aria-label="Confirm deletion"><h2>Delete {deleting.kind}?</h2><p>{deleting.kind === 'session' ? 'The session and all its entries will be permanently deleted.' : 'This entry will be permanently deleted.'}</p><div className="dialogfoot"><button disabled={busy} onClick={() => setDeleting(null)}>Cancel</button><button className="primary" disabled={busy} onClick={() => perform(async () => {
        if (!detail) return;
        await api('/api/sessions/' + detail.session.id + (deleting.kind === 'entry' ? '/entries' : ''), 'DELETE', deleting.kind === 'entry' ? { id: deleting.id } : undefined);
        if (deleting.kind === 'session') { setSessions(old => old.filter(s => s.id !== deleting.id)); setDetail(null); setText(''); setEditing(null); }
        else { setDetail(old => old ? { ...old, entries: old.entries.filter(e => e.id !== deleting.id) } : old); if (editing === deleting.id) { setEditing(null); setText(''); } }
        setDeleting(null); setMessage('Deleted.');
      })}>Delete permanently</button></div></section></div>}
  </div>;
}
