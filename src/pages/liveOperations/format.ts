/** Formatting and tone helpers shared by the Live Operations cards. */
import type { CallParty, StreamStatus } from '@netsapiens/flow-sdk';

/** A call party as a person reads it: name, then extension, then number. */
export function party(p: CallParty): string {
  return p.name || p.user || p.number || 'Unknown';
}

export type Tone =
  | 'success'
  | 'warning'
  | 'error'
  | 'info'
  | 'neutral'
  | 'primary';

/** Map a semantic tone onto the colours a kit Chip accepts. */
export function chipColor(
  tone: Tone,
): 'success' | 'warning' | 'error' | 'info' | 'default' | 'primary' {
  return tone === 'neutral' ? 'default' : tone;
}

export function fmtSeconds(total: number): string {
  const s = Math.max(0, Math.floor(total));
  const m = Math.floor(s / 60);
  const h = Math.floor(m / 60);
  const mm = String(m % 60).padStart(h ? 2 : 1, '0');
  const ss = String(s % 60).padStart(2, '0');
  return h ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

export function since(iso: string | null, now: number): number {
  if (!iso) return 0;
  const t = Date.parse(iso);
  return Number.isNaN(t) ? 0 : (now - t) / 1000;
}

export function initials(name: string): string {
  const parts = name.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export const isBlocked = (s: StreamStatus) =>
  s.state === 'refused' ||
  s.state === 'unavailable' ||
  s.state === 'unconfirmed';

/** Past this many seconds a wait reads as critical, past half of it as a warning. */
export const CRITICAL_WAIT_SEC = 120;

export function waitTone(sec: number): Tone {
  if (sec >= CRITICAL_WAIT_SEC) return 'error';
  if (sec >= CRITICAL_WAIT_SEC / 2) return 'warning';
  return 'success';
}
