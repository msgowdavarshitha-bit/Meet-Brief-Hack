import { beforeEach, describe, expect, it, vi } from 'vitest';
import { api, validateApiBase } from '@/lib/api';

describe('External research service addresses', () => {
  it('rejects the reported localhost address from the hosted preview', () => {
    expect(() => validateApiBase('http://localhost:8080', 'https://4b7ac169-9893-4a1a-9ee5-9c3c63af0c6f.lovableproject.com')).toThrow(/localhost/);
  });
  it('rejects the workspace itself even during local development', () => {
    expect(() => validateApiBase('http://localhost:8080', 'http://localhost:8080')).toThrow(/workspace address/);
  });
  it('allows an independently running Flask service during local development', () => {
    expect(validateApiBase('http://localhost:5000/', 'http://localhost:8080')).toBe('http://localhost:5000');
  });
  it('rejects insecure services from HTTPS workspaces', () => {
    expect(() => validateApiBase('http://research.example.com', 'https://meetbrief.example.com')).toThrow(/HTTPS/);
  });
  it('accepts a hosted HTTPS service', () => {
    expect(validateApiBase('https://research.example.com/', 'https://meetbrief.example.com')).toBe('https://research.example.com');
  });
});

describe('Research requests', () => {
  beforeEach(() => { vi.restoreAllMocks(); });
  it('does not send an unnecessary JSON header with a health GET', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ success: true, data: {} })));
    await api('/api/health', {}, 'https://research.example.com');
    const options = fetchMock.mock.calls[0]?.[1];
    expect(new Headers(options?.headers).has('Content-Type')).toBe(false);
  });
  it('rejects a workspace HTML response rather than accepting it as service health', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('<html>Workspace</html>'));
    await expect(api('/api/health', {}, 'https://research.example.com')).rejects.toThrow(/did not return a MeetBrief/);
  });
});