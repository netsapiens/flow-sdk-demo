import type {
  AgentStatus,
  CallActivity,
  CallRecord,
  FlowApiClient,
  QueueStats,
  RemoteAppSDK,
  StreamClient,
  Subscription,
} from '@netsapiens/flow-sdk';

import type { Outcomes, RecordDelivery, Sample } from './liveContext';
import type { LiveSeed } from './liveSeed';
import { accountOf } from './crmJoin';
import {
  agentKey,
  agentTotalsOf,
  countOutcome,
  HISTORY_POINTS,
  NO_OUTCOMES,
  SAMPLE_MS,
  waitOf,
} from './liveContext';
import { loadSeed } from './liveSeed';

/**
 * The Live Operations feeds, opened at startup and kept for the session.
 *
 * App.tsx calls `liveHistory.start(sdk)` beside its registerRoute calls. That
 * retains all eight feeds with `sdk.streams.retain`, so they collect from the
 * moment the app loads — not from the moment someone opens the page — and keep
 * collecting after the page is left. LiveProvider (liveState.tsx) attaches to
 * them with `useStream(…, { retain: LIVE_FEEDS.x })` and is handed the latest
 * copy of every record at once.
 *
 * Retained streams give back current state, not history. The two things on the
 * page that ARE history — the trend chart and the call-record delivery log —
 * are built here instead, by the handlers passed to `retain`, which run for
 * the whole session whether or not the page is open.
 *
 * The trend is the cross-system one: calls in progress, and how many of them
 * are with accounts the CRM knows (crmJoin.ts). So the calls handler keeps
 * each call, not just its id — the parties are what the CRM is matched on.
 */
export const LIVE_FEEDS = {
  queueStats: 'live:queue-stats',
  agents: 'live:agents',
  calls: 'live:calls',
  presence: 'live:presence',
  devices: 'live:devices',
  notifications: 'live:notifications',
  users: 'live:users',
  records: 'live:records',
} as const;

/** Keep this many deliveries; the page is a live view, not a log. */
export const RECORDS_KEPT = 50;

/**
 * The fields filled in after a call. A record arrives on `completed` with them
 * empty and again on `updated` as each one lands.
 */
const LATE_FIELDS: [string, (r: CallRecord) => unknown][] = [
  ['disposition', (r) => r.disposition],
  ['reason', (r) => r.reason],
  ['notes', (r) => r.notes],
  ['recording', (r) => r.recordingStatus],
  ['MOS (orig)', (r) => r.mos.orig],
  ['MOS (term)', (r) => r.mos.term],
  ['summary', (r) => r.summary],
];

function changedFields(
  before: CallRecord | undefined,
  after: CallRecord,
): string[] {
  if (!before) return [];
  return LATE_FIELDS.filter(([, read]) => read(before) !== read(after)).map(
    ([name]) => name,
  );
}

const noop = () => {};

export interface LiveHistorySnapshot {
  /** Oldest first, at most HISTORY_POINTS. */
  history: Sample[];
  /** Newest first, at most RECORDS_KEPT. */
  recordDeliveries: RecordDelivery[];
  /** How calls have ended since the app loaded. */
  outcomes: Outcomes;
}

/**
 * What the page cannot get back from a retained stream: samples over time,
 * and every delivery rather than each record's latest copy. Read from React
 * with `useSyncExternalStore(liveHistory.subscribe, liveHistory.getSnapshot)`.
 */
class LiveHistory {
  // Just enough state to total up a sample.
  private queues = new Map<string, QueueStats>();
  private agents = new Map<string, AgentStatus>();
  /** The latest streamed domain totals (see agentTotalsOf). */
  private domainTotals: QueueStats['domainTotals'] | null = null;
  private seedCache: { domain: string; seed: LiveSeed } | null = null;
  private seedLoading: { domain: string; promise: Promise<LiveSeed> } | null =
    null;
  private trimmedAtSeed = false;
  private calls = new Map<string, CallActivity>();
  private available = new Map<string, boolean>();
  private lastRecord = new Map<string, CallRecord>();

  private snapshot: LiveHistorySnapshot = {
    history: [],
    recordDeliveries: [],
    outcomes: NO_OUTCOMES,
  };
  private listeners = new Set<() => void>();
  private timer: ReturnType<typeof setInterval> | undefined;
  private handles: Subscription[] = [];

  /** Retain every feed and start sampling. Safe to call twice. */
  start(sdk: RemoteAppSDK): void {
    if (this.timer) return;
    /**
     * Keep a feed open for the life of the app. `retain` calls these handlers
     * for every delivery (flow-sdk 0.3.5 and later), and keeps the latest copy
     * of each record for a page that attaches with `useStream(…, { retain })`.
     */
    const retain = (
      key: string,
      subscribe: (streams: StreamClient) => Subscription,
    ) => {
      const handle = sdk.streams.retain(key, subscribe);
      this.handles.push(handle);
      // 'pending' after 'live' means the session changed (an admin switched
      // the managed domain): the host is re-judging the feed, and what it
      // delivered so far belongs to the old session. Clear it.
      let wasLive = handle.status.state === 'live';
      handle.onStatus((status) => {
        if (status.state === 'live') wasLive = true;
        else if (status.state === 'pending' && wasLive) {
          wasLive = false;
          this.resetFeed(key);
        }
      });
    };

    // Each call names every event the page attaches with; a page handler for
    // an event not retained here would never be called.
    retain(LIVE_FEEDS.queueStats, (s) =>
      s.queues.onDomainQueues({
        stats: (q) => {
          this.queues.set(q.queue, q);
          this.domainTotals = q.domainTotals;
        },
      }),
    );
    retain(LIVE_FEEDS.agents, (s) =>
      s.queues.onDomainQueues({
        agentUpdated: (a) => this.agents.set(agentKey(a), a),
        agentAdded: (a) => this.agents.set(agentKey(a), a),
        agentRemoved: (a) => this.agents.delete(agentKey(a)),
      }),
    );
    retain(LIVE_FEEDS.calls, (s) =>
      s.calls.onDomainCalls({
        updated: (c) => this.calls.set(c.callId, c),
        ended: (c) => this.calls.delete(c.callId),
      }),
    );
    retain(LIVE_FEEDS.presence, (s) =>
      s.presence.onDomain((p) =>
        this.available.set(p.user, p.presence === 'open'),
      ),
    );
    // Nothing sampled from phones: the page only joins them to agents (an
    // agent in a queue whose phone dropped), which needs current state alone.
    retain(LIVE_FEEDS.devices, (s) => s.devices.onDomain(noop));
    retain(LIVE_FEEDS.notifications, (s) =>
      s.notifications.onNotification(noop),
    );
    retain(LIVE_FEEDS.users, (s) => s.subscribers.onDomain(noop));
    retain(LIVE_FEEDS.records, (s) =>
      s.cdrs.onDomain({
        completed: (r) => this.recordDelivered('completed', r),
        updated: (r) => this.recordDelivered('updated', r),
      }),
    );

    this.sample();
    this.timer = setInterval(() => this.sample(), SAMPLE_MS);
  }

  /** Close every feed. `sdk.cleanup()` would too; this also stops the timer. */
  stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = undefined;
    this.handles.forEach((handle) => handle.unsubscribe());
    this.handles = [];
  }

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  getSnapshot = (): LiveHistorySnapshot => this.snapshot;

  /**
   * The starting state the streams do not send (see liveSeed.ts), read once
   * per domain and kept for the life of the app, like the feeds. A page that
   * opens later applies it synchronously (`seedFor`), so returning to the page
   * neither flashes the partial streamed state nor re-reads the API.
   */
  seedFor(domain: string): LiveSeed | null {
    return this.seedCache?.domain === domain ? this.seedCache.seed : null;
  }

  /** Read the seed for `domain`, once; later calls get the same result. */
  loadSeed(api: FlowApiClient, domain: string): Promise<LiveSeed> {
    const cached = this.seedFor(domain);
    if (cached) return Promise.resolve(cached);
    if (this.seedLoading?.domain === domain) return this.seedLoading.promise;
    const promise = loadSeed(api, domain).then((seed) => {
      // A session change while the read was in flight makes it stale.
      if (this.seedLoading?.promise !== promise) return seed;
      this.seedLoading = null;
      this.seedCache = { domain, seed };
      this.applySeed(seed);
      return seed;
    });
    this.seedLoading = { domain, promise };
    return promise;
  }

  /**
   * Put the seed under what the feeds have delivered (a streamed record is
   * never overwritten). The samples taken before the FIRST seed of a session
   * counted nothing, so they are dropped rather than drawn as a climb from
   * zero; after that the history is never touched here.
   */
  private applySeed(seed: LiveSeed): void {
    for (const q of seed.queues)
      if (!this.queues.has(q.queue)) this.queues.set(q.queue, q);
    for (const a of seed.agents)
      if (!this.agents.has(agentKey(a))) this.agents.set(agentKey(a), a);
    if (!this.trimmedAtSeed) {
      this.trimmedAtSeed = true;
      this.publish({ history: [] });
    }
    this.sample();
  }

  /**
   * Drop what one feed delivered under the old session. The trend history is
   * cleared too: a line spanning two domains would read as one domain's
   * change. Each feed goes 'pending' on a session change, so this runs once
   * per feed; clearing twice is harmless.
   */
  private resetFeed(key: string): void {
    // The seed described the old session too: read it again for the new one.
    this.seedCache = null;
    this.seedLoading = null;
    this.trimmedAtSeed = false;
    if (key === LIVE_FEEDS.queueStats) {
      this.queues.clear();
      this.domainTotals = null;
    }
    if (key === LIVE_FEEDS.agents) this.agents.clear();
    if (key === LIVE_FEEDS.calls) this.calls.clear();
    if (key === LIVE_FEEDS.presence) this.available.clear();
    if (key === LIVE_FEEDS.records) {
      this.lastRecord.clear();
      this.publish({ recordDeliveries: [], outcomes: NO_OUTCOMES });
    }
    this.publish({ history: [] });
  }

  private publish(next: Partial<LiveHistorySnapshot>): void {
    this.snapshot = { ...this.snapshot, ...next };
    this.listeners.forEach((listener) => listener());
  }

  private sample(): void {
    const queues = [...this.queues.values()];
    const count = (map: Map<string, boolean>) =>
      [...map.values()].filter(Boolean).length;
    const now = Date.now();
    const accounts = [...this.calls.values()].flatMap((c) => {
      const account = accountOf(c);
      return account ? [account] : [];
    });
    const sample: Sample = {
      label: new Date().toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      }),
      calls: this.calls.size,
      known: accounts.length,
      vip: accounts.filter((a) => a.record.tier === 'vip').length,
      waiting: queues.reduce((n, q) => n + q.waiting, 0),
      longestWait: queues.reduce((n, q) => Math.max(n, waitOf(q, now)), 0),
      agentsFree:
        agentTotalsOf(
          this.domainTotals,
          [...this.agents.values()],
          this.seedCache?.seed.big ?? false,
        )?.free ?? null,
      available: count(this.available),
    };
    this.publish({
      history: [...this.snapshot.history, sample].slice(-HISTORY_POINTS),
    });
  }

  private recordDelivered(kind: RecordDelivery['kind'], record: CallRecord) {
    const changed = changedFields(this.lastRecord.get(record.recordId), record);
    this.lastRecord.set(record.recordId, record);
    if (this.lastRecord.size > RECORDS_KEPT * 4) {
      this.lastRecord.delete(this.lastRecord.keys().next().value!);
    }
    const list = this.snapshot.recordDeliveries;
    this.publish({
      // `completed` is a record's first sighting, so each call counts once;
      // `updated` re-delivers the same call and must not count it again.
      outcomes:
        kind === 'completed'
          ? countOutcome(this.snapshot.outcomes, record)
          : this.snapshot.outcomes,
      recordDeliveries: [
        {
          id: `${record.recordId}-${Date.now()}-${list.length}`,
          kind,
          record,
          changed,
          receivedAt: Date.now(),
        },
        ...list,
      ].slice(0, RECORDS_KEPT),
    });
  }
}

export const liveHistory = new LiveHistory();
