/**
 * The starting state the streams do not send.
 *
 * `queues.onDomainQueues` sends `stats` only when a queue changes, and agent
 * events only when an agent does: there is no starting snapshot. On a quiet
 * domain the page would show no queues and "0 / 0" agents until something
 * happened, while the queues were running all along. The fix STREAMS.md gives
 * is the one used here: read the current state from the API once, then let the
 * stream keep it current. Whatever a stream delivers replaces the seeded copy.
 *
 * The queue and agent reads are the ones the host's own supervisor dashboard
 * makes; the device read is the one its phones page makes.
 */
import type {
  AgentStatus,
  DeviceUpdate,
  FlowApiClient,
  QueueStats,
} from '@netsapiens/flow-sdk';

import { agentCounts } from './liveContext';

/** The fields of `GET /domains/{domain}/callqueues` this page reads. */
interface CallQueueRow {
  callqueue: string;
  domain: string;
  description?: string;
  'active-queued-calls-total-current'?: number;
  'active-calls-total-current'?: number;
  'callqueue-count-agents-available'?: number;
  'callqueue-count-agents-total'?: number;
}

/** The fields of `GET /domains/{domain}/agents` (one row per agent per queue). */
interface AgentRow {
  callqueue: string;
  domain: string;
  'callqueue-agent-id': string;
  'name-full-name'?: string;
  'callqueue-agent-availability-for-dispatch'?: string;
  'active-calls-total-current'?: number;
  'callqueue-agent-wrap-up-allowance-seconds'?: number;
  'callqueue-agent-dispatch-queue-priority-ordinal'?: number;
}

/** The fields of `GET /domains/{domain}/devices` this page reads. */
interface DeviceRow {
  device: string;
  user: string;
  domain: string;
  'device-sip-registration-state'?: string;
  'device-sip-registration-datetime'?: string;
  'device-sip-registration-expires-datetime'?: string;
  'device-sip-registration-user-agent'?: string;
}

/**
 * Past this many agents in any one queue, the domain is "big": the agents and
 * phones are not read up front (see loadSeed).
 */
export const BIG_DOMAIN_AGENTS = 150;

export interface LiveSeed {
  /** True when the agents and phones were too many to read up front. */
  big: boolean;
  queues: QueueStats[];
  agents: AgentStatus[];
  /** Phones and their registration, which `devices.onDomain` sends only on change. */
  devices: DeviceUpdate[];
  /** Queue number → its description, for labels. */
  queueNames: Map<string, string>;
  /** User → full name, for agents the presence feed has not named yet. */
  userNames: Map<string, string>;
}

const num = (v: number | undefined) => (typeof v === 'number' ? v : 0);

/** One queue's figures; `domainTotals` is filled in once every queue is read. */
function queueFromRow(row: CallQueueRow): Omit<QueueStats, 'domainTotals'> {
  return {
    queue: row.callqueue,
    domain: row.domain,
    waiting: num(row['active-queued-calls-total-current']),
    // The REST row has no wait time; the next stats event brings it.
    longestWaitSec: 0,
    oldestQueuedAt: null,
    agentsAvailable: num(row['callqueue-count-agents-available']),
    agentsLoggedIn: num(row['callqueue-count-agents-total']),
    activeCalls: num(row['active-calls-total-current']),
  };
}

function agentFromRow(row: AgentRow): AgentStatus {
  const agent = row['callqueue-agent-id'];
  return {
    agent,
    user: agent.split('@')[0],
    domain: row.domain,
    queue: row.callqueue,
    status: (
      row['callqueue-agent-availability-for-dispatch'] ?? ''
    ).toLowerCase(),
    device: '',
    activeCalls: num(row['active-calls-total-current']),
    wrapUpSec: num(row['callqueue-agent-wrap-up-allowance-seconds']),
    order: num(row['callqueue-agent-dispatch-queue-priority-ordinal']),
    priority: 0,
    // The API does not say when the agent's state last changed. Empty, so the
    // board shows the state without a made-up duration.
    updatedAt: '',
  };
}

function deviceFromRow(row: DeviceRow): DeviceUpdate {
  return {
    device: row.device,
    user: row.user,
    domain: row.domain,
    // 'registered' or 'registered_endpoint'; 'unregistered' otherwise.
    registered: (row['device-sip-registration-state'] ?? '').startsWith(
      'registered',
    ),
    userAgent: row['device-sip-registration-user-agent'] ?? '',
    registeredAt: row['device-sip-registration-datetime'] ?? '',
    expiresAt: row['device-sip-registration-expires-datetime'] ?? '',
    transport: '',
    latencyMs: null,
  };
}

/**
 * Read the domain's queues, agents and phones. Either read may be refused (the user's
 * scope may not cover call queues): that half seeds nothing, and the stream
 * fills it as events arrive, exactly as before.
 */
export async function loadSeed(
  api: FlowApiClient,
  domain: string,
): Promise<LiveSeed> {
  const queueRows = await api
    .get<CallQueueRow[]>(`/domains/${domain}/callqueues`)
    .catch(() => [] as CallQueueRow[]);
  // A domain this size makes the per-agent and per-phone reads too heavy to
  // take on every page open (one agent row per queue membership: thousands),
  // and the page cannot show that many people anyway. Skip them; agents and
  // phones then appear as the feeds report them, and the agent counts come
  // from the platform's own domain totals on the next stats event.
  const big = (queueRows ?? []).some(
    (r) => num(r?.['callqueue-count-agents-total']) > BIG_DOMAIN_AGENTS,
  );
  const [agentRows, deviceRows] = big
    ? [[] as AgentRow[], [] as DeviceRow[]]
    : await Promise.all([
        api
          .get<AgentRow[]>(`/domains/${domain}/agents`)
          .catch(() => [] as AgentRow[]),
        api
          .get<DeviceRow[]>(`/domains/${domain}/devices`)
          .catch(() => [] as DeviceRow[]),
      ]);
  const queues = (queueRows ?? []).filter((r) => r?.callqueue);
  const agents = (agentRows ?? []).filter(
    (r) => r?.callqueue && r['callqueue-agent-id'],
  );
  // The platform's stats frames carry domain-wide totals, with agents counted
  // once per person (DISTINCT), not summed per queue. Build the same from the
  // reads, so a seeded record means what a streamed one does. On a big domain
  // the agents were not read, so the agent figures here are 0: the page never
  // reads a seeded record's totals, only a streamed one's (liveState.tsx).
  const perQueue = queues.map(queueFromRow);
  const seededAgents = agents.map(agentFromRow);
  const people = agentCounts(seededAgents);
  const domainTotals: QueueStats['domainTotals'] = {
    waiting: perQueue.reduce((n, q) => n + q.waiting, 0),
    longestWaitSec: 0,
    oldestQueuedAt: null,
    agentsAvailable: people.free,
    agentsLoggedIn: people.total,
    activeCalls: perQueue.reduce((n, q) => n + q.activeCalls, 0),
  };
  return {
    big,
    queues: perQueue.map((q) => ({ ...q, domainTotals })),
    agents: seededAgents,
    devices: (deviceRows ?? []).filter((r) => r?.device).map(deviceFromRow),
    queueNames: new Map(
      queues
        .filter((r) => r.description)
        .map((r): [string, string] => [r.callqueue, r.description!]),
    ),
    userNames: new Map(
      agents
        .filter((r) => r['name-full-name'])
        .map((r): [string, string] => [
          r['callqueue-agent-id'].split('@')[0],
          r['name-full-name']!,
        ]),
    ),
  };
}
