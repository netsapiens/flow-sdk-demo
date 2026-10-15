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
import type { ReactNode } from 'react';
import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import {
  useFlowContext,
  useManagingDomain,
  useStream,
} from '@netsapiens/flow-sdk';

import type { LiveState } from './liveContext';
import { agentKey, LiveContext } from './liveContext';
import { LIVE_FEEDS, liveHistory, RECORDS_KEPT } from './liveFeeds';

/**
 * The Live Operations streams, attached ONCE for the whole page.
 *
 * Every card on every tab reads from this provider. The host's DashboardTemplate
 * mounts and remounts card bodies as it lays out the grid and as tabs switch;
 * subscribing inside a card would open and close a feed each time.
 *
 * The feeds themselves are not opened here. App.tsx opens all eight at startup
 * with `sdk.streams.retain` (see liveFeeds.ts), so they have been collecting
 * since the app loaded. Each `useStream` below passes `{ retain: key }`: on
 * mount it is handed the latest copy of every record the feed has delivered —
 * in one batch, so one render — and on unmount it detaches, leaving the feed
 * running. Leave the page, come back, and nothing is missing.
 *
 *   queues.onDomainQueues({ stats })                         → queues
 *   queues.onDomainQueues({ agentUpdated, agentAdded, … })   → agents
 *   calls.onDomainCalls({ updated, ended })                  → calls
 *   presence.onDomain(update)                                → presence
 *   devices.onDomain(update)                                 → phones
 *   notifications.onNotification(update)                     → notifications
 *   subscribers.onDomain(update)                             → user record changes
 *   cdrs.onDomain({ completed, updated })                    → call records
 *
 * The trend history and the call-record delivery log are history, which a
 * retained feed does not give back, so liveFeeds.ts builds them in the
 * background and this provider reads them.
 *
 * The queue drill-down opens a ninth, `queues.onQueue`, only while its panel
 * is open — see QueuePanel.tsx.
 */

function upsert<T>(map: Map<string, T>, key: string, value: T): Map<string, T> {
  const next = new Map(map);
  next.set(key, value);
  return next;
}

function without<T>(map: Map<string, T>, key: string): Map<string, T> {
  const next = new Map(map);
  next.delete(key);
  return next;
}

/**
 * Clear a feed's state when its session changes. The host reports 'pending'
 * again after 'live' when it re-judges a stream (an admin switched the managed
 * domain); the records held so far belong to the old session. The retained
 * feed drops its own copy too, and hands over the new session's records once
 * it is live again.
 */
function useResetOnPending(status: StreamStatus, reset: () => void) {
  const wasLive = useRef(false);
  useEffect(() => {
    if (status.state === 'live') wasLive.current = true;
    else if (status.state === 'pending' && wasLive.current) {
      wasLive.current = false;
      reset();
    }
    // `reset` is a fresh closure each render; only the state change matters.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status.state]);
}

export function LiveProvider({
  sdk,
  children,
}: {
  sdk: RemoteAppSDK;
  children: ReactNode;
}) {
  // The starting state the streams do not send (see liveSeed.ts). LiveHistory
  // reads it once per domain and keeps it, so a page opened after that starts
  // from it synchronously: no flash of partial streamed state, no re-read.
  //
  // The domain is `~` (the API resolves it to the signed-in session's domain)
  // unless an admin is managing one. Not `flowContext.user.domain`: Flow does
  // not reload apps after a masquerade, so that stays the original user's
  // domain, and re-reading it after the session changed put the original
  // domain's queues and agents back on the page.
  const { api } = useFlowContext();
  const { managing } = useManagingDomain();
  const domain = managing || '~';
  const cached = domain ? liveHistory.seedFor(domain) : null;

  const [queues, setQueues] = useState(
    () =>
      new Map<string, QueueStats>(
        cached?.queues.map((q): [string, QueueStats] => [q.queue, q]),
      ),
  );
  const queueStatus = useStream(
    sdk,
    (streams) =>
      streams.queues.onDomainQueues({
        stats: (q) => setQueues((m) => upsert(m, q.queue, q)),
      }),
    [],
    { retain: LIVE_FEEDS.queueStats },
  );

  // The same method again with other handlers: the host opens only the feeds a
  // subscription has handlers for, and shares the room with the one above.
  const [agents, setAgents] = useState(
    () =>
      new Map<string, AgentStatus>(
        cached?.agents.map((a): [string, AgentStatus] => [agentKey(a), a]),
      ),
  );
  const agentStatus = useStream(
    sdk,
    (streams) =>
      streams.queues.onDomainQueues({
        agentUpdated: (a) => setAgents((m) => upsert(m, agentKey(a), a)),
        agentAdded: (a) => setAgents((m) => upsert(m, agentKey(a), a)),
        agentRemoved: (a) => setAgents((m) => without(m, agentKey(a))),
      }),
    [],
    { retain: LIVE_FEEDS.agents },
  );

  // Office Managers and Call Center Supervisors only; everyone else is refused
  // with a message the card shows as-is.
  const [calls, setCalls] = useState(new Map<string, CallActivity>());
  const callStatus = useStream(
    sdk,
    (streams) =>
      streams.calls.onDomainCalls({
        updated: (c) => setCalls((m) => upsert(m, c.callId, c)),
        ended: (c) => setCalls((m) => without(m, c.callId)),
      }),
    [],
    { retain: LIVE_FEEDS.calls },
  );

  const [presence, setPresence] = useState(new Map<string, PresenceChange>());
  const presenceStatus = useStream(
    sdk,
    (streams) =>
      streams.presence.onDomain((p) =>
        setPresence((m) => upsert(m, p.user, p)),
      ),
    [],
    { retain: LIVE_FEEDS.presence },
  );

  // Admins see the domain's phones; Basic and Advanced Users only their own.
  const [devices, setDevices] = useState(
    () =>
      new Map<string, DeviceUpdate>(
        cached?.devices.map((d): [string, DeviceUpdate] => [d.device, d]),
      ),
  );
  const deviceStatus = useStream(
    sdk,
    (streams) =>
      streams.devices.onDomain((d) =>
        setDevices((m) => upsert(m, d.device, d)),
      ),
    [],
    { retain: LIVE_FEEDS.devices },
  );

  // The signed-in user's own notifications and the domain's.
  const [notifications, setNotifications] = useState<FlowNotification[]>([]);
  const notificationStatus = useStream(
    sdk,
    (streams) =>
      streams.notifications.onNotification((n) =>
        setNotifications((list) =>
          [n, ...list.filter((x) => x.id !== n.id)].slice(0, 30),
        ),
      ),
    [],
    { retain: LIVE_FEEDS.notifications },
  );

  // Domain admins only: every user record change in the domain.
  const [userChanges, setUserChanges] = useState<SubscriberUpdate[]>([]);
  const userStatus = useStream(
    sdk,
    (streams) =>
      streams.subscribers.onDomain((u) =>
        setUserChanges((list) => [u, ...list].slice(0, 30)),
      ),
    [],
    { retain: LIVE_FEEDS.users },
  );

  // Domain admins only; everyone else is refused with the host's message. A
  // changed record is delivered again with the same recordId: replace it.
  const [records, setRecords] = useState(new Map<string, CallRecord>());
  const recordStatus = useStream(
    sdk,
    (streams) =>
      streams.cdrs.onDomain({
        completed: (r) => setRecords((m) => upsert(m, r.recordId, r)),
        updated: (r) => setRecords((m) => upsert(m, r.recordId, r)),
      }),
    [],
    { retain: LIVE_FEEDS.records },
  );

  useResetOnPending(queueStatus, () => setQueues(new Map()));
  useResetOnPending(agentStatus, () => setAgents(new Map()));
  useResetOnPending(callStatus, () => setCalls(new Map()));
  useResetOnPending(presenceStatus, () => setPresence(new Map()));
  useResetOnPending(deviceStatus, () => setDevices(new Map()));
  useResetOnPending(notificationStatus, () => setNotifications([]));
  useResetOnPending(userStatus, () => setUserChanges([]));
  useResetOnPending(recordStatus, () => setRecords(new Map()));

  const [queueNames, setQueueNames] = useState(
    () => cached?.queueNames ?? new Map<string, string>(),
  );
  const [userNames, setUserNames] = useState(
    () => cached?.userNames ?? new Map<string, string>(),
  );
  useEffect(() => {
    if (!api || !domain) return;
    let cancelled = false;
    liveHistory.loadSeed(api, domain).then((seed) => {
      if (cancelled) return;
      // Under what the streams delivered: a streamed record is never overwritten.
      const under = <T,>(map: Map<string, T>, entries: [string, T][]) => {
        const next = new Map(entries);
        map.forEach((value, key) => next.set(key, value));
        return next;
      };
      setQueues((m) =>
        under(
          m,
          seed.queues.map((q) => [q.queue, q]),
        ),
      );
      setAgents((m) =>
        under(
          m,
          seed.agents.map((a) => [agentKey(a), a]),
        ),
      );
      setDevices((m) =>
        under(
          m,
          seed.devices.map((d) => [d.device, d]),
        ),
      );
      setQueueNames(seed.queueNames);
      setUserNames(seed.userNames);
    });
    return () => {
      cancelled = true;
    };
    // A session change clears LiveHistory's seed and these maps (on 'pending');
    // the queue feed going live again re-runs this, so the new session is read.
    // Otherwise the read is cached and this costs nothing.
  }, [api, domain, queueStatus.state]);

  const { history, recordDeliveries, outcomes } = useSyncExternalStore(
    liveHistory.subscribe,
    liveHistory.getSnapshot,
  );

  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const queueList = [...queues.values()].sort((a, b) =>
    a.queue.localeCompare(b.queue),
  );
  const callList = [...calls.values()].sort((a, b) =>
    a.startedAt.localeCompare(b.startedAt),
  );
  const deviceList = [...devices.values()].sort((a, b) =>
    a.device.localeCompare(b.device),
  );
  const presenceList = [...presence.values()];

  const nameOf = (u: string) => {
    const p = presence.get(u);
    const name = p ? `${p.firstName} ${p.lastName}`.trim() : '';
    return name || userNames.get(u) || u;
  };
  const queueName = (queue: string) =>
    queueNames.get(queue) ?? `Queue ${queue}`;

  const state: LiveState = {
    sdk,
    queues: queueList,
    queueStatus,
    agents: [...agents.values()].sort(
      (a, b) => a.queue.localeCompare(b.queue) || a.user.localeCompare(b.user),
    ),
    agentStatus,
    calls: callList,
    callStatus,
    presence: presenceList,
    presenceStatus,
    devices: deviceList,
    deviceStatus,
    notifications,
    notificationStatus,
    userChanges,
    userStatus,
    records: [...records.values()]
      .sort((a, b) => b.endedAt.localeCompare(a.endedAt))
      .slice(0, RECORDS_KEPT),
    recordDeliveries,
    recordStatus,
    history,
    outcomes,
    now,
    nameOf,
    queueName,
  };
  return <LiveContext.Provider value={state}>{children}</LiveContext.Provider>;
}
