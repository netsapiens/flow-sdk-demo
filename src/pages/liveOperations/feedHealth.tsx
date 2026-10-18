/**
 * Feed status: every stream the page reads, and what the host said about it.
 *
 * This leads the page because it is the one thing here no host screen shows.
 * The supervisor dashboard either has data or it doesn't; it never tells a
 * user WHY a panel is empty. An app has to, because the same bundle runs for a
 * Basic User and an Office Manager and the host decides per feed, per user,
 * what each may see. `StreamStatus` carries that decision — `refused` with a
 * `reason` and a `message` the host wrote for the user, `live` with whether it
 * replayed a snapshot, `unavailable` while it reconnects — and a live view
 * that does not print it is a view that sometimes looks broken.
 *
 * One row per retained feed, read straight off LiveProvider. Nothing here
 * subscribes.
 */
import type { StreamStatus } from '@netsapiens/flow-sdk';
import { useFlowContext } from '@netsapiens/flow-sdk';

import type { Tone } from './format';
import type { LiveState } from './liveContext';
import { chipColor } from './format';
import { useLive } from './liveContext';

interface Feed {
  label: string;
  call: string;
  /** The grant the platform derives from the call (STREAMS.md). */
  grant: string;
  status: (live: LiveState) => StreamStatus;
  /**
   * Sends changes only, so the page reads its starting state from the API
   * (liveSeed.ts). Said in the row, because `snapshot: false` alone reads as
   * "empty" to anyone who has not read STREAMS.md.
   */
  seeded?: boolean;
}

/** The eight feeds liveFeeds.ts retains, in the order liveState.tsx attaches. */
const FEEDS: Feed[] = [
  {
    label: 'Queue stats',
    call: 'queues.onDomainQueues({ stats })',
    grant: 'queues',
    status: (l) => l.queueStatus,
    seeded: true,
  },
  {
    label: 'Agents',
    call: 'queues.onDomainQueues({ agent… })',
    grant: 'queues',
    status: (l) => l.agentStatus,
    seeded: true,
  },
  {
    label: 'Domain calls',
    call: 'calls.onDomainCalls({ updated, ended })',
    grant: 'calls.domain',
    status: (l) => l.callStatus,
  },
  {
    label: 'Call records',
    call: 'cdrs.onDomain({ completed, updated })',
    grant: 'cdrs',
    status: (l) => l.recordStatus,
  },
  {
    label: 'Notifications',
    call: 'notifications.onNotification(update)',
    grant: 'notifications.read',
    status: (l) => l.notificationStatus,
  },
  {
    label: 'Presence',
    call: 'presence.onDomain(update)',
    grant: 'presence',
    status: (l) => l.presenceStatus,
  },
  {
    label: 'User records',
    call: 'subscribers.onDomain(update)',
    grant: 'subscribers',
    status: (l) => l.userStatus,
  },
  {
    label: 'Phones',
    call: 'devices.onDomain(update)',
    grant: 'devices',
    status: (l) => l.deviceStatus,
    seeded: true,
  },
];

/** The chip: the state in a word, coloured by what the user should make of it. */
function stateOf(status: StreamStatus): { label: string; tone: Tone } {
  switch (status.state) {
    case 'live':
      return { label: 'Live', tone: 'success' };
    case 'pending':
      return { label: 'Pending', tone: 'neutral' };
    case 'refused':
      return { label: 'Refused', tone: 'info' };
    case 'unavailable':
      return { label: 'Reconnecting', tone: 'warning' };
    case 'unconfirmed':
      return { label: 'No answer', tone: 'warning' };
    default:
      // STREAMS.md: treat a state you do not recognise as not live.
      return { label: 'Unknown', tone: 'warning' };
  }
}

/** The sentence beside the chip. A refusal's is the host's, word for word. */
function detailOf(status: StreamStatus, seeded?: boolean): string {
  switch (status.state) {
    case 'live':
      return status.snapshot
        ? 'Replayed what the host held, then live.'
        : seeded
          ? 'Changes only — starting state read once from the API.'
          : 'Changes only, from when the app loaded.';
    case 'pending':
      return 'Asked for; the host has not answered yet. After live, this means the session changed and the page cleared.';
    case 'refused':
      return `${status.reason} — ${status.message}`;
    case 'unavailable':
      return status.retrying
        ? 'The connection dropped; the host is resuming it.'
        : 'The connection dropped.';
    case 'unconfirmed':
      return 'No answer within 5 seconds: this server may predate sdk.streams.';
    default:
      return '';
  }
}

export function FeedsLiveStat() {
  const { ui } = useFlowContext();
  const live = useLive();
  const StatBlock = ui?.StatBlock;
  if (!StatBlock) return null;
  const states = FEEDS.map((f) => f.status(live).state);
  const up = states.filter((s) => s === 'live').length;
  const refused = states.filter((s) => s === 'refused').length;
  const troubled = states.filter(
    (s) => s === 'unavailable' || s === 'unconfirmed',
  ).length;
  return (
    <StatBlock
      value={`${up} / ${FEEDS.length}`}
      caption={
        troubled
          ? `${troubled} reconnecting`
          : refused
            ? `${refused} refused for you`
            : up === FEEDS.length
              ? 'every feed live'
              : 'connecting'
      }
      tone={troubled ? 'warning' : refused ? 'info' : 'success'}
    />
  );
}

export function FeedHealthCard() {
  const { ui } = useFlowContext();
  const live = useLive();
  const {
    Table,
    TableHead,
    TableBody,
    TableRow,
    TableCell,
    Chip,
    Tooltip,
    Typography,
  } = ui ?? {};
  if (
    !Table ||
    !TableHead ||
    !TableBody ||
    !TableRow ||
    !TableCell ||
    !Chip ||
    !Tooltip ||
    !Typography
  ) {
    return null;
  }
  return (
    <Table size='small'>
      <TableHead>
        <TableRow>
          <TableCell>Feed</TableCell>
          <TableCell>Status</TableCell>
          <TableCell>What the host said</TableCell>
        </TableRow>
      </TableHead>
      <TableBody>
        {FEEDS.map((feed) => {
          const status = feed.status(live);
          const { label, tone } = stateOf(status);
          return (
            <TableRow key={feed.label}>
              <TableCell>
                <Tooltip title={`Grant: ${feed.grant}`}>
                  <Typography variant='body2' fontWeight={600}>
                    {feed.label}
                  </Typography>
                </Tooltip>
                <Typography
                  variant='caption'
                  color='text.secondary'
                  sx={{ fontFamily: 'monospace' }}
                >
                  {feed.call}
                </Typography>
              </TableCell>
              <TableCell>
                <Chip
                  size='small'
                  variant='outlined'
                  label={label}
                  color={chipColor(tone)}
                />
              </TableCell>
              <TableCell>
                <Typography
                  variant='body2'
                  color={
                    status.state === 'live' ? 'text.secondary' : 'text.primary'
                  }
                >
                  {detailOf(status, feed.seeded)}
                </Typography>
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
