/**
 * Tabs and cell declarations for the Live Operations page
 * (`pages/liveOperations/LiveOperationsPage.tsx`).
 *
 * Copy and layout facts only, kept out of the page for the same reason
 * `vendorDashboardContent.ts` is: a page file is layout, and the page pairs
 * each cell with its component by `id`. Ids double as React keys, so a cell
 * keeps its identity across the page's one-second re-renders.
 *
 * What the page leads with changed in 3.0.14. It used to open on a supervisor
 * wallboard — callers waiting, longest wait, agents free, answered and missed
 * tiles, a queue board, an agent status grid, a domain calls table — and had a
 * Phones tab of device registrations. Every one of those is a screen the host
 * already ships (the call-center supervisor dashboard, the wallboard report,
 * Active Calls, device registrations), drawn from the same feeds, so the page
 * argued that the SDK is a second way to get the platform's own UI. It now
 * leads with what only an app can show: what the host said about each feed,
 * and Flow's live calls joined to the partner's CRM.
 */

/** How wide a cell is, out of the page's 12-column Grid. */
export type LiveSpan = 'full' | 'half' | 'wide' | 'narrow' | 'four' | 'three';

export interface LiveCell {
  /** Pairs the cell with its component in the page's map. Stable. */
  id: string;
  /** `tile` draws a title over a StatBlock; `panel` a titled card. */
  kind: 'tile' | 'panel';
  title: string;
  description?: string;
  span: LiveSpan;
}

export interface LiveTab {
  value: string;
  label: string;
  icon: string;
  cells: LiveCell[];
}

export const LIVE_OPERATIONS_TITLE = 'Live Operations';
export const LIVE_OPERATIONS_SUBTITLE =
  'Flow’s live calls joined to Example CRM, every feed’s status as the host reports it, and the call-record lifecycle — pushed by sdk.streams, no polling.';

export const LIVE_TABS: LiveTab[] = [
  {
    value: 'overview',
    label: 'Overview',
    icon: 'mdi:view-dashboard',
    cells: [
      { id: 'live-ops-feeds', kind: 'tile', title: 'Feeds live', span: 'four' },
      {
        id: 'live-ops-known',
        kind: 'tile',
        title: 'CRM accounts on the line',
        span: 'four',
      },
      {
        id: 'live-ops-vips',
        kind: 'tile',
        title: 'VIPs on the line',
        span: 'four',
      },
      {
        id: 'live-ops-pipeline',
        kind: 'tile',
        title: 'Open deals on the line',
        span: 'four',
      },
      {
        id: 'live-ops-accounts',
        kind: 'panel',
        title: 'Customers on the line',
        description:
          'Every call with an Example CRM account — VIPs, then open deals by value, then longest on.',
        span: 'wide',
      },
      {
        id: 'live-ops-unknown',
        kind: 'panel',
        title: 'Not in the CRM',
        description: 'Outside callers with no record: leads to create',
        span: 'narrow',
      },
      {
        id: 'live-ops-feed-status',
        kind: 'panel',
        title: 'Feed status',
        description:
          'What the host said about each stream, for you. A refusal is the host’s own message.',
        span: 'wide',
      },
      {
        id: 'live-ops-notifications',
        kind: 'panel',
        title: 'Notifications',
        description: 'notifications.onNotification — yours and the domain’s',
        span: 'narrow',
      },
      {
        id: 'live-ops-trend',
        kind: 'panel',
        title: 'CRM accounts on the line, last 15 minutes',
        description:
          'Sampled every ten seconds since the app loaded, by the retained feed’s own handlers',
        span: 'full',
      },
    ],
  },
  {
    value: 'queues',
    label: 'Queues & agents',
    icon: 'mdi:account-group',
    cells: [
      {
        id: 'live-ops-waiting',
        kind: 'tile',
        title: 'Callers waiting',
        span: 'three',
      },
      {
        id: 'live-ops-longest-wait',
        kind: 'tile',
        title: 'Longest wait',
        span: 'three',
      },
      {
        id: 'live-ops-agents-free',
        kind: 'tile',
        title: 'Agents available',
        span: 'three',
      },
      {
        id: 'live-ops-queues',
        kind: 'panel',
        title: 'Queues and the accounts in them',
        description:
          'Click a queue for its waiting callers, each matched to the CRM (queues.onQueue, open only while the panel is).',
        span: 'full',
      },
      {
        id: 'live-ops-agents',
        kind: 'panel',
        title: 'Agents and the account on their call',
        description:
          'Four feeds and the CRM in one row: agent state, the call, its account, and whether the agent’s phone is registered.',
        span: 'full',
      },
    ],
  },
  {
    value: 'records',
    label: 'Call records',
    icon: 'mdi:phone-log',
    cells: [
      {
        id: 'live-ops-records',
        kind: 'tile',
        title: 'Calls ended',
        span: 'three',
      },
      {
        id: 'live-ops-record-updates',
        kind: 'tile',
        title: 'Record updates',
        span: 'three',
      },
      {
        id: 'live-ops-dispositioned',
        kind: 'tile',
        title: 'Dispositioned',
        span: 'three',
      },
      {
        id: 'live-ops-record-deliveries',
        kind: 'panel',
        title: 'Deliveries',
        description:
          'Every completed and updated event, newest first. An agent’s disposition or notes on a CRM account is the moment to write back.',
        span: 'full',
      },
      {
        id: 'live-ops-records-table',
        kind: 'panel',
        title: 'Finished calls',
        description:
          'cdrs.onDomain — domain admins only. Each row is the latest version of its record.',
        span: 'full',
      },
    ],
  },
  {
    value: 'notifications',
    label: 'Notifications',
    icon: 'mdi:bell-outline',
    cells: [
      {
        id: 'live-ops-send-notification',
        kind: 'panel',
        title: 'Send a notification',
        description: 'sdk.sendNotification(), to yourself',
        span: 'narrow',
      },
      {
        id: 'live-ops-received-notifications',
        kind: 'panel',
        title: 'Received',
        description: 'notifications.onNotification, newest first',
        span: 'wide',
      },
    ],
  },
  {
    value: 'people',
    label: 'People',
    icon: 'mdi:account-multiple',
    cells: [
      {
        id: 'live-ops-available',
        kind: 'tile',
        title: 'Available',
        span: 'three',
      },
      {
        id: 'live-ops-presence-summary',
        kind: 'panel',
        title: 'Presence',
        description: 'Changes as they happen; there is no starting snapshot',
        span: 'half',
      },
      {
        id: 'live-ops-user-changes',
        kind: 'panel',
        title: 'User record changes',
        description: 'subscribers.onDomain — domain admins only',
        span: 'half',
      },
      {
        id: 'live-ops-presence-list',
        kind: 'panel',
        title: 'Who changed status',
        span: 'full',
      },
    ],
  },
];
