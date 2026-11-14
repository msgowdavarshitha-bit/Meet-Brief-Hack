export type Meeting = { meeting_id: string; name: string; type: string; purpose: string; meeting_datetime: string; timezone: string; created_at: string; briefing_id?: string };
export type Health = { tavily: { status: string }; bifrost: { status: string }; mongodb: { status: string } };
export type Run = { run_id: string; status: string; briefing_id?: string; stages: { name: string; status: string }[]; counters: { tavily_queries: number; sources_retrieved: number; sources_deduped: number; bifrost_calls: number }; model?: string; error?: string };
export type Briefing = { briefing_id: string; name: string; meeting_datetime: string; purpose: string; executive_summary: string; background: string[]; recent_developments: { claim: string; status: string; date: string | null; source_ids: number[]; excerpt?: string }[]; opportunities: string[]; risks: string[]; questions: { question: string; rationale: string }[]; sources: { id: number; title: string; url: string; publisher: string; published_date: string | null }[]; research_metadata: { window: { start: string; end: string }; queries: string[]; model: string; source_count: number } };

export function apiBase() {
  const configured = import.meta.env['VITE_API_BASE_URL'] as string | undefined;
  const saved = typeof window !== 'undefined' ? window.sessionStorage.getItem('meetbrief-api-url') : null;
  return (saved || configured || '').replace(/\/$/, '');
}

export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const base = apiBase();
  if (!base) throw new Error('Connect your research service in Settings to continue.');
  let response: Response;
  try {
    response = await fetch(`${base}${path}`, { ...options, headers: { 'Content-Type': 'application/json', ...options.headers }, signal: AbortSignal.timeout(15000) });
  } catch { throw new Error('The research service could not be reached. Check its address and allowed origins in Settings.'); }
  const envelope = await response.json().catch(() => null);
  if (!response.ok || !envelope?.success) throw new Error(envelope?.error?.message || `The research service returned an error (${response.status}).`);
  return envelope.data as T;
}

export function safeUrl(url: string) {
  try { const value = new URL(url); return ['http:', 'https:'].includes(value.protocol) ? value.href : undefined; } catch { return undefined; }
}