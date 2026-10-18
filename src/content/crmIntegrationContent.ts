/**
 * Copy for the CRM Integration page (`pages/CrmIntegrationPage.tsx`).
 *
 * Kept out of the page for the same reason `demoContent.ts` is: a page file is
 * layout. The sample data the page draws lives in `mocks/crmConnection.ts`;
 * this file is only the words around it.
 */
import type {
  ConnectionState,
  DomainSyncState,
  MappingDirection,
} from '../mocks/crmConnection';

export const VENDOR_NAME = 'Example CRM';

export const CRM_INTEGRATION_COPY = {
  title: `${VENDOR_NAME} Integration`,
  subtitle:
    'Platform-wide connection and sync settings — one link to the CRM, shared by every domain that opts in',
  sampleNotice:
    'Sample data. No CRM is connected: every figure on this page comes from a static fixture, so the page reads the same on any server.',
  connectionTitle: 'Connection',
  connectionDescription: 'The vendor account this platform is linked to.',
  lastSyncTitle: 'Last sync',
  lastSyncDescription: 'The most recent run, across every syncing domain.',
  domainsTitle: 'Domains',
  domainsDescription:
    'Which domains sync with the CRM. Open one to see its users and their CRM linkage on that domain’s CRM Sync page.',
  mappingTitle: 'Field mapping',
  mappingDescription:
    'How Flow fields line up with CRM fields. A mapping belongs to the connection, so every syncing domain uses this one.',
  aboutTitle: 'Where this page fits',
  about: [
    'This page is registered into the Manage menu (after Call Logs) by a remote app through the Flow SDK — no host changes, and not limited to the Apps menu. It sits at plain /manage, so it is the same page for everyone: the place an administrator sees the CRM link itself.',
    'Per-domain detail is a different page. CRM Sync is registered once under /manage/:domain and reads the domain being managed with useManagingDomain(), so it changes as you drill into domains. Calls are not repeated here at all: Call Logs already lists them, and the CRM match rate for the calls you are looking at appears below that grid.',
    'In a real integration the connection would be established with auth.requestRemoteAuth (see the Remote Auth tab on the demo page), and this page would read its state from the vendor’s backend with the brokered token. Flow credentials never reach the remote app — only the vendor token does.',
  ],
} as const;

/** Chip label + palette colour per connection state. */
export const CONNECTION_STATE: Record<
  ConnectionState,
  { label: string; color: 'success' | 'warning' | 'error' }
> = {
  connected: { label: 'Connected', color: 'success' },
  degraded: { label: 'Degraded', color: 'warning' },
  disconnected: { label: 'Disconnected', color: 'error' },
};

/** Chip label + palette colour per domain sync state. */
export const DOMAIN_SYNC_STATE: Record<
  DomainSyncState,
  { label: string; color: 'success' | 'warning' | 'error' | 'default' }
> = {
  syncing: { label: 'Syncing', color: 'success' },
  paused: { label: 'Paused', color: 'warning' },
  error: { label: 'Failing', color: 'error' },
  off: { label: 'Not enabled', color: 'default' },
};

export const MAPPING_DIRECTION: Record<MappingDirection, string> = {
  push: 'Flow → CRM',
  pull: 'CRM → Flow',
  both: 'Both ways',
};

export const DOMAIN_HEADINGS = [
  'Domain',
  'Sync',
  'Linked users',
  'Last sync',
  '',
] as const;

export const MAPPING_HEADINGS = [
  'Flow field',
  `${VENDOR_NAME} field`,
  'Direction',
  'Rule',
] as const;
