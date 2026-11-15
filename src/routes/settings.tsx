import { createFileRoute } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import { CheckCircle2, Circle, Globe2, LoaderCircle, PlugZap, Unplug } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Workspace, PageHeading, pageHead } from '@/components/workspace';
import { api, apiBase, validateApiBase, type Health } from '@/lib/api';
export const Route = createFileRoute('/settings')({ head: () => pageHead('Settings', 'Manage the external research service connection for MeetBrief AI.'), component: Settings });
function Settings() {
  const [url, setUrl] = useState(''); const [health, setHealth] = useState<Health | null>(null); const [error, setError] = useState(''); const [busy, setBusy] = useState(false); const [local, setLocal] = useState(false);
  useEffect(() => { setUrl(apiBase()); setLocal(['localhost', '127.0.0.1', '[::1]'].includes(window.location.hostname)); }, []);
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
  return <Workspace title="Settings">
    <PageHeading title="Research connections" subtitle="Live briefings need a running research service." />
    <div className="grid xl:grid-cols-2 gap-10">
      <section className="min-w-0">
        <h2 className="section-title flex items-center gap-2"><Globe2 size={19} className="text-primary" /> Research service</h2>
        <div className="notice mt-5"><p className="font-semibold">{health?.tavily.status === 'connected' && health?.mongodb.status === 'connected' ? 'Both research connections passed their live checks.' : 'Research is not ready until both connections pass.'}</p><p className="mt-1">{local ? 'You are running the workspace locally. Start Flask on your computer and use http://localhost:5000.' : 'You are viewing the hosted workspace. localhost cannot connect here; deploy Flask and use its public HTTPS address.'}</p></div>
        <form className="mt-6 space-y-4" onSubmit={connect}>
          <div className="field"><label htmlFor="service">{local ? 'Research service address' : 'Deployed Flask HTTPS address'}</label><input id="service" type="url" value={url} onChange={e => { setUrl(e.target.value); setHealth(null); setError(''); }} placeholder={local ? 'http://localhost:5000' : 'https://your-service.onrender.com'} required /></div>
          <p className="text-xs leading-6 text-muted-foreground">Private Tavily and MongoDB credentials belong on your external service, never in this form. The address is remembered for this browser session. Testing runs a Tavily search and may incur usage charges.</p>
          <div className="flex flex-wrap gap-2"><Button disabled={busy} type="submit">{busy ? <LoaderCircle className="animate-spin" /> : <PlugZap />}{busy ? 'Checking connections…' : 'Save & test connection'}</Button><Button type="button" variant="outline" disabled={busy || !url} onClick={() => { window.sessionStorage.removeItem('meetbrief-api-url'); setUrl(''); setHealth(null); setError(''); }}><Unplug />Clear address</Button></div>
        </form>
        {error && <p role="alert" className="error-notice mt-5">{error}</p>}
        <div className="mt-8 border-t border-border">{(['tavily', 'mongodb'] as const).map(name => { const status = health?.[name]?.status || 'Not tested'; const ready = status === 'connected'; return <div key={name} className="flex items-center justify-between py-5 border-b border-border"><span className="font-semibold">{name === 'mongodb' ? 'MongoDB' : 'Tavily'}</span><span className={`flex items-center gap-2 text-xs ${ready ? 'text-success' : 'text-muted-foreground'}`}>{ready ? <CheckCircle2 size={15} /> : <Circle size={13} />}{status}</span></div>; })}</div>
      </section>
      <section className="min-w-0 xl:border-l xl:pl-8 border-border space-y-5">
        <h2 className="section-title">Hackathon readiness</h2>
        <p className="text-sm leading-7 text-muted-foreground">A working research demo needs Tavily, MongoDB, and Flask running. A local demo works when both the workspace and Flask run on your computer. A shareable demo needs a hosted Flask address.</p>
        <details open className="border-t border-border pt-4"><summary className="font-semibold cursor-pointer">Deploy Flask on Render</summary><ol className="list-decimal pl-5 space-y-3 mt-4 text-xs leading-6 text-muted-foreground"><li>Create a Web Service from your GitHub repository. Set the root directory to <code>backend</code>.</li><li>Install command:<pre className="setup-command mt-2">pip install -r requirements.txt</pre></li><li>Start command:<pre className="setup-command mt-2">gunicorn --workers 1 --threads 4 --timeout 180 app:app</pre></li><li>Set <code>TAVILY_API_KEY</code>, <code>MONGODB_URI</code> and <code>MONGODB_DB=meetbrief</code> in Render’s environment settings. Allow the service to connect in MongoDB Atlas.</li><li>Set <code>CORS_ORIGINS</code> to your hosted workspace address (origin only, no path). Include the published address too when you publish.</li><li>Paste Render’s HTTPS address here, then test. Both connections must say “connected.”</li></ol></details>
        <details className="border-t border-border pt-4"><summary className="font-semibold cursor-pointer">Run locally on Windows</summary><p className="text-xs leading-6 text-muted-foreground mt-3">Run the workspace with <code>npm install</code> and <code>npm run dev</code>. In a second PowerShell window, open the backend folder and set the environment before starting Flask:</p><pre className="setup-command mt-3">{'$env:TAVILY_API_KEY="your-private-key"\n$env:MONGODB_URI="your-private-uri"\n$env:CORS_ORIGINS="http://localhost:8080"\npython -m pip install -r requirements.txt\npython app.py'}</pre><p className="text-xs leading-6 text-muted-foreground mt-3">Open the local workspace address printed by the first terminal, then enter <code>http://localhost:5000</code> here. Gunicorn is for Render/Linux, not Windows. A .env file is not loaded automatically by this Flask starter.</p></details>
        <p className="text-xs text-muted-foreground border-t border-border pt-4 leading-6">Screenshot studio uses AI Gateway separately; it does not require a research service connection. Before sharing publicly, protect the external service: allowed website origins alone do not prevent unauthorized access.</p>
      </section>
    </div>
  </Workspace>;
}
