'use client';
import {DateTime} from './date-time';
import { useEffect, useState } from 'react';
import type { ResourceCheck } from '../../lib/resource-check';
export function MaintenanceTools({ emailReady }: { emailReady: boolean }) {
  const [resources, setResources] = useState<ResourceCheck[]>([]); const [message,setMessage] = useState('');
  const [busy,setBusy] = useState(false); const [confirm,setConfirm] = useState(false);
  async function load() { const r = await fetch('/api/resources/check'); if (!r.ok) throw Error('Could not load resource checks.'); setResources(((await r.json()) as {resources:ResourceCheck[]}).resources); }
  useEffect(() => { let active=true; fetch('/api/resources/check').then(async r=>{if(!r.ok)throw Error('Could not load resource checks.');return await r.json() as {resources:ResourceCheck[]}}).then(d=>{if(active)setResources(d.resources)}).catch(e=>{if(active)setMessage(e.message)});return ()=>{active=false}; }, []);
  async function run(action: 'digest' | 'links') {
    setBusy(true); setMessage(''); setConfirm(false);
    try {
      if (action === 'links') {
        const r = await fetch('/api/resources/check', { method:'POST' }); const d = await r.json() as {error?:string;resources:ResourceCheck[]}; if (!r.ok) throw Error(d.error);
        await load(); setMessage('Checked ' + d.resources.length + ' resources. Run again to check the next oldest batch.');
      } else {
        let more = true; let sent = 0;
        while (more) {
          const r = await fetch('/api/digest', { method:'POST' }); const d = await r.json() as {error?:string;sent:number;more:boolean;message?:string}; if (!r.ok) throw Error(d.error);
          sent += d.sent; more = d.more; setMessage('Digest sent to ' + sent + ' confirmed subscribers.');
          if (d.message) setMessage(d.message);
        }
      }
    } catch (e) { setMessage(e instanceof Error ? e.message : 'Could not complete this action.'); } finally { setBusy(false); }
  }
  return <section className="toolpanel"><h2>Digest and resource health</h2><p>Send a digest explicitly, or check up to 20 resource links. Nothing runs automatically.</p>
    <div className="chips"><button className="chip" disabled={busy || !emailReady} onClick={() => setConfirm(true)}>Send digest</button><button className="chip" disabled={busy} onClick={() => run('links')}>{busy ? 'Working…' : 'Check resource links'}</button></div>
    {!emailReady && <p>Connect Resend and a verified sender to enable digests.</p>}
    <p role="status">{message}</p>{resources.map(item => <div className="metricrow" key={item.id}><div>{item.title}<small>{item.lastChecked ? <>Checked <DateTime value={item.lastChecked} detailed/></> : 'Not checked yet'}</small></div><span className={'statusbadge ' + (item.status === 'broken' ? 'danger' : '')}>{item.status === 'broken' ? 'Broken link' : item.status || 'Unchecked'}</span></div>)}
    {confirm && <div className="modalback"><section className="confirmbox" role="dialog" aria-modal="true" aria-label="Confirm digest"><h2>Send digest?</h2><p>Email newly published items since the last digest to confirmed subscribers. Existing unfinished delivery resumes safely.</p><div className="dialogfoot"><button onClick={() => setConfirm(false)}>Cancel</button><button className="primary" onClick={() => run('digest')}>Send digest</button></div></section></div>}
  </section>;
}
