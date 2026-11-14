export type Meeting = { meeting_id: string; name: string; type: string; purpose: string; meeting_datetime: string; timezone: string; created_at: string; briefing_id?: string };
export type Health = { tavily: { status: string }; mongodb: { status: string } };
export type Run = { run_id: string; status: string; briefing_id?: string; stages: { name: string; status: string }[]; counters: { tavily_queries: number; sources_retrieved: number; sources_deduped: number }; error?: string };
export type Briefing = { briefing_id: string; name: string; meeting_datetime: string; purpose: string; executive_summary: string; background: string[]; recent_developments: { claim: string; status: string; date: string | null; source_ids: number[]; excerpt?: string }[]; opportunities: string[]; risks: string[]; questions: { question: string; rationale: string }[]; sources: { id: number; title: string; url: string; publisher: string; published_date: string | null }[]; research_metadata: { window: { start: string; end: string }; queries: string[]; source_count: number } };

export function apiBase() {
  const configured = import.meta.env['VITE_API_BASE_URL'] as string | undefined;
  const saved = typeof window !== 'undefined' ? window.sessionStorage.getItem('meetbrief-api-url') : null;
  return (saved || configured || '').replace(/\/$/, '');
}

export function validateApiBase(value: string, appOrigin: string) {
  const address = new URL(value);
  const app = new URL(appOrigin);
  const local = (host: string) => host === 'localhost' || host === '[::1]' || host === '0.0.0.0' || host.startsWith('127.') || host.endsWith('.localhost');
  if (!['http:', 'https:'].includes(address.protocol) || address.username || address.password || address.search || address.hash) {
    throw new Error('Enter your hosted Flask service address without credentials or query parameters.');
  }
  if (local(address.hostname) && !local(app.hostname)) {
    throw new Error('This address points to localhost on your own device, not your hosted research service. Enter your deployed Flask HTTPS address in Settings.');
  }
  if (app.protocol === 'https:' && address.protocol !== 'https:') {
    throw new Error('Your research service needs an HTTPS address to connect to this secure workspace.');
  }
  if (address.origin === app.origin) {
    throw new Error('This is the workspace address, not the research service. Enter the separately hosted Flask service address in Settings.');
  }
  return address.href.replace(/\/$/, '');
}

export async function api<T>(path: string, options: RequestInit = {}, candidateBase?: string): Promise<T> {
  const base = candidateBase ?? apiBase();
  if (!base) throw new Error('Connect your research service in Settings to continue.');
  const validated = typeof window !== 'undefined' ? validateApiBase(base, window.location.origin) : base;
  let response: Response;
  try {
    const headers = new Headers(options.headers);
    if (options.body) headers.set('Content-Type', 'application/json');
    response = await fetch(`${validated}${path}`, { ...options, headers, signal: AbortSignal.timeout(path === '/api/health' ? 120000 : 15000) });
  } catch { throw new Error('The research service could not be reached. Check its address and allowed origins in Settings.'); }
  const envelope = await response.json().catch(() => null);
  if (!envelope || typeof envelope.success !== 'boolean') throw new Error('This address did not return a MeetBrief research response. Enter the Flask service address, not the workspace address.');
  if (!response.ok || !envelope?.success) throw new Error(envelope?.error?.message || `The research service returned an error (${response.status}).`);
  return envelope.data as T;
}

export function safeUrl(url: string) {
  try { const value = new URL(url); return ['http:', 'https:'].includes(value.protocol) ? value.href : undefined; } catch { return undefined; }
}