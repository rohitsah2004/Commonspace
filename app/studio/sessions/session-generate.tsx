'use client';
import { useMemo, useState } from 'react';
import { blank, type Content } from '../../../lib/content';
import { AIAssistant } from '../../components/ai-assistant';
import { compileSession, PHASE_TITLES } from '../../../lib/session-compile';
import { parseBareHosts, suggestedBareHost, PUBLIC_HOST_ALLOWLIST } from '../../../lib/session-mask';
import { SESSION_PHASES, type Session, type SessionEntry, type SessionPhase } from '../../../lib/session-types';
export default function SessionGenerate({ session, entries }: { session: Session; entries: SessionEntry[] }) {
  const [phases, setPhases] = useState<SessionPhase[]>([...SESSION_PHASES]);
  const [start, setStart] = useState(1), [end, setEnd] = useState('');
  const [mask, setMask] = useState(false), [names, setNames] = useState(() => suggestedBareHost(session.name));
  const [saving, setSaving] = useState(false), [error, setError] = useState(''), [draft, setDraft] = useState('');
  const compiled = useMemo(() => {
    try { return { value: compileSession(session, entries, { phases, start, end: end === '' ? entries.length : Number(end), mask, bareNames: mask ? parseBareHosts(names) : [] }), error: '' }; }
    catch (e) { return { value: null, error: e instanceof Error ? e.message : 'Choose valid entries.' }; }
  }, [session, entries, phases, start, end, mask, names]);
  async function apply(content: Content) {
    if (saving) return; setSaving(true); setError('');
    try {
      const response = await fetch('/api/posts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...content, type: 'post', sessionReview: true }) });
      const result = await response.json() as { id?: string; error?: string };
      if (!response.ok || !result.id) throw Error(result.error || 'Could not create the draft.');
      setDraft('/studio?draft=' + encodeURIComponent(result.id));
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not create the draft.'); }
    finally { setSaving(false); }
  }
  return <section className="sessiongeneration" aria-label="Generate a reviewed writeup"><h3>Generate writeup</h3><p>Many platforms prohibit publishing solutions for active machines. Check before publishing.</p>
    <fieldset><legend>Include phases</legend><div className="chips">{SESSION_PHASES.map(phase => <label key={phase}><input type="checkbox" checked={phases.includes(phase)} onChange={e => setPhases(old => e.target.checked ? [...old, phase] : old.filter(p => p !== phase))}/>{PHASE_TITLES[phase]}</label>)}</div></fieldset>
    <div className="formrow"><label>First entry<input type="number" min={1} max={entries.length || 1} value={start} onChange={e => setStart(Number(e.target.value))}/></label><label>Last entry<input type="number" min={start} max={entries.length || 1} placeholder={'All (' + entries.length + ')'} value={end} onChange={e => setEnd(e.target.value)}/></label></div>
    <label><input type="checkbox" checked={mask} onChange={e => setMask(e.target.checked)}/>Mask IPs and hostnames</label><label>Bare names to mask (optional, for this generation)<input disabled={!mask} maxLength={3200} value={names} onChange={e => setNames(e.target.value)}/></label><small>The suggested name is editable; clear it to leave all bare names unchanged. Whole standalone tokens only. Public domains ({PUBLIC_HOST_ALLOWLIST.join(', ')}) and common filenames are skipped. Masking is one-way; review the preview.</small>
    {compiled.error && <p role="alert">{compiled.error}</p>}{compiled.value && <p role="status">{compiled.value.included} of {compiled.value.total} entries included · {compiled.value.characters.toLocaleString()} / 20,000 characters. {compiled.value.overLimit && 'Nothing is truncated. Choose fewer phases, a smaller entry range, or shorten an entry.'}</p>}
    {compiled.value && !compiled.value.overLimit && compiled.value.included > 0 && !saving && !draft && <AIAssistant content={blank()} seedText={compiled.value.text} seedMode="writeup" triggerLabel="Generate writeup" onApply={content => { void apply(content); }}/>}
    {saving && <p role="status">Creating an unpublished draft…</p>}{error && <p role="alert" className="errorbox">{error}</p>}{draft && <><p role="status">Unpublished draft created. <a className="chip" href={draft}>Open writeup draft</a></p><button type="button" onClick={() => { setDraft(''); setNames(suggestedBareHost(session.name)); setMask(false); }}>Prepare another writeup</button></>}
  </section>;
}
