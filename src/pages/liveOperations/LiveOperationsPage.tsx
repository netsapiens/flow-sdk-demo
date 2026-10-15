import type {
  DashboardTemplateWidget,
  DashboardTemplateWidgetProps,
  RemoteAppSDK,
} from '@netsapiens/flow-sdk';
import type { ComponentType } from 'react';
import { useState } from 'react';
import { useFlowContext } from '@netsapiens/flow-sdk';

import { type ZoneMarkerProps } from '../../integration/withZoneTestId';
import {
  ActivityChart,
  AgentsCard,
  AgentsFreeStat,
  AnsweredStat,
  AvailableStat,
  CallRecordsCard,
  CallsCard,
  CallsStat,
  DispositionedStat,
  LongestWaitStat,
  MissedRateStat,
  NotificationsCard,
  PhonesCard,
  PhonesStat,
  PresenceListCard,
  PresenceSummaryCard,
  QueuesCard,
  RecordDeliveriesCard,
  RecordsStat,
  RecordUpdatesStat,
  UserChangesCard,
  WaitingStat,
} from './cards';
import { CRITICAL_WAIT_SEC } from './format';
import { QueuePickContext } from './liveContext';
import { LiveProvider } from './liveState';
import { QueuePanel } from './QueuePanel';
import { AgentBoardCard, LongestWaitsCard, OutcomesCard } from './wallboard';

/**
 * Live Operations — a wallboard built entirely on `sdk.streams`, drawn entirely
 * with the host's kit.
 *
 * The page is a `DashboardTemplate`: the host draws the header, the grid and
 * every card frame, exactly as on its own dashboards. Tabs (`ui.Tabs`, in the
 * header's `actions` slot) switch which cards it shows:
 *
 *   Overview  a wallboard: six headline StatBlocks with sparklines, the queue
 *             table, longest waits, the agent status board, call outcomes, the
 *             trend Chart, live calls, notifications
 *   Queues    queue table (click a row → SidePanel opening `queues.onQueue`),
 *             agents
 *   People    presence Donut and list, user record changes
 *   Phones    device registration
 *   Call records  finished calls (`cdrs.onDomain`), and each record's later updates
 *                 as its recording, call quality and disposition land
 *
 * Every feed is opened once by `LiveProvider` (liveState.tsx), above the
 * template, so switching tabs or the host remounting a card never reopens one,
 * and the trend history keeps running on every tab.
 *
 * What the page is there to show, beyond the data:
 *
 *   - **Status is part of the UI.** Every card shows its stream's status. A
 *     `refused` stream carries a message the host wrote for the user — domain
 *     calls, user records and queue caller details are for domain admins, and
 *     everyone else sees why instead of an empty card.
 *   - **One feed per need.** Queue stats and agents are two subscriptions to
 *     the same method; the host shares the socket room between them.
 *   - **Lifetimes follow the UI.** The queue drill-down's `onQueue` exists only
 *     while its panel is open.
 *   - **Grants come from the bundle.** Nothing here names a permission. The
 *     platform reads these calls out of the bundle when a version is submitted
 *     and derives the grants from them.
 */

interface LiveOperationsPageProps extends ZoneMarkerProps {
  /** The app's SDK instance, handed down by App.tsx. Pages have no other way to it. */
  sdk: RemoteAppSDK;
}

type Component = ComponentType<DashboardTemplateWidgetProps>;
const leaf = (id: string, title: string, component: Component) => ({
  id,
  title,
  component,
});

// Declared at module scope: the template keys cards by id, and a new component
// identity on every render would remount every card each second.

// The Overview reads like a contact-centre wallboard: six headline figures in
// one row, then who is waiting, then who is free, then how calls are ending.
// Two half-width cards of three leaves each, because a full-width card lays its
// leaves out four to a row and six would wrap.
const OVERVIEW: DashboardTemplateWidget[] = [
  {
    id: 'live-ops-now',
    title: 'Queues',
    size: 'half',
    height: 2,
    refreshPolicy: 'realtime',
    leaves: [
      leaf('live-ops-waiting', 'Callers waiting', WaitingStat),
      leaf('live-ops-longest-wait', 'Longest wait', LongestWaitStat),
      leaf('live-ops-agents-free', 'Agents available', AgentsFreeStat),
    ],
  },
  {
    id: 'live-ops-calls-now',
    title: 'Calls',
    size: 'half',
    height: 2,
    refreshPolicy: 'realtime',
    leaves: [
      leaf('live-ops-calls', 'Active calls', CallsStat),
      leaf('live-ops-answered', 'Answered', AnsweredStat),
      leaf('live-ops-missed', 'Missed rate', MissedRateStat),
    ],
  },
  {
    id: 'live-ops-queues-now',
    title: 'Queues right now',
    description: 'Busiest first. Click a queue for its callers.',
    size: 'half',
    height: 5,
    refreshPolicy: 'realtime',
    component: QueuesCard,
  },
  {
    id: 'live-ops-longest-waits',
    title: 'Longest waits',
    description: `The bar fills toward ${CRITICAL_WAIT_SEC / 60} minutes, the critical wait`,
    size: 'half',
    height: 5,
    refreshPolicy: 'realtime',
    component: LongestWaitsCard,
  },
  {
    id: 'live-ops-agent-board',
    title: 'Agent status',
    size: 'half',
    height: 5,
    refreshPolicy: 'realtime',
    component: AgentBoardCard,
  },
  {
    id: 'live-ops-outcomes',
    title: 'Outcomes',
    description: 'cdrs.onDomain — calls ended since the app loaded',
    size: 'half',
    height: 5,
    refreshPolicy: 'realtime',
    component: OutcomesCard,
  },
  {
    id: 'live-ops-trend',
    title: 'Last 15 minutes',
    description: 'Sampled every ten seconds since the app loaded',
    size: 'full',
    height: 4,
    refreshPolicy: 'realtime',
    component: ActivityChart,
  },
  {
    id: 'live-ops-calls-table',
    title: 'Live calls in the domain',
    description: 'calls.onDomainCalls — domain admins only',
    size: 'half',
    height: 5,
    refreshPolicy: 'realtime',
    component: CallsCard,
  },
  {
    id: 'live-ops-notifications',
    title: 'Notifications',
    description: 'notifications.onNotification — yours and the domain’s',
    size: 'half',
    height: 5,
    refreshPolicy: 'realtime',
    component: NotificationsCard,
  },
];

const QUEUES: DashboardTemplateWidget[] = [
  {
    id: 'live-ops-queues',
    title: 'Queues',
    description: 'Click a queue for its live detail',
    size: 'full',
    height: 5,
    refreshPolicy: 'realtime',
    component: QueuesCard,
  },
  {
    id: 'live-ops-agents',
    title: 'Agents',
    description: 'Agent state across the domain’s queues',
    size: 'full',
    height: 5,
    refreshPolicy: 'realtime',
    component: AgentsCard,
  },
];

const PEOPLE: DashboardTemplateWidget[] = [
  {
    id: 'live-ops-people-now',
    title: 'Right now',
    size: 'full',
    height: 2,
    refreshPolicy: 'realtime',
    leaves: [leaf('live-ops-available', 'Available', AvailableStat)],
  },
  {
    id: 'live-ops-presence-summary',
    title: 'Presence',
    description: 'Changes as they happen; there is no starting snapshot',
    size: 'half',
    height: 4,
    refreshPolicy: 'realtime',
    component: PresenceSummaryCard,
  },
  {
    id: 'live-ops-user-changes',
    title: 'User record changes',
    description: 'subscribers.onDomain — domain admins only',
    size: 'half',
    height: 4,
    refreshPolicy: 'realtime',
    component: UserChangesCard,
  },
  {
    id: 'live-ops-presence-list',
    title: 'Who changed status',
    size: 'full',
    height: 5,
    refreshPolicy: 'realtime',
    component: PresenceListCard,
  },
];

const PHONES: DashboardTemplateWidget[] = [
  {
    id: 'live-ops-phones-now',
    title: 'Right now',
    size: 'half',
    height: 2,
    refreshPolicy: 'realtime',
    leaves: [leaf('live-ops-phones', 'Phones registered', PhonesStat)],
  },
  {
    id: 'live-ops-phones-table',
    title: 'Phone registration',
    description:
      'devices.onDomain — admins see the domain, others their own phones',
    size: 'full',
    height: 6,
    refreshPolicy: 'realtime',
    component: PhonesCard,
  },
];

const RECORDS: DashboardTemplateWidget[] = [
  {
    id: 'live-ops-records-now',
    title: 'Since this page opened',
    size: 'full',
    height: 2,
    refreshPolicy: 'realtime',
    leaves: [
      leaf('live-ops-records', 'Calls ended', RecordsStat),
      leaf('live-ops-record-updates', 'Record updates', RecordUpdatesStat),
      leaf('live-ops-dispositioned', 'Dispositioned', DispositionedStat),
    ],
  },
  {
    id: 'live-ops-records-table',
    title: 'Finished calls',
    description:
      'cdrs.onDomain — domain admins only. Each row is the latest version of its record.',
    size: 'full',
    height: 6,
    refreshPolicy: 'realtime',
    component: CallRecordsCard,
  },
  {
    id: 'live-ops-record-deliveries',
    title: 'Deliveries',
    description: 'Every completed and updated event, newest first',
    size: 'full',
    height: 5,
    refreshPolicy: 'realtime',
    component: RecordDeliveriesCard,
  },
];

const TABS = [
  {
    value: 'overview',
    label: 'Overview',
    icon: 'mdi:view-dashboard',
    widgets: OVERVIEW,
  },
  {
    value: 'queues',
    label: 'Queues',
    icon: 'mdi:account-group',
    widgets: QUEUES,
  },
  {
    value: 'people',
    label: 'People',
    icon: 'mdi:account-multiple',
    widgets: PEOPLE,
  },
  {
    value: 'phones',
    label: 'Phones',
    icon: 'mdi:phone-classic',
    widgets: PHONES,
  },
  {
    value: 'records',
    label: 'Call records',
    icon: 'mdi:phone-log',
    widgets: RECORDS,
  },
];

export default function LiveOperationsPage({
  sdk,
  ...marker
}: LiveOperationsPageProps) {
  const { ui } = useFlowContext();
  const [tab, setTab] = useState<string>('overview');
  const [queue, setQueue] = useState<string | null>(null);

  const DashboardTemplate = ui?.templates?.DashboardTemplate;
  const { Box, Tabs } = ui ?? {};

  // Carve-out: without the kit there is no page to draw.
  if (!DashboardTemplate || !Box || !Tabs) {
    return (
      <div {...marker} style={{ padding: 24 }}>
        Dashboard template not available
      </div>
    );
  }

  const current = TABS.find((t) => t.value === tab) ?? TABS[0];

  return (
    // `Box`, not a bare div: the marker needs a root to ride on.
    <Box {...marker}>
      <LiveProvider sdk={sdk}>
        <QueuePickContext.Provider value={setQueue}>
          <DashboardTemplate
            title='Live Operations'
            subtitle='Queues, agents, calls, call records, people and phones — pushed by sdk.streams, no polling.'
            actions={
              <Tabs
                variant='pill'
                options={TABS.map(({ value, label, icon }) => ({
                  value,
                  label,
                  icon,
                }))}
                value={tab}
                onChange={(v) => setTab(String(v))}
              />
            }
            widgets={current.widgets}
          />
          <QueuePanel queue={queue} onClose={() => setQueue(null)} />
        </QueuePickContext.Provider>
      </LiveProvider>
    </Box>
  );
}
