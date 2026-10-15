/**
 * The Overview's wallboard cards: who is waiting longest, what every agent is
 * doing, and how inbound calls are ending. Kit components only — Box, Paper,
 * Stack, Typography, Avatar, Chip, Donut — with every colour a palette path,
 * so the board follows the host's dark/light toggle. Data comes from
 * LiveProvider; nothing here subscribes.
 */
import type { AgentStatus } from '@netsapiens/flow-sdk';
import { useContext } from 'react';
import { useFlowContext } from '@netsapiens/flow-sdk';

import type { Tone } from './format';
import {
  chipColor,
  CRITICAL_WAIT_SEC,
  fmtSeconds,
  initials,
  since,
  waitTone,
} from './format';
import { QueuePickContext, useLive, waitOf } from './liveContext';
import { CardBody, Empty } from './parts';

/** A tone as a palette path; neutral is the muted text colour. */
const paletteOf = (tone: Tone) =>
  tone === 'neutral' ? 'text.disabled' : `${tone}.main`;

// ── Longest waits ────────────────────────────────────────────────────────────

/**
 * Queues with callers waiting, oldest wait first, each with a bar that fills
 * toward the critical threshold. One row per queue: individual callers come
 * from `queues.onQueue`, which the page opens only for the queue a supervisor
 * drills into (click a row).
 */
export function LongestWaitsCard() {
  const { ui } = useFlowContext();
  const { queues, queueStatus, now } = useLive();
  const pick = useContext(QueuePickContext);
  const { Box, Stack, Typography } = ui ?? {};
  if (!Box || !Stack || !Typography) return null;

  const waiting = queues
    .filter((q) => q.waiting > 0)
    .map((q) => ({ q, wait: waitOf(q, now) }))
    .sort((a, b) => b.wait - a.wait);

  return (
    <CardBody status={queueStatus} call='queues.onDomainQueues({ stats })'>
      {waiting.length === 0 ? (
        <Empty
          icon='mdi:account-clock'
          title='No one is waiting'
          description='Queues with callers on hold appear here, longest wait first.'
        />
      ) : (
        <Stack divider={<Box sx={{ borderTop: 1, borderColor: 'divider' }} />}>
          {waiting.map(({ q, wait }, i) => {
            const tone = waitTone(wait);
            return (
              <Box
                key={q.queue}
                onClick={() => pick(q.queue)}
                sx={{
                  py: 1.25,
                  cursor: 'pointer',
                  '&:hover': { bgcolor: 'action.hover' },
                }}
              >
                <Stack direction='row' spacing={1.5} alignItems='center'>
                  <Typography
                    variant='body2'
                    color='text.secondary'
                    sx={{ width: 16, fontVariantNumeric: 'tabular-nums' }}
                  >
                    {i + 1}
                  </Typography>
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography variant='body2' fontWeight={600} noWrap>
                      Queue {q.queue}
                    </Typography>
                    <Typography variant='caption' color='text.secondary'>
                      {q.waiting} waiting · {q.agentsAvailable} of{' '}
                      {q.agentsLoggedIn} agents free
                    </Typography>
                  </Box>
                  <Typography
                    variant='subtitle1'
                    fontWeight={700}
                    color={paletteOf(tone)}
                    sx={{ fontVariantNumeric: 'tabular-nums' }}
                  >
                    {fmtSeconds(wait)}
                  </Typography>
                </Stack>
                {/* The bar fills toward the critical wait, then stays full. */}
                <Box
                  sx={{
                    ml: 3.5,
                    mt: 0.75,
                    height: 4,
                    borderRadius: 2,
                    bgcolor: 'action.hover',
                    overflow: 'hidden',
                  }}
                >
                  <Box
                    sx={{
                      height: 1,
                      width: `${Math.min(100, (wait / CRITICAL_WAIT_SEC) * 100)}%`,
                      bgcolor: paletteOf(tone),
                    }}
                  />
                </Box>
              </Box>
            );
          })}
        </Stack>
      )}
    </CardBody>
  );
}

// ── Agent status board ───────────────────────────────────────────────────────

type AgentState = 'oncall' | 'available' | 'unavailable' | 'oos';

const STATES: Record<AgentState, { label: string; tone: Tone }> = {
  oncall: { label: 'On a call', tone: 'info' },
  available: { label: 'Available', tone: 'success' },
  unavailable: { label: 'Unavailable', tone: 'warning' },
  oos: { label: 'Out of service', tone: 'neutral' },
};

/**
 * One tile per person. The stream reports an agent once per queue they belong
 * to, so fold those memberships: on a call in any queue beats available in any,
 * and the time shown runs from the most recent change.
 */
function foldAgents(agents: AgentStatus[]) {
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
    const rank = (s: AgentState) =>
      ['oncall', 'available', 'unavailable', 'oos'].indexOf(s);
    if (!seen) {
      people.set(a.user, { state, changedAt: a.updatedAt });
      continue;
    }
    people.set(a.user, {
      state: rank(state) < rank(seen.state) ? state : seen.state,
      changedAt: a.updatedAt > seen.changedAt ? a.updatedAt : seen.changedAt,
    });
  }
  return people;
}

export function AgentBoardCard() {
  const { ui } = useFlowContext();
  const { agents, agentStatus, nameOf, now } = useLive();
  const { Avatar, Box, Chip, Paper, Stack, Typography } = ui ?? {};
  if (!Avatar || !Box || !Chip || !Paper || !Stack || !Typography) return null;

  const people = [...foldAgents(agents)]
    .map(([user, p]) => ({ user, name: nameOf(user), ...p }))
    .sort(
      (a, b) =>
        Object.keys(STATES).indexOf(a.state) -
          Object.keys(STATES).indexOf(b.state) || a.name.localeCompare(b.name),
    );
  const counts = (Object.keys(STATES) as AgentState[]).map((state) => ({
    state,
    n: people.filter((p) => p.state === state).length,
  }));

  return (
    <CardBody
      status={agentStatus}
      call='queues.onDomainQueues({ agentUpdated, agentAdded, agentRemoved })'
    >
      {people.length === 0 ? (
        <Empty icon='mdi:headset' title='No agents reported yet' />
      ) : (
        <Stack spacing={1.5}>
          <Stack direction='row' spacing={1} flexWrap='wrap' useFlexGap>
            {counts.map(({ state, n }) => (
              <Chip
                key={state}
                size='small'
                variant='outlined'
                color={chipColor(STATES[state].tone)}
                label={`${STATES[state].label} ${n}`}
              />
            ))}
          </Stack>
          <Box
            sx={{
              display: 'grid',
              gap: 1,
              gridTemplateColumns: 'repeat(auto-fill, minmax(176px, 1fr))',
            }}
          >
            {people.map((p) => {
              const { label, tone } = STATES[p.state];
              return (
                <Paper key={p.user} variant='outlined' sx={{ p: 1 }}>
                  <Stack direction='row' spacing={1} alignItems='center'>
                    <Avatar
                      sx={{
                        width: 32,
                        height: 32,
                        fontSize: 12,
                        bgcolor: 'transparent',
                        color: paletteOf(tone),
                        border: 2,
                        borderColor: paletteOf(tone),
                      }}
                    >
                      {initials(p.name)}
                    </Avatar>
                    <Box sx={{ minWidth: 0 }}>
                      <Typography variant='body2' fontWeight={600} noWrap>
                        {p.name}
                      </Typography>
                      <Stack direction='row' spacing={0.75} alignItems='center'>
                        <Box
                          sx={{
                            width: 7,
                            height: 7,
                            borderRadius: '50%',
                            bgcolor: paletteOf(tone),
                            flexShrink: 0,
                          }}
                        />
                        <Typography
                          variant='caption'
                          color='text.secondary'
                          noWrap
                          sx={{ fontVariantNumeric: 'tabular-nums' }}
                        >
                          {label} · {fmtSeconds(since(p.changedAt, now))}
                        </Typography>
                      </Stack>
                    </Box>
                  </Stack>
                </Paper>
              );
            })}
          </Box>
        </Stack>
      )}
    </CardBody>
  );
}

// ── Outcomes ─────────────────────────────────────────────────────────────────

/** How calls have ended since the app loaded: a Donut with the total inside. */
export function OutcomesCard() {
  const { ui } = useFlowContext();
  const { outcomes: o, recordStatus } = useLive();
  const Donut = ui?.Donut;
  if (!Donut) return null;
  const total = o.answered + o.missed + o.outbound + o.internal;
  return (
    <CardBody
      status={recordStatus}
      call='cdrs.onDomain({ completed, updated })'
    >
      {total === 0 ? (
        <Empty
          icon='mdi:chart-donut'
          title='No calls have ended yet'
          description='Each finished call lands here as its record arrives.'
        />
      ) : (
        <Donut
          height={240}
          centerLabel={`${total} calls`}
          slices={[
            { label: 'Answered', value: o.answered, tone: 'success' },
            { label: 'Missed', value: o.missed, tone: 'error' },
            { label: 'Outbound', value: o.outbound, tone: 'info' },
            { label: 'Internal', value: o.internal, tone: 'neutral' },
          ]}
        />
      )}
    </CardBody>
  );
}
