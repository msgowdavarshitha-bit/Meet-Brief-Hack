import { describe, expect, it } from 'vitest';
import { researchWindow } from '@/lib/meeting';
import { safeUrl } from '@/lib/api';

describe('Meeting-relative research', () => {
  it('subtracts exactly 30 days from November 20, not from today', () => {
    expect(researchWindow('2026-11-20', '2026-11-20')).toMatchObject({ start: '2026-10-21', end: '2026-11-20' });
  });
  it('caps future research at today while retaining the meeting-relative start', () => {
    expect(researchWindow('2026-11-20', '2026-11-14')).toMatchObject({ start: '2026-10-21', end: '2026-11-14', future: true });
  });
  it('permits a past meeting with a warning flag', () => {
    expect(researchWindow('2026-01-10', '2026-11-14')).toMatchObject({ start: '2025-12-11', end: '2026-01-10', past: true });
  });
  it('handles leap years', () => {
    expect(researchWindow('2024-03-01', '2024-03-01').start).toBe('2024-01-31');
  });
  it('does not imply future evidence exists when the entire window is future', () => {
    expect(researchWindow('2027-02-01', '2026-11-14').empty).toBe(true);
  });
  it('rejects script source links', () => {
    expect(safeUrl('javascript:alert(1)')).toBeUndefined();
  });
});