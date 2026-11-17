'use client';

import { useState } from 'react';
import { type SiteSettings } from '../../lib/site-settings';

type Collection = { id: string; name: string };
export default function SiteSettingsForm({ initial, collections }: { initial: SiteSettings; collections: Collection[] }) {
  const [settings, setSettings] = useState(initial);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  return <form className="toolpanel" onSubmit={async event => {
    event.preventDefault(); setBusy(true); setMessage('');
    try {
      const res = await fetch('/api/manage', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'site', settings }) });
      const data = await res.json() as { error?: string };
      if (!res.ok) throw Error(data.error || 'Could not save settings.');
      setMessage('Site settings saved. Reload public pages to see your changes.');
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Could not save settings.'); }
    finally { setBusy(false); }
  }}>
    <h2>Make this space yours.</h2>
    {(['title', 'tagline', 'heroTitle', 'heroText', 'securityContact'] as const).map(key => <label key={key}>
      {{ title: 'Publication title', tagline: 'Tagline', heroTitle: 'Hero title', heroText: 'Hero text', securityContact: 'Security contact (email or HTTPS URL)' }[key]}
      <input value={settings[key]} maxLength={key === 'securityContact' ? 2048 : key === 'heroText' ? 500 : key === 'title' ? 80 : 160}
        required={key === 'title' || key === 'heroTitle'} onChange={e => setSettings({ ...settings, [key]: e.target.value })}/>
    </label>)}
    <label>Featured collection<select value={settings.featuredCollection} onChange={e => setSettings({ ...settings, featuredCollection: e.target.value })}>
      <option value="">No featured collection</option>
      {collections.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
    </select></label>
    <div className="dialogfoot"><span role="status">{message}</span><button className="primary" disabled={busy}>Save site settings</button></div>
  </form>;
}
