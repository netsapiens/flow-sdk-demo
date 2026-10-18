/**
 * Mock CRM directory used to enrich inbound calls (see
 * `services/callEnrichment.ts`). In a real app these lookups would hit a CRM or
 * customer database; here they resolve from a static fixture so any demo call
 * shows a fully populated caller card.
 *
 * Internal extensions are derived from the shared `mocks/people.ts` directory so
 * the same people appear consistently across the demo (CRM + Hardphone Devices).
 *
 * `tier` and `opportunity` are the fields the cross-system views lean on: Live
 * Operations (`pages/liveOperations/crmViews.tsx`) and the Live call console
 * widget join Flow's live calls to them. Flow has no notion of either. That is
 * the point — they are facts only the partner's system holds, so a view built
 * on them is one the host cannot draw for itself.
 */
import { INTERNAL_PEOPLE } from './people';

/** An open sales opportunity, as the CRM describes it. */
export interface CrmOpportunity {
  name: string;
  /** Deal value in whole US dollars. */
  value: number;
  stage: 'Discovery' | 'Proposal' | 'Negotiation';
}

export interface CrmRecord {
  name: string;
  /** Org/team shown on the caller card. */
  company: string;
  lastContact: string;
  notes: string;
  callCount: number;
  /** The account's tier in the CRM. Absent means standard. */
  tier?: 'vip' | 'standard';
  /** An open deal on the account, when there is one. */
  opportunity?: CrmOpportunity;
}

/** External callers, keyed by E.164 number. */
const EXTERNAL_CALLERS: Record<string, CrmRecord> = {
  '+15551234567': {
    name: 'John Smith',
    company: 'Tech Solutions Inc.',
    lastContact: '2 days ago',
    notes: 'VIP customer — handle with priority',
    callCount: 15,
    tier: 'vip',
    opportunity: {
      name: 'Renewal + 40 seats',
      value: 48_000,
      stage: 'Negotiation',
    },
  },
  '+15559876543': {
    name: 'Sarah Johnson',
    company: 'Global Enterprises',
    lastContact: '1 week ago',
    notes: 'Follow up on quote from last week',
    callCount: 3,
    opportunity: {
      name: 'Contact-center pilot',
      value: 12_500,
      stage: 'Proposal',
    },
  },
  '+15555555555': {
    name: 'Example Corp Support',
    company: 'Example Corporation',
    lastContact: '3 hours ago',
    notes: 'Support escalation — ticket #12345',
    callCount: 47,
    tier: 'vip',
  },
};

/**
 * CRM-specific extras for internal people, keyed by extension.
 *
 * Some carry a tier or an opportunity too. On a development domain nearly every
 * call is extension to extension, and the cross-system views would otherwise
 * have nothing to flag; dressing a few colleagues up as accounts is demo
 * licence, not a model to copy.
 */
const INTERNAL_CRM_EXTRAS: Record<
  string,
  Pick<
    CrmRecord,
    'lastContact' | 'notes' | 'callCount' | 'tier' | 'opportunity'
  >
> = {
  '2001': {
    lastContact: 'Yesterday',
    notes: 'Team lead — internal extension',
    callCount: 8,
  },
  '2002': {
    lastContact: '2 hours ago',
    notes: 'Tier-2 support engineer',
    callCount: 2,
  },
  '2009': {
    lastContact: 'Today',
    notes:
      'Reseller / channel partner — resells Flow across their territory (40+ domains). White-glove handling; route to partner success.',
    callCount: 22,
    tier: 'vip',
    opportunity: {
      name: 'Territory expansion',
      value: 96_000,
      stage: 'Discovery',
    },
  },
  '2364': {
    lastContact: 'This morning',
    notes: 'Senior Developer — Project Phoenix lead',
    callCount: 12,
  },
  '3832': {
    lastContact: '30 minutes ago',
    notes: 'Product Manager — requesting demo of new features',
    callCount: 5,
    opportunity: { name: 'Analytics add-on', value: 7_200, stage: 'Proposal' },
  },
  '5226': {
    lastContact: '1 hour ago',
    notes: 'Executive escalation — engineering leadership',
    callCount: 9,
    tier: 'vip',
  },
  '6767': {
    lastContact: 'Opening Day',
    notes: 'Basic user · die-hard Padres fan — keep it brown & gold',
    callCount: 6,
  },
};

/**
 * Single source of truth for caller enrichment — external callers plus internal
 * extensions (identity from `people.ts`, CRM extras from above), keyed by the
 * normalized phone number / extension.
 */
export const MOCK_CRM_DIRECTORY: Record<string, CrmRecord> = {
  ...EXTERNAL_CALLERS,
  ...Object.fromEntries(
    INTERNAL_PEOPLE.filter((p) => INTERNAL_CRM_EXTRAS[p.extension]).map((p) => [
      p.extension,
      {
        name: p.name,
        company: p.department,
        ...INTERNAL_CRM_EXTRAS[p.extension],
      },
    ]),
  ),
};

/**
 * Normalize a SIP URI to a bare number/extension for CRM lookup.
 * Example: `sip:2364w@netsapiens` -> `2364`.
 */
export function normalizePhoneNumber(sipUri: string): string {
  return sipUri
    .replace(/^sip:/, '') // drop the sip: scheme
    .split('@')[0] // drop the @domain part
    .replace(/w$/, ''); // drop the trailing 'w' NetSapiens appends
}

/** Look up a CRM record by raw (already-normalized) phone number or extension. */
export function lookupCrmRecord(phoneNumber: string): CrmRecord | undefined {
  return MOCK_CRM_DIRECTORY[phoneNumber];
}

/**
 * Every key a raw number could be filed under in the directory above. Call-log
 * rows carry the far end in whatever shape the switch recorded it — a SIP URI
 * (`sip:631@host`), a bare extension, a ten- or eleven-digit number with or
 * without its `+` — while the fixture keys external callers by E.164. Trying
 * each spelling in turn is the honest version of what a real CRM connector does
 * before it gives up on a match.
 */
export function crmLookupKeys(raw: string): string[] {
  const bare = normalizePhoneNumber(raw.trim());
  const digits = bare.replace(/\D/g, '');
  const keys = [bare, digits, `+${digits}`];
  if (digits.length === 10) keys.push(`+1${digits}`);
  return [...new Set(keys.filter((k) => k && k !== '+'))];
}

/** First directory hit for any spelling of `raw`, with the key it matched on. */
export function findCrmRecord(
  raw: string,
): { key: string; record: CrmRecord } | undefined {
  for (const key of crmLookupKeys(raw)) {
    const record = lookupCrmRecord(key);
    if (record) return { key, record };
  }
  return undefined;
}

/**
 * The CRM record behind a call party, if any. A stream names a party by
 * extension (`user`), by number, or both, and the number may still be a SIP
 * URI: try each through `findCrmRecord`, and take the first that resolves.
 */
export function matchCrmParty(party: {
  user?: string;
  number?: string;
}): CrmRecord | undefined {
  for (const raw of [party.number, party.user]) {
    if (!raw) continue;
    const hit = findCrmRecord(raw);
    if (hit) return hit.record;
  }
  return undefined;
}

/**
 * Case-insensitive search over name, company and number — what a CRM's own
 * "find a contact" box does, against the fixture instead of a vendor API. An
 * empty query returns the whole directory, which is small enough to list.
 */
export function searchCrmDirectory(
  query: string,
): Array<{ key: string; record: CrmRecord }> {
  const q = query.trim().toLowerCase();
  const qDigits = q.replace(/\D/g, '');
  return Object.entries(MOCK_CRM_DIRECTORY)
    .filter(
      ([key, r]) =>
        !q ||
        r.name.toLowerCase().includes(q) ||
        r.company.toLowerCase().includes(q) ||
        // Digits only, so "555 123" finds +15551234567.
        (qDigits.length > 0 && key.replace(/\D/g, '').includes(qDigits)),
    )
    .map(([key, record]) => ({ key, record }));
}

/** `$48k`, `$7.2k`: an opportunity's value at a glance. */
export function formatDealValue(value: number): string {
  if (value < 1_000) return `$${value}`;
  const k = value / 1_000;
  return `$${k >= 10 ? Math.round(k) : k.toFixed(1).replace(/\.0$/, '')}k`;
}
