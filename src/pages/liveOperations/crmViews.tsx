/**
 * The cross-system cards: Flow's live feeds joined to Example CRM (the mock in
 * `mocks/crm.ts`, through crmJoin.ts).
 *
 * These replace the page's old wallboard — a queue board, an agent status grid,
 * a domain calls table — which drew what the host's own supervisor dashboard
 * and wallboard already draw, from the same feeds, and so made the SDK look
 * like a second way to get a screen the platform ships. What is here instead
 * needs a fact only the partner's system holds:
 *
 *   Customers on the line   every call with a CRM account, VIPs and open deals
 *                           first, and whether they are waiting or with whom
 *   Not in the CRM          outside callers nobody has a record for: leads
 *   Agents and accounts     who each agent is talking to, as an account, and
 *                           whether the phone they are queued on is registered
 *
 * The stream lessons are unchanged underneath: data from LiveProvider, status
 * printed on every card (`CardBody`), a refusal shown as the host wrote it.
 * Kit components only; colours are palette paths and Chip tones.
 */
import type { CallActivity, CallParty } from '@netsapiens/flow-sdk';
import type { ReactNode } from 'react';
import { useFlowContext } from '@netsapiens/flow-sdk';

import type { CrmRecord } from '../../mocks/crm';
import type { Tone } from './format';
import type { AgentState } from './liveContext';
import { formatDealValue } from '../../mocks/crm';
import { Stat } from './cards';
import {
  accountForAgent,
  accountsOnTheLine,
  isWaiting,
  rankOf,
  unknownCallers,
} from './crmJoin';
import {
  chipColor,
  fmtSeconds,
  initials,
  isBlocked,
  party,
  since,
} from './format';
import { foldAgents, useLive } from './liveContext';
import { CardBody, Empty, StreamNote } from './parts';

/** What the join is, for the tooltip on each card's status chip. */
const JOIN = 'calls.onDomainCalls({ updated, ended }) × Example CRM';

// ── Headline leaves ──────────────────────────────────────────────────────────

export function KnownCustomersStat() {
  const { calls, callStatus } = useLive();
  const known = accountsOnTheLine(calls).length;
  const strangers = unknownCallers(calls).length;
  return (
    <Stat
      status={callStatus}
      metric='known'
      value={known}
      caption={
        strangers
          ? `${strangers} caller${strangers === 1 ? '' : 's'} not in the CRM`
          : `of ${calls.length} calls in progress`
      }
      tone='primary'
    />
  );
}

export function VipStat() {
  const { calls, callStatus } = useLive();
  const vips = accountsOnTheLine(calls).filter((a) => a.record.tier === 'vip');
  const waiting = vips.filter((a) => isWaiting(a.call)).length;
  return (
    <Stat
      status={callStatus}
      metric='vip'
      value={vips.length}
      caption={waiting ? `${waiting} still waiting` : 'none waiting'}
      tone={waiting ? 'warning' : vips.length ? 'info' : 'success'}
    />
  );
}

/** Open-deal value on the line now, each account counted once. */
export function PipelineStat() {
  const { ui } = useFlowContext();
  const { calls, callStatus } = useLive();
  const StatBlock = ui?.StatBlock;
  if (!StatBlock) return null;
  if (isBlocked(callStatus))
    return (
      <StatBlock value='—' caption='Not available to you' tone='neutral' />
    );
  const deals = new Map<string, number>();
  for (const { record } of accountsOnTheLine(calls))
    if (record.opportunity) deals.set(record.company, record.opportunity.value);
  const total = [...deals.values()].reduce((n, v) => n + v, 0);
  return (
    <StatBlock
      value={total ? formatDealValue(total) : '—'}
      caption={
        deals.size
          ? `${deals.size} open deal${deals.size === 1 ? '' : 's'} on a call`
          : 'no open deals on a call'
      }
      tone={deals.size ? 'primary' : 'neutral'}
    />
  );
}

// ── Pieces ───────────────────────────────────────────────────────────────────

/** The CRM's two flags, as chips: tier, then the deal and its stage. */
function AccountChips({ record }: { record: CrmRecord }) {
  const { ui } = useFlowContext();
  const { Chip, Stack } = ui ?? {};
  if (!Chip || !Stack) return null;
  if (rankOf(record) === 2) return null;
  return (
    <Stack direction='row' spacing={0.5} flexWrap='wrap' useFlexGap>
      {record.tier === 'vip' ? (
        <Chip size='small' color='warning' label='VIP' />
      ) : null}
      {record.opportunity ? (
        <Chip
          size='small'
          variant='outlined'
          color='primary'
          label={`${formatDealValue(record.opportunity.value)} · ${record.opportunity.stage}`}
        />
      ) : null}
    </Stack>
  );
}

/** Two lines in a table cell: a bold primary and a muted secondary. */
function TwoLine({
  primary,
  secondary,
}: {
  primary: ReactNode;
  secondary?: ReactNode;
}) {
  const { ui } = useFlowContext();
  const Typography = ui?.Typography;
  if (!Typography) return null;
  return (
    <>
      <Typography variant='body2' fontWeight={600}>
        {primary}
      </Typography>
      {secondary ? (
        <Typography variant='caption' color='text.secondary'>
          {secondary}
        </Typography>
      ) : null}
    </>
  );
}

/** Where a call with an account stands: waiting in a queue, or with someone. */
function whereOf(
  call: CallActivity,
  account: CallParty,
  nameOf: (user: string) => string,
): string {
  if (isWaiting(call))
    return `Waiting · via ${call.through?.name || call.through?.user}`;
  const other = account === call.from ? call.to : call.from;
  const who = other.user ? nameOf(other.user) : party(other);
  if (call.state === 'held') return `On hold with ${who}`;
  if (call.state === 'ringing') return `Ringing ${who}`;
  return `With ${who}`;
}

// ── Customers on the line ────────────────────────────────────────────────────

export function AccountsOnLineCard() {
  const { ui } = useFlowContext();
  const { calls, callStatus, now, nameOf } = useLive();
  const { Table, TableHead, TableBody, TableRow, TableCell } = ui ?? {};
  if (!Table || !TableHead || !TableBody || !TableRow || !TableCell)
    return null;
  const rows = accountsOnTheLine(calls);
  return (
    <CardBody status={callStatus} call={JOIN}>
      {rows.length === 0 ? (
        <Empty
          icon='mdi:account-star-outline'
          title='No CRM accounts on the line'
          description='A call shows up here when either end matches an Example CRM record.'
        />
      ) : (
        <Table size='small'>
          <TableHead>
            <TableRow>
              <TableCell>Account</TableCell>
              <TableCell>In the CRM</TableCell>
              <TableCell>Where</TableCell>
              <TableCell align='right'>Time</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map(({ call, record, party: p }) => (
              <TableRow key={call.callId}>
                <TableCell>
                  <TwoLine
                    primary={record.company}
                    secondary={`${record.name} · ${p.number || p.user}`}
                  />
                </TableCell>
                <TableCell>
                  <AccountChips record={record} />
                </TableCell>
                <TableCell>{whereOf(call, p, nameOf)}</TableCell>
                <TableCell align='right'>
                  {fmtSeconds(since(call.answeredAt ?? call.startedAt, now))}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </CardBody>
  );
}

// ── Not in the CRM ───────────────────────────────────────────────────────────

export function UnknownCallersCard() {
  const { ui } = useFlowContext();
  const { calls, callStatus, now } = useLive();
  const { List, ListItem, ListItemText, Chip } = ui ?? {};
  if (!List || !ListItem || !ListItemText || !Chip) return null;
  const rows = unknownCallers(calls);
  return (
    <CardBody status={callStatus} call={JOIN}>
      {rows.length === 0 ? (
        <Empty
          icon='mdi:account-check-outline'
          title='Every outside caller is known'
          description='A caller with no Example CRM record lands here — a lead to create.'
        />
      ) : (
        <List dense disablePadding>
          {rows.map(({ call, party: p }) => (
            <ListItem
              key={call.callId}
              disableGutters
              secondaryAction={
                <Chip
                  size='small'
                  variant='outlined'
                  label={fmtSeconds(since(call.startedAt, now))}
                />
              }
            >
              <ListItemText
                primary={p.name || p.number}
                secondary={
                  isWaiting(call)
                    ? `Waiting · via ${call.through?.name || call.through?.user}`
                    : `No record for ${p.number}`
                }
              />
            </ListItem>
          ))}
        </List>
      )}
    </CardBody>
  );
}

// ── Agents and the account on their call ─────────────────────────────────────

/** Rows drawn at most; on-call agents with the most important accounts first. */
const AGENT_LIMIT = 40;

const STATES: Record<AgentState, { label: string; tone: Tone }> = {
  oncall: { label: 'On a call', tone: 'info' },
  available: { label: 'Available', tone: 'success' },
  unavailable: { label: 'Unavailable', tone: 'warning' },
  oos: { label: 'Out of service', tone: 'neutral' },
};
const ORDER = Object.keys(STATES) as AgentState[];

/**
 * One row per person (foldAgents), joined twice: to the domain's calls for the
 * account on the other end, and to the phone feed for whether the device they
 * are queued on is registered. The second join is why the page no longer has a
 * Phones tab — the host's registrations page lists every phone better than an
 * app can. What it cannot say is "this agent is taking queue calls on a phone
 * that dropped off", which takes the agent feed and the device feed together.
 */
export function AgentAccountsCard() {
  const { ui } = useFlowContext();
  const {
    agents,
    agentStatus,
    calls,
    callStatus,
    devices,
    deviceStatus,
    nameOf,
    bigDomain,
  } = useLive();
  const {
    Table,
    TableHead,
    TableBody,
    TableRow,
    TableCell,
    Chip,
    Avatar,
    Stack,
    Typography,
  } = ui ?? {};
  if (
    !Table ||
    !TableHead ||
    !TableBody ||
    !TableRow ||
    !TableCell ||
    !Chip ||
    !Avatar ||
    !Stack ||
    !Typography
  ) {
    return null;
  }

  const phones = new Map<string, boolean>();
  for (const d of devices)
    phones.set(d.user, (phones.get(d.user) ?? false) || d.registered);

  const people = [...foldAgents(agents)]
    .map(([user, p]) => ({
      user,
      name: nameOf(user),
      ...p,
      account: accountForAgent(user, calls),
      phone: phones.get(user),
    }))
    .sort(
      (a, b) =>
        ORDER.indexOf(a.state) - ORDER.indexOf(b.state) ||
        (a.account ? rankOf(a.account.record) : 3) -
          (b.account ? rankOf(b.account.record) : 3) ||
        a.name.localeCompare(b.name),
    );

  return (
    <CardBody
      status={agentStatus}
      call='queues.onDomainQueues({ agent… }) × calls.onDomainCalls × devices.onDomain × Example CRM'
    >
      {/* The join's other inputs can be refused on their own. Say which, so an
          empty column reads as "not yours to see", not as "nobody is on a call". */}
      {isBlocked(callStatus) ? (
        <StreamNote status={callStatus} call='calls.onDomainCalls' />
      ) : null}
      {isBlocked(deviceStatus) ? (
        <StreamNote status={deviceStatus} call='devices.onDomain' />
      ) : null}
      {people.length === 0 ? (
        <Empty icon='mdi:headset' title='No agents reported yet' />
      ) : (
        <Stack spacing={1}>
          {bigDomain ? (
            <Typography variant='caption' color='text.secondary'>
              This domain has too many agents to load up front. Agents appear
              here as their state changes.
            </Typography>
          ) : null}
          <Table size='small'>
            <TableHead>
              <TableRow>
                <TableCell>Agent</TableCell>
                <TableCell>State</TableCell>
                <TableCell>Talking to</TableCell>
                <TableCell>In the CRM</TableCell>
                <TableCell>Phone</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {people.slice(0, AGENT_LIMIT).map((p) => (
                <TableRow key={p.user}>
                  <TableCell>
                    <Stack direction='row' spacing={1} alignItems='center'>
                      <Avatar sx={{ width: 28, height: 28, fontSize: 12 }}>
                        {initials(p.name)}
                      </Avatar>
                      <Typography variant='body2'>{p.name}</Typography>
                    </Stack>
                  </TableCell>
                  <TableCell>
                    <Chip
                      size='small'
                      variant='outlined'
                      label={STATES[p.state].label}
                      color={chipColor(STATES[p.state].tone)}
                    />
                  </TableCell>
                  <TableCell>
                    {p.account ? (
                      <TwoLine
                        primary={p.account.record.company}
                        secondary={p.account.record.name}
                      />
                    ) : p.state === 'oncall' ? (
                      <Typography variant='body2' color='text.secondary'>
                        Not in the CRM
                      </Typography>
                    ) : (
                      '—'
                    )}
                  </TableCell>
                  <TableCell>
                    {p.account ? (
                      <AccountChips record={p.account.record} />
                    ) : null}
                  </TableCell>
                  <TableCell>
                    {p.phone === undefined ? (
                      '—'
                    ) : (
                      <Chip
                        size='small'
                        variant='outlined'
                        label={p.phone ? 'Registered' : 'Offline'}
                        color={chipColor(p.phone ? 'success' : 'error')}
                      />
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {people.length > AGENT_LIMIT ? (
            <Typography variant='caption' color='text.secondary'>
              Showing {AGENT_LIMIT} of {people.length}: on a call first, most
              important accounts first.
            </Typography>
          ) : null}
        </Stack>
      )}
    </CardBody>
  );
}
