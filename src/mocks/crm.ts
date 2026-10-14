/**
 * Mock CRM directory used to enrich inbound calls (see
 * `services/callEnrichment.ts`). In a real app these lookups would hit a CRM or
 * customer database; here they resolve from a static fixture so any demo call
 * shows a fully populated caller card.
 *
 * Internal extensions are derived from the shared `mocks/people.ts` directory so
 * the same people appear consistently across the demo (CRM + Hardphone Devices).
 */
import { INTERNAL_PEOPLE } from './people';

export interface CrmRecord {
  name: string;
  /** Org/team shown on the caller card. */
  company: string;
  lastContact: string;
  notes: string;
  callCount: number;
}

/** External callers, keyed by E.164 number. */
const EXTERNAL_CALLERS: Record<string, CrmRecord> = {
  '+15551234567': {
    name: 'John Smith',
    company: 'Tech Solutions Inc.',
    lastContact: '2 days ago',
    notes: 'VIP customer — handle with priority',
    callCount: 15,
  },
  '+15559876543': {
    name: 'Sarah Johnson',
    company: 'Global Enterprises',
    lastContact: '1 week ago',
    notes: 'Follow up on quote from last week',
    callCount: 3,
  },
  '+15555555555': {
    name: 'Example Corp Support',
    company: 'Example Corporation',
    lastContact: '3 hours ago',
    notes: 'Support escalation — ticket #12345',
    callCount: 47,
  },
};

/** CRM-specific extras for internal people, keyed by extension. */
const INTERNAL_CRM_EXTRAS: Record<
  string,
  Pick<CrmRecord, 'lastContact' | 'notes' | 'callCount'>
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
  },
  '5226': {
    lastContact: '1 hour ago',
    notes: 'Executive escalation — engineering leadership',
    callCount: 9,
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
