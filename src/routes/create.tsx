import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import { ArrowRight, Building2, CalendarDays, Info, LoaderCircle, UserRound } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Workspace, PageHeading, pageHead } from '@/components/workspace';
import { localDate, prettyDate, purposes, researchWindow } from '@/lib/meeting';
import { api } from '@/lib/api';

export const Route = createFileRoute('/create')({ head: () => pageHead('New briefing', 'Set your meeting context and prepare a source-backed briefing.'), component: Create });
function Create() {
  const navigate = useNavigate();
  const [type, setType] = useState('Company');
  const [today, setToday] = useState('');
  const [date, setDate] = useState('');
  const [timezone, setTimezone] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => { const d = localDate(); setToday(d); setDate(d); setTimezone(Intl.DateTimeFormat().resolvedOptions().timeZone); }, []);
  const window = date && today ? researchWindow(date, today) : null;
  const [purpose, setPurpose] = useState<string>('Business Development');
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(''); setBusy(true);
    const data = new FormData(event.currentTarget);
    try {
      const datetime = new Date(`${data.get('date')}T${data.get('time')}`);
      const offset = -datetime.getTimezoneOffset();
      const iso = `${data.get('date')}T${data.get('time')}:00${offset >= 0 ? '+' : '-'}${String(Math.floor(Math.abs(offset) / 60)).padStart(2, '0')}:${String(Math.abs(offset) % 60).padStart(2, '0')}`;
      const meeting = await api<{ meeting_id: string }>('/api/meetings', { method: 'POST', body: JSON.stringify({ name: String(data.get('name')).trim(), type, purpose, custom_purpose: data.get('custom_purpose') || '', context: data.get('context'), meeting_datetime: iso, timezone }) });
      const run = await api<{ run_id: string }>('/api/research', { method: 'POST', body: JSON.stringify({ meeting_id: meeting.meeting_id }) });
      await navigate({ to: '/research/$runId', params: { runId: run.run_id } });
    } catch (e) { setError(e instanceof Error ? e.message : 'Unable to start research.'); } finally { setBusy(false); }
  }
  return <Workspace title="New briefing"><PageHeading title="Make your next conversation count." subtitle="A few details. A briefing tailored to your meeting." /><div className="grid lg:grid-cols-[1.7fr_1fr] gap-10"><form onSubmit={submit} className="space-y-6"><div className="flex gap-2"><Button type="button" variant={type === 'Company' ? 'default' : 'outline'} onClick={() => setType('Company')}><Building2 />Company</Button><Button type="button" variant={type === 'Individual' ? 'default' : 'outline'} onClick={() => setType('Individual')}><UserRound />Individual</Button></div><div className="field"><label htmlFor="name">{type === 'Company' ? 'Company name' : 'Professional name'} <span className="text-primary">*</span></label><input id="name" name="name" placeholder={type === 'Company' ? 'e.g. Microsoft' : 'Full name'} required minLength={2} maxLength={150} /></div><div className="grid sm:grid-cols-2 gap-5"><div className="field"><label htmlFor="date">Meeting date *</label><input id="date" name="date" type="date" required value={date} onChange={e => setDate(e.target.value)} /></div><div className="field"><label htmlFor="time">Meeting time *</label><input id="time" name="time" type="time" required defaultValue="10:00" /></div></div><p className="text-xs text-muted-foreground">Timezone: {timezone || 'Detecting…'}</p><div className="field"><label htmlFor="purpose">Meeting purpose *</label><select id="purpose" name="purpose" value={purpose} onChange={e => setPurpose(e.target.value)}>{purposes.map(p => <option key={p}>{p}</option>)}</select></div>{purpose === 'Custom' && <div className="field"><label htmlFor="custom_purpose">Describe your meeting purpose *</label><input id="custom_purpose" name="custom_purpose" required maxLength={300} /></div>}<div className="field"><label htmlFor="context">Additional context <span className="font-normal text-muted-foreground">(optional)</span></label><textarea id="context" name="context" rows={4} maxLength={3000} placeholder="Attendee roles, topics you want to explore, or what a successful meeting looks like…" /></div>{window && <div className="notice flex gap-3"><CalendarDays size={18} className="text-primary shrink-0 mt-1" /><div><p className="font-semibold">Research window: {prettyDate(window.start)} – {prettyDate(window.end)}</p>{window.future && <p>Future meeting: research is capped at today. No future developments will be claimed.</p>}{window.past && <p className="text-warning">This meeting is in the past. You can still research its preceding 30 days.</p>}{window.empty && <p className="text-warning">This research window has not started yet. Choose a closer date to research available evidence.</p>}</div></div>}{error && <p className="error-notice" role="alert">{error}</p>}<div className="pt-5 border-t border-border"><Button type="submit" disabled={busy || Boolean(window?.empty)} className="h-11">{busy ? <LoaderCircle className="animate-spin" /> : <ArrowRight />} {busy ? 'Starting research…' : 'Generate my briefing'}</Button></div></form><aside className="lg:border-l border-border lg:pl-8"><div className="flex items-center gap-2 text-primary"><Info size={18} /><h2 className="section-title text-foreground">The right context matters.</h2></div><p className="text-sm leading-7 text-muted-foreground mt-4">Every conversation is different. Your purpose shapes what goes into your briefing.</p><div className="mt-7 space-y-6">{['Recent, relevant developments', 'Source-backed findings', 'Opportunities & considerations', 'Questions worth asking'].map((s, i) => <div key={s} className="flex gap-3"><span className="text-primary text-xs font-bold mt-1">0{i + 1}</span><span className="text-xs font-semibold">{s}</span></div>)}</div><p className="text-xs text-muted-foreground leading-6 mt-9 border-t border-border pt-5">Individual research is limited to public professional information. Uncertain findings stay clearly labeled.</p></aside></div></Workspace>;
}