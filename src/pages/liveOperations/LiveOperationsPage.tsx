import type { RemoteAppSDK } from '@netsapiens/flow-sdk';
import type { ComponentType } from 'react';
import { useState } from 'react';
import { useFlowContext } from '@netsapiens/flow-sdk';

import type { LiveSpan } from '../../content/liveOperationsContent';
import {
  LIVE_OPERATIONS_SUBTITLE,
  LIVE_OPERATIONS_TITLE,
  LIVE_TABS,
} from '../../content/liveOperationsContent';
import { type ZoneMarkerProps } from '../../integration/withZoneTestId';
import {
  ActivityChart,
  AgentsFreeStat,
  AvailableStat,
  CallRecordsCard,
  DispositionedStat,
  LongestWaitStat,
  NotificationsCard,
  PresenceListCard,
  PresenceSummaryCard,
  QueuesCard,
  RecordDeliveriesCard,
  RecordsStat,
  RecordUpdatesStat,
  UserChangesCard,
  WaitingStat,
} from './cards';
import {
  AccountsOnLineCard,
  AgentAccountsCard,
  KnownCustomersStat,
  PipelineStat,
  UnknownCallersCard,
  VipStat,
} from './crmViews';
import { FeedHealthCard, FeedsLiveStat } from './feedHealth';
import { QueuePickContext } from './liveContext';
import { LiveProvider } from './liveState';
import {
  ReceivedNotificationsCard,
  SendNotificationCard,
} from './notifications';
import { Panel, Tile } from './parts';
import { QueuePanel } from './QueuePanel';

/**
 * Live Operations — what an app can show that the host cannot, built entirely
 * on `sdk.streams` and drawn entirely with the host's kit.
 *
 * The page is a `PageTemplate` laid out with the kit's `Grid`, every panel a
 * rounded `Card` (see `Panel` and `Tile` in parts.tsx). It used to be a
 * `DashboardTemplate`, but the host draws dashboard cards square by design, and
 * this page wants rounded cards and uneven columns (8/4), which the template's
 * half/full sizes cannot express. Tabs (`ui.Tabs`, in the header's `actions`
 * slot) switch which panels it shows; their copy and layout are in
 * `content/liveOperationsContent.ts`:
 *
 *   Overview          the feed status table, and Flow's live calls joined to
 *                     Example CRM: accounts on the line, callers not in it,
 *                     a trend of both
 *   Queues & agents   queues with their CRM accounts (click → SidePanel opening
 *                     `queues.onQueue`, callers matched to the CRM); agents
 *                     with the account on their call and their phone's state
 *   Call records      finished calls (`cdrs.onDomain`) and each record's later
 *                     updates, flagged when one is ready to write back
 *   Notifications     send one, watch it come back
 *   People            presence and user record changes
 *
 * It used to lead with a supervisor wallboard and carry a Phones tab. Both
 * redrew screens the host ships (its call-center dashboard and wallboard, its
 * device registrations page) from the same feeds; see the content file for
 * the reasoning. The feeds are all still here — the phone feed now answers
 * "is this queued agent's phone registered?" in the agents table, a join the
 * registrations page cannot make.
 *
 * Every feed is opened once by `LiveProvider` (liveState.tsx), above the
 * panels, so switching tabs never reopens one, and the trend history keeps
 * running on every tab.
 *
 * What the page is there to show, beyond the data:
 *
 *   - **Status is part of the UI.** Every panel shows its stream's status, and
 *     the Overview leads with all eight. A `refused` stream carries a reason
 *     and a message the host wrote for the user — domain calls, user records
 *     and queue caller details are for domain admins, and everyone else sees
 *     why instead of an empty panel.
 *   - **The value is in the join.** A stream says who is on a call; only the
 *     partner's system says the caller is a VIP with a renewal in negotiation.
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

/** Grid columns out of 12, per breakpoint, for each span the content names. */
const SPANS: Record<
  LiveSpan,
  { xs?: number; sm?: number; md?: number; lg?: number }
> = {
  full: { xs: 12 },
  half: { xs: 12, lg: 6 },
  wide: { xs: 12, lg: 8 },
  narrow: { xs: 12, lg: 4 },
  four: { xs: 12, sm: 6, lg: 3 },
  three: { xs: 12, sm: 4 },
};

/**
 * Cell id → the component that draws it. Declared at module scope so each
 * panel keeps its component identity across the page's one-second re-renders.
 */
const BODIES: Record<string, ComponentType> = {
  'live-ops-feeds': FeedsLiveStat,
  'live-ops-known': KnownCustomersStat,
  'live-ops-vips': VipStat,
  'live-ops-pipeline': PipelineStat,
  'live-ops-accounts': AccountsOnLineCard,
  'live-ops-unknown': UnknownCallersCard,
  'live-ops-feed-status': FeedHealthCard,
  'live-ops-notifications': NotificationsCard,
  'live-ops-trend': ActivityChart,
  'live-ops-waiting': WaitingStat,
  'live-ops-longest-wait': LongestWaitStat,
  'live-ops-agents-free': AgentsFreeStat,
  'live-ops-queues': QueuesCard,
  'live-ops-agents': AgentAccountsCard,
  'live-ops-records': RecordsStat,
  'live-ops-record-updates': RecordUpdatesStat,
  'live-ops-dispositioned': DispositionedStat,
  'live-ops-record-deliveries': RecordDeliveriesCard,
  'live-ops-records-table': CallRecordsCard,
  'live-ops-send-notification': SendNotificationCard,
  'live-ops-received-notifications': ReceivedNotificationsCard,
  'live-ops-available': AvailableStat,
  'live-ops-presence-summary': PresenceSummaryCard,
  'live-ops-user-changes': UserChangesCard,
  'live-ops-presence-list': PresenceListCard,
};

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

  const current = LIVE_TABS.find((t) => t.value === tab) ?? LIVE_TABS[0];

  return (
    // `Box`, not a bare div: the marker needs a root to ride on.
    <Box {...marker}>
      <LiveProvider sdk={sdk}>
        <QueuePickContext.Provider value={setQueue}>
          <PageTemplate
            title={LIVE_OPERATIONS_TITLE}
            subtitle={LIVE_OPERATIONS_SUBTITLE}
            actions={
              <Tabs
                variant='pill'
                options={LIVE_TABS.map(({ value, label, icon }) => ({
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
              {current.cells.map(({ id, kind, title, description, span }) => {
                const Body = BODIES[id];
                if (!Body) return null;
                return (
                  <Grid key={id} size={SPANS[span]}>
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
                );
              })}
            </Grid>
          </PageTemplate>
          <QueuePanel queue={queue} onClose={() => setQueue(null)} />
        </QueuePickContext.Provider>
      </LiveProvider>
    </Box>
  );
}
