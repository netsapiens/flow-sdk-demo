/**
 * The Live Operations data contract: what LiveProvider (liveState.tsx) holds and
 * how cards read it. Kept apart from the components so fast refresh works.
 */
import type {
  AgentStatus,
  CallActivity,
  CallRecord,
  DeviceUpdate,
  FlowNotification,
  PresenceChange,
  QueueStats,
  RemoteAppSDK,
  StreamStatus,
  SubscriberUpdate,
} from '@netsapiens/flow-sdk';
import { createContext, useContext } from 'react';

/** One point of the trend history, taken every SAMPLE_MS. */
export interface Sample {
  label: string;
  calls: number;
  /** Calls in progress with a party the CRM knows (crmJoin.ts). */
  known: number;
  /** Of those, calls with a VIP account. */
  vip: number;
  waiting: number;
  /** Seconds the oldest waiting caller has waited, across every queue. */
  longestWait: number;
  /**
   * People free to take a call (see agentTotalsOf), not a per-queue sum. Null
   * when not known yet (a big domain before its first stats event): drawn as a
   * gap, not as zero.
   */
  agentsFree: number | null;
  available: number;
}

/** One delivery from `cdrs.onDomain`: the record as sent, and what changed. */
export interface RecordDelivery {
  /** Unique per delivery; a record is delivered more than once. */
  id: string;
  kind: 'completed' | 'updated';
  record: CallRecord;
  /** Fields that differ from the version delivered before; empty on `completed`. */
  changed: string[];
  receivedAt: number;
}

export interface LiveState {
  sdk: RemoteAppSDK;
  queues: QueueStats[];
  queueStatus: StreamStatus;
  agents: AgentStatus[];
  agentStatus: StreamStatus;
  calls: CallActivity[];
  callStatus: StreamStatus;
  presence: PresenceChange[];
  presenceStatus: StreamStatus;
  devices: DeviceUpdate[];
  deviceStatus: StreamStatus;
  notifications: FlowNotification[];
  notificationStatus: StreamStatus;
  /** Most recent first. */
  userChanges: SubscriberUpdate[];
  userStatus: StreamStatus;
  /** Latest version of each call record, most recently ended first. */
  records: CallRecord[];
  /** Every delivery, newest first, so updates are visible as they land. */
  recordDeliveries: RecordDelivery[];
  recordStatus: StreamStatus;
  /** Oldest first, at most HISTORY_POINTS. */
  history: Sample[];
  /** Running totals since the app loaded, not a window of recent records. */
  outcomes: Outcomes;
  /** A one-second clock, so durations count between frames. */
  now: number;
  /** Display name for a user, from whatever the page has seen of them. */
  nameOf: (user: string) => string;
  /** A queue's description from the API, or "Queue <number>". */
  queueName: (queue: string) => string;
  /**
   * Agents free and in queues, as people. Null when not known yet: a big
   * domain before its first queue stats event (see agentTotalsOf).
   */
  agentTotals: { free: number; total: number } | null;
  /** The domain was too big to read every agent and phone up front. */
  bigDomain: boolean;
}

/** Trend sampling: every 10 s, 15 minutes kept. */
export const SAMPLE_MS = 10_000;
export const HISTORY_POINTS = 90;

export const LiveContext = createContext<LiveState | null>(null);

export function useLive(): LiveState {
  const state = useContext(LiveContext);
  if (!state)
    throw new Error('Live Operations card rendered outside LiveProvider');
  return state;
}

export const agentKey = (a: AgentStatus) => `${a.queue}|${a.agent}`;

export type AgentState = 'oncall' | 'available' | 'unavailable' | 'oos';

const STATE_RANK: AgentState[] = ['oncall', 'available', 'unavailable', 'oos'];

/**
 * One entry per person. The stream reports an agent once per queue they belong
 * to, so fold those memberships: on a call in any queue beats available in any,
 * and the change time is the most recent. Every "how many agents" figure on
 * the page counts these, so an agent in three queues is one agent, not three.
 */
export function foldAgents(agents: AgentStatus[]) {
  const people = new Map<string, { state: AgentState; changedAt: string }>();
  for (const a of agents) {
    const state: AgentState =
      a.activeCalls > 0
        ? 'oncall'
        : a.device === 'oos'
          ? 'oos'
          : a.status === 'available'
            ? 'available'
            : 'unavailable';
    const seen = people.get(a.user);
    if (!seen) {
      people.set(a.user, { state, changedAt: a.updatedAt });
      continue;
    }
    people.set(a.user, {
      state:
        STATE_RANK.indexOf(state) < STATE_RANK.indexOf(seen.state)
          ? state
          : seen.state,
      changedAt: a.updatedAt > seen.changedAt ? a.updatedAt : seen.changedAt,
    });
  }
  return people;
}

/**
 * The agent counts the page shows. The platform's own domain totals from the
 * latest streamed stats come first: they count each person once across the
 * whole domain and do not depend on the agents feed being complete. Before
 * any stats arrive, count the agents the page holds, unless the domain was
 * too big to read them up front, in which case that count would be a few
 * people out of thousands: say nothing yet instead.
 */
export function agentTotalsOf(
  totals: QueueStats['domainTotals'] | null,
  agents: AgentStatus[],
  big: boolean,
): { free: number; total: number } | null {
  if (totals)
    return { free: totals.agentsAvailable, total: totals.agentsLoggedIn };
  return big ? null : agentCounts(agents);
}

/** People free to take a call, and people in any queue at all. */
export function agentCounts(agents: AgentStatus[]) {
  const people = [...foldAgents(agents).values()];
  return {
    free: people.filter((p) => p.state === 'available').length,
    total: people.length,
  };
}

/**
 * How long a queue's oldest caller has waited, counted up to `now`. The stats
 * event carries `longestWaitSec` as of when it was sent; between events the
 * wait keeps growing, so count from `oldestQueuedAt` when there is one.
 */
export function waitOf(q: QueueStats, now: number): number {
  if (q.waiting === 0) return 0;
  const queued = q.oldestQueuedAt ? Date.parse(q.oldestQueuedAt) : NaN;
  return Number.isNaN(queued)
    ? q.longestWaitSec
    : Math.max(q.longestWaitSec, (now - queued) / 1000);
}

/**
 * How calls have ended since the app loaded: running totals, counted once per
 * record when its `completed` event arrives (the first sighting of a record).
 */
export interface Outcomes {
  answered: number;
  missed: number;
  outbound: number;
  internal: number;
}

export const NO_OUTCOMES: Outcomes = {
  answered: 0,
  missed: 0,
  outbound: 0,
  internal: 0,
};

/** Count one finished call. Returns a new object, so snapshots stay immutable. */
export function countOutcome(o: Outcomes, record: CallRecord): Outcomes {
  switch (record.direction) {
    case 'inbound':
      return { ...o, answered: o.answered + 1 };
    case 'missed':
      return { ...o, missed: o.missed + 1 };
    case 'outbound':
      return { ...o, outbound: o.outbound + 1 };
    case 'internal':
      return { ...o, internal: o.internal + 1 };
    default:
      return o;
  }
}

/** Which queue's drill-down panel is open; set by a Queues row click. */
export const QueuePickContext = createContext<(queue: string) => void>(
  () => {},
);
