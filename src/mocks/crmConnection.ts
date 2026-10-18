/**
 * Platform-level CRM connection fixtures for the CRM Integration page
 * (`pages/CrmIntegrationPage.tsx`).
 *
 * The page is the *connection* view: one vendor account, wired up once for the
 * whole platform, and the list of domains that have opted into syncing with it.
 * Nothing here is per-user or per-call — that is what Call Logs and the
 * domain-scoped CRM Sync page are for.
 *
 * All of it is static. No CRM is connected; the page labels every figure as
 * sample data. The record counts are derived from the shared CRM directory in
 * `crm.ts` where they can be, so the numbers on this page agree with the ones
 * the dashboard's CRM sync queue drains.
 */
import { MOCK_CRM_DIRECTORY } from './crm';

export type ConnectionState = 'connected' | 'degraded' | 'disconnected';

export interface CrmConnection {
  state: ConnectionState;
  /** The vendor-side account (tenant) the platform is linked to. */
  account: string;
  /** Who linked it, and how — the remoteAuth handshake a real app would run. */
  connectedBy: string;
  authMethod: string;
  /** Scopes the vendor token was minted with. */
  scopes: readonly string[];
  /** Human labels: the fixture has no clock, so it cannot go stale. */
  connectedSince: string;
  lastSync: string;
  nextSync: string;
  /** Records the last run pushed or pulled across every syncing domain. */
  lastRunRecords: number;
  lastRunFailures: number;
}

export const SAMPLE_CONNECTION: CrmConnection = {
  state: 'connected',
  account: 'example-crm / tenant 40871',
  connectedBy: 'Platform administrator',
  authMethod: 'OAuth 2.0 via auth.requestRemoteAuth',
  scopes: ['contacts:read', 'contacts:write', 'activities:write'],
  connectedSince: '12 Aug 2026',
  lastSync: '4 minutes ago',
  nextSync: 'in 11 minutes',
  lastRunRecords: Object.keys(MOCK_CRM_DIRECTORY).length,
  lastRunFailures: 2,
};

export type DomainSyncState = 'syncing' | 'paused' | 'error' | 'off';

export interface DomainSyncRow {
  domain: string;
  state: DomainSyncState;
  /** Domain users linked to a CRM contact. */
  linkedUsers: number;
  totalUsers: number;
  lastSync: string;
}

/**
 * Domains and their sync state. A real integration would read this from its
 * own backend — which domains an administrator enabled — not from the host.
 * The page prepends the signed-in user's own domain so at least one row's
 * "Open" link lands on a domain that exists on the server you are looking at.
 */
export const SAMPLE_DOMAIN_SYNC: readonly DomainSyncRow[] = [
  {
    domain: 'acme.example.com',
    state: 'syncing',
    linkedUsers: 38,
    totalUsers: 42,
    lastSync: '4 minutes ago',
  },
  {
    domain: 'northwind.example.com',
    state: 'syncing',
    linkedUsers: 112,
    totalUsers: 130,
    lastSync: '4 minutes ago',
  },
  {
    domain: 'contoso.example.com',
    state: 'error',
    linkedUsers: 9,
    totalUsers: 27,
    lastSync: '3 hours ago',
  },
  {
    domain: 'fabrikam.example.com',
    state: 'paused',
    linkedUsers: 0,
    totalUsers: 15,
    lastSync: 'Paused 2 days ago',
  },
  {
    domain: 'globex.example.com',
    state: 'off',
    linkedUsers: 0,
    totalUsers: 64,
    lastSync: 'Never',
  },
];

export type MappingDirection = 'push' | 'pull' | 'both';

export interface FieldMapping {
  /** The Flow / NetSapiens v2 field. */
  flowField: string;
  /** The vendor CRM field it maps to. */
  crmField: string;
  direction: MappingDirection;
  /** One line on why the mapping goes the way it does. */
  note: string;
}

/**
 * How Flow records line up with the vendor's. Platform-wide, because a field
 * mapping is a property of the connection — every syncing domain uses this one.
 */
export const SAMPLE_FIELD_MAPPINGS: readonly FieldMapping[] = [
  {
    flowField: 'name-first-name + name-last-name',
    crmField: 'contact.full_name',
    direction: 'both',
    note: 'Last write wins',
  },
  {
    flowField: 'email',
    crmField: 'contact.email',
    direction: 'both',
    note: 'Match key for existing contacts',
  },
  {
    flowField: 'extension',
    crmField: 'contact.phone_ext',
    direction: 'push',
    note: 'Flow owns the dial plan',
  },
  {
    flowField: 'caller-id-number',
    crmField: 'contact.phone',
    direction: 'push',
    note: 'Normalised to E.164',
  },
  {
    flowField: 'department',
    crmField: 'account.team',
    direction: 'pull',
    note: 'The CRM owns the org chart',
  },
  {
    flowField: 'call-*  (CDR)',
    crmField: 'activity.call',
    direction: 'push',
    note: 'Logged against the matched contact',
  },
];
