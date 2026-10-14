/**
 * Recent-calls API helper for the CRM Integration page.
 *
 * Fetches the signed-in user's recent call detail records (CDRs) from the
 * NetSapiens v2 API through the SDK's authenticated `flowContext.api` proxy.
 * Credentials never reach this remote app — the host injects auth and audits the
 * call. The page falls back to sample data on any failure so it's never empty.
 *
 * The v2 CDR feed mixes genuine calls with registration-keepalive artifacts and
 * self/test calls. We read the real `call-*` field names the API returns and
 * filter the feed down to actual calls the signed-in user took part in, so the
 * page shows a clean call history (not registration noise or platform traffic).
 */
import type { FlowApiClient } from '@netsapiens/flow-sdk';

import type { RecentCall } from '../mocks/recentCalls';
import { normalizePhoneNumber } from '../mocks/crm';

/**
 * Raw NetSapiens v2 CDR record (the subset of fields the demo reads). The API
 * prefixes call fields with `call-` and encodes direction as an integer.
 */
interface NetSapiensCdr {
  id?: string;
  /** The other party as the API resolved it (e.g. `2364` or `sip:2364@netsapiens`). */
  number?: string;
  /** The other party's display name (e.g. `2364w`, `Flow Agent`). */
  name?: string;
  /** 0 = outbound, 1 = inbound (answered), 2 = inbound missed. */
  'call-direction'?: number | string;
  'call-start-datetime'?: string;
  'call-answer-datetime'?: string;
  'call-total-duration-seconds'?: number | string;
  /** Clean extension of the originating party (no device suffix). */
  'call-orig-user'?: string;
  /** Clean extension of the terminating party (no device suffix). */
  'call-term-user'?: string;
  /** The dialed destination on an outbound call. */
  'call-orig-to-user'?: string;
  'call-disconnect-reason-text'?: string;
}

function toSeconds(v: number | string | undefined): number {
  const n = typeof v === 'string' ? parseInt(v, 10) : (v ?? 0);
  return Number.isFinite(n) ? n : 0;
}

/**
 * The other party's friendly display name, if the API gives a human-readable
 * one. SIP-URI-shaped names (e.g. `sip:vmail-unreg@netsapiens`) aren't friendly,
 * so we skip them and let the caller fall back to the bare number.
 */
function friendlyName(name?: string): string | undefined {
  const trimmed = (name ?? '').trim();
  if (!trimmed || /^sips?:/i.test(trimmed) || trimmed.includes('@')) {
    return undefined;
  }
  return trimmed;
}

/** Format an ISO timestamp as a short, readable label; fall back to raw text. */
function formatTime(start?: string): string {
  if (!start) return '—';
  const d = new Date(start);
  if (Number.isNaN(d.getTime())) return start;
  return d.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

/**
 * A "non-real" CDR: not an actual call the user placed or received. We drop:
 *  - registration-keepalive artifacts (`Term: Reg Expired`), the bulk of the
 *    noise — these fire when a device's registration lapses, not on a real call;
 *  - self/test calls (orig and term are the same extension), e.g. the call-
 *    recording test legs that ring 3832 from 3832.
 */
function isNonRealCall(c: NetSapiensCdr): boolean {
  const reason = c['call-disconnect-reason-text'] ?? '';
  if (/reg expired/i.test(reason)) return true;
  const orig = c['call-orig-user'];
  const term = c['call-term-user'];
  if (orig && term && orig === term) return true;
  return false;
}

/**
 * Fetch the signed-in user's recent calls from the NetSapiens v2 API and
 * normalize them for the CRM Integration page.
 *
 * The raw feed is filtered to genuine calls the user took part in: registration
 * artifacts and self/test calls are dropped, and records are scoped to the
 * signed-in user (defends against the feed returning calls beyond their own).
 */
export async function fetchRecentCalls(
  domain: string,
  userId: string,
  apiClient: FlowApiClient,
): Promise<RecentCall[]> {
  if (!apiClient) throw new Error('API client is not defined');
  if (!domain) throw new Error('domain is required');
  if (!userId) throw new Error('userId is required');

  // User-scoped CDRs over REST. The host proxies this with the operator's
  // credentials; the remote only ever sees the relative path and the response.
  const path = `/domains/${domain}/users/${userId}/cdrs`;
  const cdrs = await apiClient.get<NetSapiensCdr[]>(path);

  return (cdrs ?? [])
    .map((c, i): RecentCall | null => {
      if (isNonRealCall(c)) return null;

      // Scope guard: keep only calls this user is actually a party to.
      const origUser = c['call-orig-user'];
      const termUser = c['call-term-user'];
      const isOutbound = origUser === userId;
      const isInbound = termUser === userId;
      if (!isOutbound && !isInbound) return null;

      // The API resolves the other party into `number`; fall back to the dialed
      // destination (outbound) or the originator (inbound) if it's absent.
      const rawParty =
        c.number ?? (isOutbound ? c['call-orig-to-user'] : origUser) ?? '';
      const party = normalizePhoneNumber(rawParty);
      if (!party) return null;

      const seconds = toSeconds(c['call-total-duration-seconds']);
      return {
        id: `live-${c.id ?? i}`,
        party,
        name: friendlyName(c.name),
        direction: isOutbound ? 'outbound' : 'inbound',
        timeLabel: formatTime(c['call-start-datetime']),
        durationSeconds: seconds,
        // Answered if the call connected (has an answer time or real talk time).
        answered: !!c['call-answer-datetime'] || seconds > 0,
        source: 'live',
      };
    })
    .filter((c): c is RecentCall => c !== null);
}
