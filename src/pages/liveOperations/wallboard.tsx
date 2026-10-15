/**
 * The Overview's wallboard cards: who is waiting longest, what every agent is
 * doing, and how inbound calls are ending. Kit components only — List, Grid,
 * Paper, Stack, Typography, Avatar, Chip, Icon, Donut — with every colour a
 * palette path,
 * so the board follows the host's dark/light toggle. Data comes from
 * LiveProvider; nothing here subscribes.
 */
import { useContext } from 'react';
import { useFlowContext } from '@netsapiens/flow-sdk';

import type { Tone } from './format';
import type { AgentState } from './liveContext';
import {
  chipColor,
  CRITICAL_WAIT_SEC,
  fmtSeconds,
  initials,
  since,
  waitTone,
} from './format';
import { foldAgents, QueuePickContext, useLive, waitOf } from './liveContext';
import { CardBody, Empty } from './parts';

/** A tone as a palette path; neutral is the muted text colour. */
const paletteOf = (tone: Tone) =>
  tone === 'neutral' ? 'text.disabled' : `${tone}.main`;

// ── Longest waits ────────────────────────────────────────────────────────────

/**
 * Queues with callers waiting, oldest wait first. One row per queue: individual
 * callers come from `queues.onQueue`, which the page opens only for the queue a
 * supervisor drills into (click a row). The kit has no progress bar, so urgency
 * is the wait's colour plus a Critical chip, as on the headline tiles.
 */
export function LongestWaitsCard() {
  const { ui } = useFlowContext();
  const { queues, queueStatus, now, queueName } = useLive();
  const pick = useContext(QueuePickContext);
  const { Avatar, Chip, List, ListItem, ListItemText, Stack, Typography } =
    ui ?? {};
  if (!Avatar || !Chip || !List || !ListItem || !ListItemText || !Stack)
    return null;
  if (!Typography) return null;

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
        <List disablePadding>
          {waiting.map(({ q, wait }, i) => {
            const tone = waitTone(wait);
            return (
              <ListItem
                key={q.queue}
                divider={i < waiting.length - 1}
                disableGutters
                onClick={() => pick(q.queue)}
                sx={{ cursor: 'pointer' }}
                secondaryAction={
                  <Stack direction='row' spacing={1} alignItems='center'>
                    {wait >= CRITICAL_WAIT_SEC ? (
                      <Chip size='small' color='error' label='Critical' />
                    ) : null}
                    <Typography
                      variant='subtitle1'
                      fontWeight={700}
                      color={paletteOf(tone)}
                      sx={{ fontVariantNumeric: 'tabular-nums' }}
                    >
                      {fmtSeconds(wait)}
                    </Typography>
                  </Stack>
                }
              >
                <Avatar
                  sx={{
                    width: 28,
                    height: 28,
                    fontSize: 13,
                    mr: 1.5,
                    bgcolor: 'action.selected',
                    color: 'text.secondary',
                  }}
                >
                  {i + 1}
                </Avatar>
                <ListItemText
                  primary={queueName(q.queue)}
                  secondary={`${q.waiting} waiting · ${q.agentsAvailable} of ${q.agentsLoggedIn} agents free`}
                />
              </ListItem>
            );
          })}
        </List>
      )}
    </CardBody>
  );
}

// ── Agent status board ───────────────────────────────────────────────────────

const STATES: Record<AgentState, { label: string; tone: Tone }> = {
  oncall: { label: 'On a call', tone: 'info' },
  available: { label: 'Available', tone: 'success' },
  unavailable: { label: 'Unavailable', tone: 'warning' },
  oos: { label: 'Out of service', tone: 'neutral' },
};

export function AgentBoardCard() {
  const { ui } = useFlowContext();
  const { agents, agentStatus, nameOf, now } = useLive();
  const { Avatar, Chip, Grid, Icon, Paper, Stack, Typography } = ui ?? {};
  if (!Avatar || !Chip || !Grid || !Icon || !Paper || !Stack || !Typography)
    return null;

  const order = Object.keys(STATES) as AgentState[];
  const people = [...foldAgents(agents)]
    .map(([user, p]) => ({ user, name: nameOf(user), ...p }))
    .sort(
      (a, b) =>
        order.indexOf(a.state) - order.indexOf(b.state) ||
        a.name.localeCompare(b.name),
    );

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
            {order.map((state) => (
              <Chip
                key={state}
                size='small'
                variant='outlined'
                color={chipColor(STATES[state].tone)}
                label={`${STATES[state].label} ${people.filter((p) => p.state === state).length}`}
              />
            ))}
          </Stack>
          <Grid container spacing={1}>
            {people.map((p) => {
              const { label, tone } = STATES[p.state];
              return (
                <Grid key={p.user} size={{ xs: 12, sm: 6, md: 4, xl: 3 }}>
                  <Paper rounded variant='outlined' sx={{ p: 1 }}>
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
                      <Stack sx={{ minWidth: 0 }}>
                        <Typography variant='body2' fontWeight={600} noWrap>
                          {p.name}
                        </Typography>
                        <Stack
                          direction='row'
                          spacing={0.5}
                          alignItems='center'
                        >
                          <Icon
                            icon='mdi:circle'
                            sx={{ fontSize: 8, color: paletteOf(tone) }}
                          />
                          <Typography
                            variant='caption'
                            color='text.secondary'
                            noWrap
                            sx={{ fontVariantNumeric: 'tabular-nums' }}
                          >
                            {p.changedAt
                              ? `${label} · ${fmtSeconds(since(p.changedAt, now))}`
                              : label}
                          </Typography>
                        </Stack>
                      </Stack>
                    </Stack>
                  </Paper>
                </Grid>
              );
            })}
          </Grid>
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
          centerLabel={`${total} ${total === 1 ? 'call' : 'calls'}`}
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
