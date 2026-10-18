/**
 * Live Operations cards. Every one is drawn from kit components: StatBlock,
 * Chart, Donut, ActivityList, Table, Avatar, Chip, List, Tooltip, and the host's
 * empty state. Data comes from LiveProvider; nothing here subscribes.
 *
 * The CRM joins live in crmViews.tsx and the feed status table in
 * feedHealth.tsx. What stays here is the plumbing every card shares (`Stat`,
 * `party`), the queue table — whose columns now count the CRM accounts in
 * each queue — and the feeds the host has no screen for at all: call-record
 * updates as they land, notifications, user record changes, presence.
 *
 * Gone, deliberately: the raw domain-calls table, the phones table and the
 * answered / missed tiles. The host's Active Calls, device registrations and
 * call-center reports draw those from the same data, and an app that redraws
 * them teaches nothing a partner needs.
 */
import type {
  ActivityRow,
  CallRecord,
  FlowNotification,
  StreamStatus,
} from '@netsapiens/flow-sdk';
import type { ReactNode } from 'react';
import { useContext } from 'react';
import { useFlowContext } from '@netsapiens/flow-sdk';

import type { Tone } from './format';
import type { Sample } from './liveContext';
import { accountBetween, accountsOnTheLine, isWaiting } from './crmJoin';
import {
  chipColor,
  CRITICAL_WAIT_SEC,
  fmtSeconds,
  initials,
  isBlocked,
  party,
  waitTone,
} from './format';
import { QueuePickContext, useLive, waitOf } from './liveContext';
import { CardBody, Empty, StreamNote } from './parts';

// ── Headline leaves ──────────────────────────────────────────────────────────

/** Change over the last five minutes of samples, as StatBlock wants it. */
function deltaOf(history: Sample[], key: keyof Omit<Sample, 'label'>) {
  if (history.length < 2) return undefined;
  const latest = history[history.length - 1][key];
  const before = history[Math.max(0, history.length - 31)][key];
  // An unknown value (null) has no change to report.
  if (latest === null || before === null || !before) return undefined;
  return { pct: ((latest - before) / before) * 100, label: 'vs 5 min ago' };
}

/**
 * A headline figure with its five-minute change, or "not available" when the
 * stream behind it is blocked. The trend history (liveFeeds.ts) supplies the
 * delta, which is why a metric has to be a `Sample` key.
 */
export function Stat({
  status,
  metric,
  value,
  caption,
  tone,
}: {
  status: StreamStatus;
  metric: keyof Omit<Sample, 'label'>;
  value: number | string;
  caption: string;
  tone: Tone;
}) {
  const { ui } = useFlowContext();
  const { history } = useLive();
  const StatBlock = ui?.StatBlock;
  if (!StatBlock) return null;
  if (isBlocked(status)) {
    return (
      <StatBlock value='—' caption='Not available to you' tone='neutral' />
    );
  }
  return (
    <StatBlock
      value={value}
      caption={caption}
      tone={tone}
      spark={history
        .slice(-18)
        .map((s) => s[metric])
        .filter((v): v is number => v !== null)}
      delta={deltaOf(history, metric)}
    />
  );
}

export function WaitingStat() {
  const { queues, queueStatus, agentTotals } = useLive();
  const waiting = queues.reduce((n, q) => n + q.waiting, 0);
  const free = agentTotals?.free ?? 0;
  return (
    <Stat
      status={queueStatus}
      metric='waiting'
      value={waiting}
      caption={
        waiting === 0
          ? 'no one waiting'
          : !agentTotals
            ? `${waiting} waiting`
            : free === 0
              ? 'no agent free'
              : `${free} agent${free === 1 ? '' : 's'} free`
      }
      tone={waiting === 0 ? 'success' : free === 0 ? 'error' : 'warning'}
    />
  );
}

export function LongestWaitStat() {
  const { queues, queueStatus, now } = useLive();
  let longest = 0;
  let where = '';
  for (const q of queues) {
    const wait = waitOf(q, now);
    if (wait > longest) [longest, where] = [wait, q.queue];
  }
  return (
    <Stat
      status={queueStatus}
      metric='longestWait'
      value={longest ? fmtSeconds(longest) : '—'}
      caption={
        !longest
          ? 'no one waiting'
          : longest >= CRITICAL_WAIT_SEC
            ? `critical · queue ${where}`
            : `queue ${where}`
      }
      tone={longest ? waitTone(longest) : 'success'}
    />
  );
}

export function AgentsFreeStat() {
  const { agentTotals, queueStatus } = useLive();
  // People, from the platform's domain totals (see agentTotalsOf).
  return (
    <Stat
      status={queueStatus}
      metric='agentsFree'
      value={agentTotals ? `${agentTotals.free} / ${agentTotals.total}` : '—'}
      caption={
        agentTotals ? 'free of agents in queues' : 'with the next queue update'
      }
      tone={!agentTotals || agentTotals.free > 0 ? 'success' : 'warning'}
    />
  );
}

export function AvailableStat() {
  const { presence, presenceStatus } = useLive();
  const open = presence.filter((p) => p.presence === 'open').length;
  return (
    <Stat
      status={presenceStatus}
      metric='available'
      value={open}
      caption={`of ${presence.length} seen`}
      tone='info'
    />
  );
}

// ── Trend ────────────────────────────────────────────────────────────────────

export function ActivityChart() {
  const { ui } = useFlowContext();
  const { history } = useLive();
  const Chart = ui?.Chart;
  if (!Chart) return null;
  if (history.length < 2) {
    return (
      <Empty
        icon='mdi:chart-areaspline'
        title='Collecting'
        description='The trend fills in every ten seconds, from when the app loaded.'
      />
    );
  }
  // History the host cannot keep for you: a retained feed hands back current
  // state, so liveFeeds.ts samples the CRM join in `retain`'s own handlers,
  // which run whether or not this page is open.
  return (
    <Chart
      kind='area'
      height={220}
      data={history.map((sample) => ({ ...sample }))}
      xKey='label'
      series={[
        { key: 'calls', label: 'Calls in progress', tone: 'neutral' },
        { key: 'known', label: 'With a CRM account', tone: 'primary' },
        { key: 'vip', label: 'With a VIP', tone: 'warning' },
      ]}
    />
  );
}

// ── Queues and agents ────────────────────────────────────────────────────────

/** A figure in a table cell, coloured by tone; neutral reads as plain text. */
function Toned({ tone, children }: { tone: Tone; children: ReactNode }) {
  const { ui } = useFlowContext();
  const Typography = ui?.Typography;
  if (!Typography) return null;
  return (
    <Typography
      component='span'
      variant='body2'
      fontWeight={tone === 'neutral' ? undefined : 600}
      color={tone === 'neutral' ? 'text.primary' : `${tone}.main`}
      sx={{ fontVariantNumeric: 'tabular-nums' }}
    >
      {children}
    </Typography>
  );
}

/**
 * The queues, with what the host's own queue board cannot add: how many of the
 * calls through each one are CRM accounts, and how many of the callers still
 * waiting are VIPs. Joined on `through.user` — a domain call routed through a
 * queue names it there. The counts are domain calls, so they are empty (and
 * say so in the footer) for anyone the calls feed refuses.
 */
export function QueuesCard() {
  const { ui } = useFlowContext();
  const { queues, queueStatus, now, queueName, calls, callStatus } = useLive();
  const pick = useContext(QueuePickContext);
  const { Table, TableHead, TableBody, TableRow, TableCell, Typography } =
    ui ?? {};
  if (
    !Table ||
    !TableHead ||
    !TableBody ||
    !TableRow ||
    !TableCell ||
    !Typography
  )
    return null;
  const accounts = accountsOnTheLine(calls);
  const inQueue = (queue: string) =>
    accounts.filter((a) => a.call.through?.user === queue);
  // Busiest first, the way a supervisor scans it.
  const rows = [...queues].sort(
    (a, b) =>
      b.waiting - a.waiting ||
      waitOf(b, now) - waitOf(a, now) ||
      a.queue.localeCompare(b.queue),
  );
  return (
    <CardBody status={queueStatus} call='queues.onDomainQueues({ stats })'>
      {rows.length === 0 ? (
        <Empty icon='mdi:account-group' title='No queue activity yet' />
      ) : (
        <Table size='small'>
          <TableHead>
            <TableRow>
              <TableCell>Queue</TableCell>
              <TableCell align='right'>Waiting</TableCell>
              <TableCell align='right'>Longest wait</TableCell>
              <TableCell align='right'>CRM accounts</TableCell>
              <TableCell align='right'>VIPs waiting</TableCell>
              <TableCell align='right'>Agents free / in</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map((q) => {
              const wait = waitOf(q, now);
              const known = inQueue(q.queue);
              const vipsWaiting = known.filter(
                (a) => a.record.tier === 'vip' && isWaiting(a.call),
              ).length;
              return (
                <TableRow
                  key={q.queue}
                  hover
                  sx={{ cursor: 'pointer' }}
                  onClick={() => pick(q.queue)}
                >
                  <TableCell>
                    <Typography variant='body2' fontWeight={600}>
                      {queueName(q.queue)}
                    </Typography>
                    <Typography variant='caption' color='text.secondary'>
                      {q.queue}
                    </Typography>
                  </TableCell>
                  <TableCell align='right'>
                    <Toned
                      tone={
                        q.waiting === 0
                          ? 'neutral'
                          : q.agentsAvailable === 0
                            ? 'error'
                            : 'warning'
                      }
                    >
                      {q.waiting}
                    </Toned>
                  </TableCell>
                  <TableCell align='right'>
                    <Toned tone={wait ? waitTone(wait) : 'neutral'}>
                      {wait ? fmtSeconds(wait) : '—'}
                    </Toned>
                  </TableCell>
                  <TableCell align='right'>
                    <Toned tone={known.length ? 'primary' : 'neutral'}>
                      {isBlocked(callStatus) ? '—' : known.length}
                    </Toned>
                  </TableCell>
                  <TableCell align='right'>
                    <Toned tone={vipsWaiting ? 'error' : 'neutral'}>
                      {isBlocked(callStatus) ? '—' : vipsWaiting}
                    </Toned>
                  </TableCell>
                  <TableCell align='right'>
                    <Toned
                      tone={q.agentsAvailable === 0 ? 'warning' : 'neutral'}
                    >
                      {q.agentsAvailable} / {q.agentsLoggedIn}
                    </Toned>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}
      {isBlocked(callStatus) ? (
        <StreamNote status={callStatus} call='calls.onDomainCalls' />
      ) : null}
    </CardBody>
  );
}

// ── Call records ─────────────────────────────────────────────────────────────

const DIRECTION: Record<string, { label: string; tone: Tone }> = {
  inbound: { label: 'Inbound', tone: 'info' },
  outbound: { label: 'Outbound', tone: 'primary' },
  missed: { label: 'Missed', tone: 'error' },
  internal: { label: 'Internal', tone: 'neutral' },
};

function direction(r: CallRecord) {
  return (
    (r.direction && DIRECTION[r.direction]) || {
      label: 'Not routed',
      tone: 'neutral' as Tone,
    }
  );
}

/** `recordingStatus` is the platform's code: 0 none, 2 available, 3 transcribed. */
function recording(r: CallRecord): { label: string; tone: Tone } {
  switch (r.recordingStatus) {
    case 0:
      return { label: 'None', tone: 'neutral' };
    case 2:
      return { label: 'Available', tone: 'success' };
    case 3:
      return { label: 'Transcribed', tone: 'success' };
    default:
      return { label: 'Processing', tone: 'warning' };
  }
}

function mos(r: CallRecord): string {
  const { orig, term } = r.mos;
  if (orig == null && term == null) return '—';
  const f = (v: number | null) => (v == null ? '—' : v.toFixed(2));
  return `${f(orig)} / ${f(term)}`;
}

export function RecordsStat() {
  const { ui } = useFlowContext();
  const { outcomes, recordStatus } = useLive();
  const StatBlock = ui?.StatBlock;
  if (!StatBlock) return null;
  if (isBlocked(recordStatus))
    return (
      <StatBlock value='—' caption='Not available to you' tone='neutral' />
    );
  // Running totals since the app loaded, not `records`, which holds only the
  // latest RECORDS_KEPT for the table.
  const { missed } = outcomes;
  const ended =
    outcomes.answered + outcomes.missed + outcomes.outbound + outcomes.internal;
  return (
    <StatBlock
      value={ended}
      caption={missed ? `${missed} missed` : 'since the app loaded'}
      tone={missed ? 'warning' : 'primary'}
    />
  );
}

export function RecordUpdatesStat() {
  const { ui } = useFlowContext();
  const { recordDeliveries, recordStatus } = useLive();
  const StatBlock = ui?.StatBlock;
  if (!StatBlock) return null;
  if (isBlocked(recordStatus))
    return (
      <StatBlock value='—' caption='Not available to you' tone='neutral' />
    );
  const updates = recordDeliveries.filter((d) => d.kind === 'updated').length;
  return (
    <StatBlock
      value={updates}
      caption='records changed after the call'
      tone='info'
    />
  );
}

export function DispositionedStat() {
  const { ui } = useFlowContext();
  const { records, recordStatus } = useLive();
  const StatBlock = ui?.StatBlock;
  if (!StatBlock) return null;
  if (isBlocked(recordStatus))
    return (
      <StatBlock value='—' caption='Not available to you' tone='neutral' />
    );
  const done = records.filter((r) => r.disposition).length;
  return (
    <StatBlock
      value={done}
      caption={`of ${records.length} with a disposition`}
      tone={records.length && done === records.length ? 'success' : 'neutral'}
    />
  );
}

export function CallRecordsCard() {
  const { ui } = useFlowContext();
  const { records, recordStatus } = useLive();
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
    <CardBody
      status={recordStatus}
      call='cdrs.onDomain({ completed, updated })'
    >
      {records.length === 0 ? (
        <Empty
          icon='mdi:phone-log'
          title='No calls have ended yet'
          description='A record appears when a call ends, and updates as its recording, call quality and disposition land.'
        />
      ) : (
        <Table size='small'>
          <TableHead>
            <TableRow>
              <TableCell>Ended</TableCell>
              <TableCell>Direction</TableCell>
              <TableCell>From</TableCell>
              <TableCell>To</TableCell>
              <TableCell>CRM account</TableCell>
              <TableCell align='right'>Duration</TableCell>
              <TableCell>Disposition</TableCell>
              <TableCell>Recording</TableCell>
              <TableCell align='right'>MOS</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {records.map((r) => {
              const dir = direction(r);
              const rec = recording(r);
              const account = accountBetween(r);
              return (
                <TableRow key={r.recordId}>
                  <TableCell>
                    <Tooltip title={r.releaseText ?? r.recordId}>
                      <Typography variant='body2'>
                        {timeOf(r.endedAt)}
                      </Typography>
                    </Tooltip>
                  </TableCell>
                  <TableCell>
                    <Chip
                      size='small'
                      variant='outlined'
                      label={dir.label}
                      color={chipColor(dir.tone)}
                    />
                  </TableCell>
                  <TableCell>{party(r.from)}</TableCell>
                  <TableCell>
                    {party(r.to)}
                    {r.through
                      ? ` via ${r.through.name || r.through.user}`
                      : ''}
                  </TableCell>
                  <TableCell>
                    {account ? account.record.company : '—'}
                  </TableCell>
                  <TableCell align='right'>
                    {fmtSeconds(r.durationSec)}
                  </TableCell>
                  <TableCell>
                    {r.disposition ? (
                      <Tooltip
                        title={[r.reason, r.notes].filter(Boolean).join(' — ')}
                      >
                        <Typography variant='body2'>{r.disposition}</Typography>
                      </Tooltip>
                    ) : (
                      '—'
                    )}
                  </TableCell>
                  <TableCell>
                    <Chip
                      size='small'
                      variant='outlined'
                      label={rec.label}
                      color={chipColor(rec.tone)}
                    />
                  </TableCell>
                  <TableCell align='right'>{mos(r)}</TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}
    </CardBody>
  );
}

/** The fields an agent writes after a call, which a CRM wants back. */
const WRITE_BACK = new Set(['disposition', 'reason', 'notes', 'summary']);

/**
 * Every delivery as it arrives, so a record's later updates are visible: the
 * call ends (`completed`), then the recording, call quality, summary and
 * disposition land one by one (`updated`).
 *
 * This is the lifecycle a CRM integration actually has to handle, and the
 * host's Call Logs never shows it: a record is not final when the call ends.
 * When an update carries something an agent wrote (disposition, notes, the AI
 * summary) on a call with a CRM account, the row says it is ready to write
 * back — the moment a real integration would POST the activity to the CRM.
 */
export function RecordDeliveriesCard() {
  const { ui } = useFlowContext();
  const { recordDeliveries, recordStatus } = useLive();
  const ActivityList = ui?.ActivityList;
  if (!ActivityList) return null;
  const rows: ActivityRow[] = recordDeliveries.map((d) => {
    const account = accountBetween(d.record);
    const writeBack =
      account && d.changed.some((field) => WRITE_BACK.has(field));
    return {
      id: d.id,
      primary: account
        ? `${party(d.record.from)} → ${party(d.record.to)} · ${account.record.company}`
        : `${party(d.record.from)} → ${party(d.record.to)}`,
      secondary:
        d.kind === 'completed'
          ? 'Call ended'
          : writeBack
            ? `Updated: ${d.changed.join(', ')} — ready to write back to Example CRM`
            : d.changed.length
              ? `Updated: ${d.changed.join(', ')}`
              : 'Updated',
      meta: new Date(d.receivedAt).toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      }),
      tone: d.kind === 'completed' ? 'primary' : writeBack ? 'info' : 'success',
    };
  });
  return (
    <CardBody
      status={recordStatus}
      call='cdrs.onDomain({ completed, updated })'
    >
      {rows.length === 0 ? (
        <Empty
          icon='mdi:history'
          title='Nothing received yet'
          description='End a call, then save a disposition on it, to see both deliveries.'
        />
      ) : (
        <ActivityList rows={rows} />
      )}
    </CardBody>
  );
}

// ── Feeds ────────────────────────────────────────────────────────────────────

function severityTone(n: FlowNotification): Tone {
  // 'critical' is the platform's top level (security alerts, for instance).
  if (n.severity === 'critical') return 'error';
  return n.severity === 'success' ||
    n.severity === 'warning' ||
    n.severity === 'error'
    ? n.severity
    : 'info';
}

function timeOf(iso: string): string {
  const t = Date.parse(iso);
  return Number.isNaN(t)
    ? ''
    : new Date(t).toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
      });
}

export function NotificationsCard() {
  const { ui } = useFlowContext();
  const { notifications, notificationStatus } = useLive();
  const ActivityList = ui?.ActivityList;
  if (!ActivityList) return null;
  const rows: ActivityRow[] = notifications.map((n) => ({
    id: n.id,
    primary: n.title ?? n.category,
    secondary: n.body ?? undefined,
    meta: timeOf(n.createdAt),
    tone: severityTone(n),
  }));
  return (
    <CardBody
      status={notificationStatus}
      call='notifications.onNotification(update)'
    >
      {rows.length === 0 ? (
        <Empty icon='mdi:bell-outline' title='No notifications yet' />
      ) : (
        <ActivityList rows={rows} />
      )}
    </CardBody>
  );
}

export function UserChangesCard() {
  const { ui } = useFlowContext();
  const { userChanges, userStatus } = useLive();
  const ActivityList = ui?.ActivityList;
  if (!ActivityList) return null;
  const rows: ActivityRow[] = userChanges.map((u, i) => ({
    id: `${u.user}-${i}`,
    primary: u.name || u.user,
    secondary: u.doNotDisturb
      ? 'Do not disturb'
      : (u.statusMessage ??
        (u.messageWaiting ? 'Voicemail waiting' : u.presence)),
    meta: timeOf(u.updatedAt),
    tone: u.doNotDisturb ? 'warning' : u.messageWaiting ? 'info' : 'neutral',
  }));
  return (
    <CardBody status={userStatus} call='subscribers.onDomain(update)'>
      {rows.length === 0 ? (
        <Empty
          icon='mdi:account-edit'
          title='No user record changes yet'
          description='Do-not-disturb, status messages and voicemail flags show up here.'
        />
      ) : (
        <ActivityList rows={rows} />
      )}
    </CardBody>
  );
}

// ── Presence ─────────────────────────────────────────────────────────────────

function presenceTone(state: string): Tone {
  return state === 'open'
    ? 'success'
    : state === 'inactive'
      ? 'neutral'
      : 'warning';
}

export function PresenceSummaryCard() {
  const { ui } = useFlowContext();
  const { presence, presenceStatus } = useLive();
  const Donut = ui?.Donut;
  if (!Donut) return null;
  const counts = presence.reduce<Record<string, number>>((acc, p) => {
    const key = p.presence || 'unknown';
    acc[key] = (acc[key] ?? 0) + 1;
    return acc;
  }, {});
  return (
    <CardBody status={presenceStatus} call='presence.onDomain(update)'>
      {presence.length === 0 ? (
        <Empty
          icon='mdi:account-circle-outline'
          title='No presence changes yet'
          description='Change your status in the top bar to see one.'
        />
      ) : (
        <Donut
          height={200}
          centerLabel={`${presence.length} seen`}
          slices={Object.entries(counts).map(([label, value]) => ({
            label,
            value,
            tone: presenceTone(label),
          }))}
        />
      )}
    </CardBody>
  );
}

export function PresenceListCard() {
  const { ui } = useFlowContext();
  const { presence, presenceStatus } = useLive();
  const { List, ListItem, ListItemText, Avatar, Chip } = ui ?? {};
  if (!List || !ListItem || !ListItemText || !Avatar || !Chip) return null;
  return (
    <CardBody status={presenceStatus} call='presence.onDomain(update)'>
      {presence.length === 0 ? (
        <Empty
          icon='mdi:account-multiple'
          title='Nobody has changed status yet'
        />
      ) : (
        <List dense disablePadding>
          {presence.map((p) => {
            const name = `${p.firstName} ${p.lastName}`.trim() || p.user;
            return (
              <ListItem
                key={p.user}
                disableGutters
                secondaryAction={
                  <Chip
                    size='small'
                    variant='outlined'
                    label={p.presence}
                    color={chipColor(presenceTone(p.presence))}
                  />
                }
              >
                <Avatar sx={{ width: 32, height: 32, fontSize: 13, mr: 1.5 }}>
                  {initials(name)}
                </Avatar>
                <ListItemText
                  primary={name}
                  secondary={p.statusMessage ?? `Extension ${p.user}`}
                />
              </ListItem>
            );
          })}
        </List>
      )}
    </CardBody>
  );
}
