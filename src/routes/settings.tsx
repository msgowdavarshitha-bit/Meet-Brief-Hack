import { createFileRoute } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import { CheckCircle2, Circle, Globe2, LoaderCircle, PlugZap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Workspace, PageHeading, pageHead } from '@/components/workspace';
import { api, apiBase, validateApiBase, type Health } from '@/lib/api';
export const Route = createFileRoute('/settings')({ head: () => pageHead('Settings', 'Manage the external research service connection for MeetBrief AI.'), component: Settings });
function Settings() {
  const [url, setUrl] = useState(''); const [health, setHealth] = useState<Health | null>(null); const [error, setError] = useState(''); const [busy, setBusy] = useState(false);
  useEffect(() => setUrl(apiBase()), []);
  async function connect(e: React.FormEvent) {
    e.preventDefault(); setError(''); setHealth(null); setBusy(true);
    try {
      const address = validateApiBase(url, window.location.origin);
      const result = await api<Health>('/api/health', {}, address);
      if (!result?.tavily?.status || !result?.mongodb?.status) throw new Error('This service did not return valid connection statuses. Check the Flask service address.');
      window.sessionStorage.setItem('meetbrief-api-url', address);
      setHealth(result);
    } catch (e) { setError(e instanceof Error ? e.message : 'Connection failed.'); } finally { setBusy(false); }
  }
  return <Workspace title="Settings"><PageHeading title="Your research connections." subtitle="One workspace. Live research. Clear connection status." /><section className="max-w-2xl"><h2 className="section-title flex items-center gap-2"><Globe2 size={19} className="text-primary" /> External research service</h2><form className="mt-6 space-y-4" onSubmit={connect}><div className="field"><label htmlFor="service">Flask service address</label><input id="service" type="url" value={url} onChange={e => setUrl(e.target.value)} placeholder="https://your-service.onrender.com" required /></div><p className="text-xs leading-6 text-muted-foreground">Private Tavily and MongoDB credentials belong on your external service, never in this form. This address is remembered for this browser session.</p><Button disabled={busy} type="submit">{busy ? <LoaderCircle className="animate-spin" /> : <PlugZap />} {busy ? 'Checking connections…' : 'Save & test connection'}</Button></form>{error && <p role="alert" className="error-notice mt-5">{error}</p>}<div className="mt-8 border-t border-border">{(['tavily', 'mongodb'] as const).map(name => { const status = health?.[name]?.status || 'Not tested'; const ready = status === 'connected'; return <div key={name} className="flex items-center justify-between py-5 border-b border-border"><span className="font-semibold">{name === 'mongodb' ? 'MongoDB' : 'Tavily'}</span><span className={`flex items-center gap-2 text-xs ${ready ? 'text-success' : 'text-muted-foreground'}`}>{ready ? <CheckCircle2 size={15} /> : <Circle size={13} />}{status}</span></div>; })}</div></section></Workspace>;
}
