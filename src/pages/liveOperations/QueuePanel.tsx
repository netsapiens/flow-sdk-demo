/**
 * One queue in detail, in the host's SidePanel.
 *
 * Opens `queues.onQueue(queue, …)` while the panel is open and closes it when
 * the panel closes — the subscription's lifetime is the panel's. It asks for
 * everything a queue screen shows: stats, the callers waiting (`waiting` /
 * `left`), calls through the queue, and its agents.
 *
 * The caller handlers need the `calls.queue` grant and a domain-admin scope.
 * For anyone else the host refuses the whole subscription with a message, and
 * the panel shows it — the same call, written once, behaves correctly for
 * every user.
 */
import type {
  AgentStatus,
  CallActivity,
  QueueStats,
  WaitingCaller,
} from '@netsapiens/flow-sdk';
import { useState } from 'react';
import { useFlowContext, useStream } from '@netsapiens/flow-sdk';

import {
  chipColor,
  fmtSeconds,
  initials,
  isBlocked,
  since,
  waitTone,
} from './format';
import { useLive, waitOf } from './liveContext';
import { Empty, StreamNote } from './parts';

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

/** The panel body. Mounted only while the panel is open, so the stream is too. */
function QueueDetail({ queue }: { queue: string }) {
  const { ui } = useFlowContext();
  const live = useLive();
  const { sdk, now, nameOf } = live;

  // Open with what the page already holds, instead of a blank panel until
  // `onQueue` delivers: the domain-wide feeds carry this queue's stats and its
  // agents. `onQueue` then takes over and keeps them current. Callers and calls
  // through the queue exist only on `onQueue`, so those wait for it.
  const known = live.queues.find((q) => q.queue === queue) ?? null;
  const [stats, setStats] = useState<QueueStats | null>(null);
  const [waiting, setWaiting] = useState(new Map<string, WaitingCaller>());
  const [calls, setCalls] = useState(new Map<string, CallActivity>());
  const [agents, setAgents] = useState(
    () =>
      new Map(
        live.agents
          .filter((a) => a.queue === queue)
          .map((a): [string, AgentStatus] => [a.agent, a]),
      ),
  );
  const current = stats ?? known;

  const status = useStream(
    sdk,
    (streams) =>
      streams.queues.onQueue(queue, {
        stats: setStats,
        waiting: (c) => setWaiting((m) => upsert(m, c.callId, c)),
        left: (c) => setWaiting((m) => without(m, c.callId)),
        callUpdated: (c) => setCalls((m) => upsert(m, c.callId, c)),
        callEnded: (c) => setCalls((m) => without(m, c.callId)),
        agentUpdated: (a) => setAgents((m) => upsert(m, a.agent, a)),
        agentAdded: (a) => setAgents((m) => upsert(m, a.agent, a)),
        agentRemoved: (a) => setAgents((m) => without(m, a.agent)),
      }),
    [queue],
  );

  const { Stack, StatBlock, List, ListItem, ListItemText, Avatar, Chip } =
    ui ?? {};
  const Section = ui?.templates?.SideTrayComponents?.Section;
  if (
    !Stack ||
    !StatBlock ||
    !List ||
    !ListItem ||
    !ListItemText ||
    !Avatar ||
    !Chip ||
    !Section
  ) {
    return null;
  }

  const callers = [...waiting.values()].sort((a, b) =>
    a.queuedAt.localeCompare(b.queuedAt),
  );

  return (
    <Stack spacing={3}>
      <StreamNote
        status={status}
        call={`queues.onQueue('${queue}', { stats, waiting, left, callUpdated, callEnded, agent… })`}
      />
      {!isBlocked(status) && (
        <>
          <Stack direction='row' spacing={2}>
            <StatBlock
              value={current?.waiting ?? 0}
              caption='waiting'
              tone={(current?.waiting ?? 0) > 0 ? 'warning' : 'success'}
            />
            <StatBlock
              value={fmtSeconds(current ? waitOf(current, now) : 0)}
              caption='longest wait'
              tone={current ? waitTone(waitOf(current, now)) : 'success'}
            />
            <StatBlock
              value={`${current?.agentsAvailable ?? 0}/${current?.agentsLoggedIn ?? 0}`}
              caption='agents free'
              tone='success'
            />
          </Stack>

          <Section
            title={`Callers waiting (${callers.length || (current?.waiting ?? 0)})`}
          >
            {callers.length === 0 && (current?.waiting ?? 0) > 0 ? (
              // The count is known from the stats feed; who they are arrives
              // with onQueue's next delivery.
              <Empty
                icon='mdi:account-clock'
                title={`${current?.waiting} waiting`}
                description='Caller details arrive with the queue’s next update.'
              />
            ) : callers.length === 0 ? (
              <Empty icon='mdi:phone-hangup' title='No one is waiting' />
            ) : (
              <List dense disablePadding>
                {callers.map((c) => (
                  <ListItem
                    key={c.callId}
                    disableGutters
                    secondaryAction={
                      <Chip
                        size='small'
                        label={fmtSeconds(since(c.queuedAt, now))}
                        color={c.prioritized ? 'error' : 'warning'}
                      />
                    }
                  >
                    <ListItemText
                      primary={c.from.name || c.from.number}
                      secondary={c.prioritized ? 'Prioritized' : c.from.number}
                    />
                  </ListItem>
                ))}
              </List>
            )}
          </Section>

          <Section title={`Calls through the queue (${calls.size})`}>
            {calls.size === 0 ? (
              <Empty icon='mdi:phone-in-talk' title='No calls in progress' />
            ) : (
              <List dense disablePadding>
                {[...calls.values()].map((c) => (
                  <ListItem
                    key={c.callId}
                    disableGutters
                    secondaryAction={
                      <Chip
                        size='small'
                        variant='outlined'
                        label={fmtSeconds(
                          since(c.answeredAt ?? c.startedAt, now),
                        )}
                      />
                    }
                  >
                    <ListItemText
                      primary={`${c.from.name || c.from.number} → ${c.to.name || c.to.user || c.to.number}`}
                      secondary={c.state}
                    />
                  </ListItem>
                ))}
              </List>
            )}
          </Section>

          <Section title={`Agents (${agents.size})`}>
            {agents.size === 0 ? (
              <Empty icon='mdi:headset' title='No agents in this queue' />
            ) : (
              <List dense disablePadding>
                {[...agents.values()].map((a) => (
                  <ListItem
                    key={a.agent}
                    disableGutters
                    secondaryAction={
                      <Chip
                        size='small'
                        variant='outlined'
                        label={a.activeCalls > 0 ? 'On a call' : a.status}
                        color={chipColor(
                          a.activeCalls > 0
                            ? 'primary'
                            : a.status === 'available'
                              ? 'success'
                              : 'neutral',
                        )}
                      />
                    }
                  >
                    <Avatar
                      sx={{ width: 32, height: 32, fontSize: 13, mr: 1.5 }}
                    >
                      {initials(nameOf(a.user))}
                    </Avatar>
                    <ListItemText
                      primary={nameOf(a.user)}
                      secondary={a.agent}
                    />
                  </ListItem>
                ))}
              </List>
            )}
          </Section>
        </>
      )}
    </Stack>
  );
}

export function QueuePanel({
  queue,
  onClose,
}: {
  queue: string | null;
  onClose: () => void;
}) {
  const { ui } = useFlowContext();
  const { queueName } = useLive();
  const SidePanel = ui?.templates?.SidePanel;
  if (!SidePanel) return null;
  return (
    <SidePanel
      open={queue !== null}
      onClose={onClose}
      title={queue ? queueName(queue) : 'Queue'}
      subtitle='Live detail from queues.onQueue'
      width='md'
    >
      {queue ? <QueueDetail queue={queue} /> : null}
    </SidePanel>
  );
}
