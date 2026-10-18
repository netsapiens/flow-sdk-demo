/**
 * Sample recent-call fixtures, and the `RecentCall` shape `api/callsApi.ts`
 * normalizes the v2 CDR feed into.
 *
 * Each call's `party` is keyed to the shared CRM directory (`mocks/crm.ts`) so a
 * CRM lookup resolves a record for most rows — and one deliberately-unmatched
 * number shows the no-match state. The CRM Integration page used to list these
 * beside the user's live calls; it no longer does (that repeated Call Logs), so
 * nothing renders them today.
 */

export interface RecentCall {
  id: string;
  /** The other party — an E.164 number or internal extension (a CRM key). */
  party: string;
  /**
   * The other party's friendly display name from the API, when one is available
   * and human-readable. Used as the row label when there's no CRM match.
   */
  name?: string;
  direction: 'inbound' | 'outbound';
  /** Human-friendly relative time, e.g. "2m ago". */
  timeLabel: string;
  durationSeconds: number;
  answered: boolean;
  /** 'live' once fetched from the API proxy; 'sample' for these fixtures. */
  source: 'live' | 'sample';
}

export const SAMPLE_RECENT_CALLS: RecentCall[] = [
  {
    id: 'sample-1',
    party: '+15551234567',
    direction: 'inbound',
    timeLabel: '2m ago',
    durationSeconds: 184,
    answered: true,
    source: 'sample',
  },
  {
    id: 'sample-2',
    party: '+15559876543',
    direction: 'outbound',
    timeLabel: '11m ago',
    durationSeconds: 92,
    answered: true,
    source: 'sample',
  },
  {
    id: 'sample-3',
    party: '5226',
    direction: 'inbound',
    timeLabel: '38m ago',
    durationSeconds: 0,
    answered: false,
    source: 'sample',
  },
  {
    id: 'sample-4',
    party: '+15555555555',
    direction: 'inbound',
    timeLabel: '1h ago',
    durationSeconds: 421,
    answered: true,
    source: 'sample',
  },
  {
    id: 'sample-5',
    party: '3832',
    direction: 'outbound',
    timeLabel: '2h ago',
    durationSeconds: 256,
    answered: true,
    source: 'sample',
  },
  {
    id: 'sample-6',
    party: '+15550000000',
    direction: 'inbound',
    timeLabel: 'Yesterday',
    durationSeconds: 47,
    answered: true,
    source: 'sample',
  },
];

/** Format a duration in seconds as `m:ss`, or `—` for an unanswered call. */
export function formatDuration(seconds: number): string {
  if (!seconds) return '—';
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}
