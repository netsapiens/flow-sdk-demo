import type { RemoteAppSDK } from '@netsapiens/flow-sdk';
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
import { Panel, Tile } from './parts';
import { QueuePanel } from './QueuePanel';
import { AgentBoardCard, LongestWaitsCard, OutcomesCard } from './wallboard';

/**
 * Live Operations — a wallboard built entirely on `sdk.streams`, drawn entirely
 * with the host's kit.
 *
 * The page is a `PageTemplate` laid out with the kit's `Grid`, every panel a
 * rounded `Card` (see `Panel` and `Tile` in parts.tsx). It used to be a
 * `DashboardTemplate`, but the host draws dashboard cards square by design, and
 * this page reads as a reports wallboard with rounded cards and uneven columns
 * (8/4), which the template's half/full sizes cannot express. Tabs (`ui.Tabs`,
 * in the header's `actions` slot) switch which panels it shows:
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
 * panels, so switching tabs never reopens one, and the trend history keeps
 * running on every tab.
 *
 * What the page is there to show, beyond the data:
 *
 *   - **Status is part of the UI.** Every panel shows its stream's status. A
 *     `refused` stream carries a message the host wrote for the user — domain
 *     calls, user records and queue caller details are for domain admins, and
 *     everyone else sees why instead of an empty panel.
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

/** Grid columns out of 12, per breakpoint. */
type Span = { xs?: number; sm?: number; md?: number; lg?: number };

/** One cell of a tab: a headline tile or a panel. */
interface Cell {
  id: string;
  kind: 'tile' | 'panel';
  title: string;
  description?: string;
  span: Span;
  body: ComponentType;
}

const FULL: Span = { xs: 12 };
const HALF: Span = { xs: 12, lg: 6 };
const WIDE: Span = { xs: 12, lg: 8 };
const NARROW: Span = { xs: 12, lg: 4 };
const SIX_UP: Span = { xs: 12, sm: 6, md: 4, lg: 2 };
const THREE_UP: Span = { xs: 12, sm: 4 };

const tile = (
  id: string,
  title: string,
  body: ComponentType,
  span = SIX_UP,
): Cell => ({
  id,
  kind: 'tile',
  title,
  span,
  body,
});
const panel = (
  id: string,
  title: string,
  body: ComponentType,
  span: Span,
  description?: string,
): Cell => ({ id, kind: 'panel', title, description, span, body });

// Declared at module scope so each panel keeps its component identity across
// the page's one-second re-renders.

const OVERVIEW: Cell[] = [
  tile('live-ops-waiting', 'Callers waiting', WaitingStat),
  tile('live-ops-longest-wait', 'Longest wait', LongestWaitStat),
  tile('live-ops-agents-free', 'Agents available', AgentsFreeStat),
  tile('live-ops-calls', 'Active calls', CallsStat),
  tile('live-ops-answered', 'Answered', AnsweredStat),
  tile('live-ops-missed', 'Missed rate', MissedRateStat),
  panel(
    'live-ops-queues-now',
    'Queues right now',
    QueuesCard,
    WIDE,
    'Busiest first. Click a queue for its callers.',
  ),
  panel(
    'live-ops-longest-waits',
    'Longest waits',
    LongestWaitsCard,
    NARROW,
    `Critical after ${CRITICAL_WAIT_SEC / 60} minutes`,
  ),
  panel('live-ops-agent-board', 'Agent status', AgentBoardCard, WIDE),
  panel(
    'live-ops-outcomes',
    'Outcomes',
    OutcomesCard,
    NARROW,
    'Calls ended since the app loaded',
  ),
  panel(
    'live-ops-trend',
    'Last 15 minutes',
    ActivityChart,
    FULL,
    'Sampled every ten seconds since the app loaded',
  ),
  panel(
    'live-ops-calls-table',
    'Live calls in the domain',
    CallsCard,
    HALF,
    'calls.onDomainCalls — domain admins only',
  ),
  panel(
    'live-ops-notifications',
    'Notifications',
    NotificationsCard,
    HALF,
    'notifications.onNotification — yours and the domain’s',
  ),
];

const QUEUES: Cell[] = [
  panel(
    'live-ops-queues',
    'Queues',
    QueuesCard,
    FULL,
    'Click a queue for its live detail',
  ),
  panel(
    'live-ops-agents',
    'Agents',
    AgentsCard,
    FULL,
    'Agent state across the domain’s queues',
  ),
];

const PEOPLE: Cell[] = [
  tile('live-ops-available', 'Available', AvailableStat, THREE_UP),
  panel(
    'live-ops-presence-summary',
    'Presence',
    PresenceSummaryCard,
    HALF,
    'Changes as they happen; there is no starting snapshot',
  ),
  panel(
    'live-ops-user-changes',
    'User record changes',
    UserChangesCard,
    HALF,
    'subscribers.onDomain — domain admins only',
  ),
  panel('live-ops-presence-list', 'Who changed status', PresenceListCard, FULL),
];

const PHONES: Cell[] = [
  tile('live-ops-phones', 'Phones registered', PhonesStat, THREE_UP),
  panel(
    'live-ops-phones-table',
    'Phone registration',
    PhonesCard,
    FULL,
    'devices.onDomain — admins see the domain, others their own phones',
  ),
];

const RECORDS: Cell[] = [
  tile('live-ops-records', 'Calls ended', RecordsStat, THREE_UP),
  tile(
    'live-ops-record-updates',
    'Record updates',
    RecordUpdatesStat,
    THREE_UP,
  ),
  tile('live-ops-dispositioned', 'Dispositioned', DispositionedStat, THREE_UP),
  panel(
    'live-ops-records-table',
    'Finished calls',
    CallRecordsCard,
    FULL,
    'cdrs.onDomain — domain admins only. Each row is the latest version of its record.',
  ),
  panel(
    'live-ops-record-deliveries',
    'Deliveries',
    RecordDeliveriesCard,
    FULL,
    'Every completed and updated event, newest first',
  ),
];

const TABS = [
  {
    value: 'overview',
    label: 'Overview',
    icon: 'mdi:view-dashboard',
    cells: OVERVIEW,
  },
  {
    value: 'queues',
    label: 'Queues',
    icon: 'mdi:account-group',
    cells: QUEUES,
  },
  {
    value: 'people',
    label: 'People',
    icon: 'mdi:account-multiple',
    cells: PEOPLE,
  },
  {
    value: 'phones',
    label: 'Phones',
    icon: 'mdi:phone-classic',
    cells: PHONES,
  },
  {
    value: 'records',
    label: 'Call records',
    icon: 'mdi:phone-log',
    cells: RECORDS,
  },
];

export default function LiveOperationsPage({
  sdk,
  ...marker
}: LiveOperationsPageProps) {
  const { ui } = useFlowContext();
  const [tab, setTab] = useState<string>('overview');
  const [queue, setQueue] = useState<string | null>(null);

  const PageTemplate = ui?.templates?.PageTemplate;
  const { Box, Grid, Tabs } = ui ?? {};

  // Carve-out: without the kit there is no page to draw.
  if (!PageTemplate || !Box || !Grid || !Tabs) {
    return (
      <div {...marker} style={{ padding: 24 }}>
        Page template not available
      </div>
    );
  }

  const current = TABS.find((t) => t.value === tab) ?? TABS[0];

  return (
    // `Box`, not a bare div: the marker needs a root to ride on.
    <Box {...marker}>
      <LiveProvider sdk={sdk}>
        <QueuePickContext.Provider value={setQueue}>
          <PageTemplate
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
          >
            <Grid container spacing={2}>
              {current.cells.map(
                ({ id, kind, title, description, span, body: Body }) => (
                  <Grid key={id} size={span}>
                    {kind === 'tile' ? (
                      <Tile title={title}>
                        <Body />
                      </Tile>
                    ) : (
                      <Panel title={title} description={description}>
                        <Body />
                      </Panel>
                    )}
                  </Grid>
                ),
              )}
            </Grid>
          </PageTemplate>
          <QueuePanel queue={queue} onClose={() => setQueue(null)} />
        </QueuePickContext.Provider>
      </LiveProvider>
    </Box>
  );
}
