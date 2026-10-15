/**
 * Live Operations cards. Every one is drawn from kit components: StatBlock,
 * Chart, Donut, ActivityList, Table, Avatar, Chip, List, Tooltip, and the host's
 * empty state. Data comes from LiveProvider; nothing here subscribes.
 */
import type {
  ActivityRow,
  CallActivity,
  CallRecord,
  FlowNotification,
  StreamStatus,
} from '@netsapiens/flow-sdk';
import type { ReactNode } from 'react';
import { useContext } from 'react';
import { useFlowContext } from '@netsapiens/flow-sdk';

import type { Tone } from './format';
import type { Sample } from './liveContext';
import {
  chipColor,
  CRITICAL_WAIT_SEC,
  fmtSeconds,
  initials,
  isBlocked,
  since,
  waitTone,
} from './format';
import {
  agentCounts,
  agentKey,
  missedPctOf,
  QueuePickContext,
  useLive,
  waitOf,
} from './liveContext';
import { CardBody, Empty } from './parts';

// ── Headline leaves ──────────────────────────────────────────────────────────

/** Change over the last five minutes of samples, as StatBlock wants it. */
function deltaOf(history: Sample[], key: keyof Omit<Sample, 'label'>) {
  if (history.length < 2) return undefined;
  const latest = history[history.length - 1][key];
  const before = history[Math.max(0, history.length - 31)][key];
  if (!before) return undefined;
  return { pct: ((latest - before) / before) * 100, label: 'vs 5 min ago' };
}

function Stat({
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
      spark={history.slice(-18).map((s) => s[metric])}
      delta={deltaOf(history, metric)}
    />
  );
}

export function WaitingStat() {
  const { queues, queueStatus, agents } = useLive();
  const waiting = queues.reduce((n, q) => n + q.waiting, 0);
  const { free } = agentCounts(agents);
  return (
    <Stat
      status={queueStatus}
      metric='waiting'
      value={waiting}
      caption={
        waiting === 0
          ? 'no one waiting'
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
  const { agents, agentStatus } = useLive();
  // People, not a sum of each queue's count: an agent in three queues is one.
  const { free, total } = agentCounts(agents);
  return (
    <Stat
      status={agentStatus}
      metric='agentsFree'
      value={`${free} / ${total}`}
      caption='free of agents in queues'
      tone={free > 0 ? 'success' : 'warning'}
    />
  );
}

export function CallsStat() {
  const { calls, callStatus } = useLive();
  const connected = calls.filter((c) => c.state === 'active').length;
  return (
    <Stat
      status={callStatus}
      metric='calls'
      value={calls.length}
      caption={`${connected} connected`}
      tone='primary'
    />
  );
}

export function PhonesStat() {
  const { devices, deviceStatus } = useLive();
  const registered = devices.filter((d) => d.registered).length;
  return (
    <Stat
      status={deviceStatus}
      metric='registered'
      value={registered}
      caption={`of ${devices.length} seen`}
      tone={registered === devices.length ? 'success' : 'warning'}
    />
  );
}

/**
 * Inbound outcomes since the app loaded (running totals, see liveFeeds.ts).
 * Records are domain admins only, so everyone else sees "not available".
 */
export function AnsweredStat() {
  const { outcomes, recordStatus } = useLive();
  const { answered, missed } = outcomes;
  return (
    <Stat
      status={recordStatus}
      metric='answered'
      value={answered}
      caption={`of ${answered + missed} inbound`}
      tone='primary'
    />
  );
}

export function MissedRateStat() {
  const { outcomes, recordStatus } = useLive();
  const { missed } = outcomes;
  const missedPct = missedPctOf(outcomes);
  return (
    <Stat
      status={recordStatus}
      metric='missedPct'
      value={`${missedPct.toFixed(1)}%`}
      caption={`${missed} missed`}
      tone={missedPct >= 10 ? 'error' : missedPct >= 5 ? 'warning' : 'success'}
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
  return (
    <Chart
      kind='area'
      height={220}
      data={history.map((sample) => ({ ...sample }))}
      xKey='label'
      series={[
        { key: 'calls', label: 'Calls in progress', tone: 'primary' },
        { key: 'waiting', label: 'Callers waiting', tone: 'warning' },
        { key: 'agentsFree', label: 'Agents free', tone: 'success' },
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

export function QueuesCard() {
  const { ui } = useFlowContext();
  const { queues, queueStatus, now, queueName } = useLive();
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
              <TableCell align='right'>Active</TableCell>
              <TableCell align='right'>Agents free / in</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map((q) => {
              const wait = waitOf(q, now);
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
                    <Toned tone='neutral'>{q.activeCalls}</Toned>
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
    </CardBody>
  );
}

function agentTone(status: string, activeCalls: number): Tone {
  if (activeCalls > 0) return 'primary';
  return status === 'available' ? 'success' : 'neutral';
}

export function AgentsCard() {
  const { ui } = useFlowContext();
  const { agents, agentStatus, nameOf } = useLive();
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
  return (
    <CardBody
      status={agentStatus}
      call='queues.onDomainQueues({ agentUpdated, agentAdded, agentRemoved })'
    >
      {agents.length === 0 ? (
        <Empty icon='mdi:headset' title='No agent changes yet' />
      ) : (
        <Table size='small'>
          <TableHead>
            <TableRow>
              <TableCell>Agent</TableCell>
              <TableCell>Queue</TableCell>
              <TableCell>Status</TableCell>
              <TableCell align='right'>Calls</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {agents.map((a) => (
              <TableRow key={agentKey(a)}>
                <TableCell>
                  <Stack direction='row' spacing={1} alignItems='center'>
                    <Avatar sx={{ width: 28, height: 28, fontSize: 12 }}>
                      {initials(nameOf(a.user))}
                    </Avatar>
                    <Typography variant='body2'>{nameOf(a.user)}</Typography>
                  </Stack>
                </TableCell>
                <TableCell>{a.queue}</TableCell>
                <TableCell>
                  <Chip
                    size='small'
                    variant='outlined'
                    label={a.activeCalls > 0 ? 'On a call' : a.status}
                    color={chipColor(agentTone(a.status, a.activeCalls))}
                  />
                </TableCell>
                <TableCell align='right'>{a.activeCalls}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </CardBody>
  );
}

// ── Calls ────────────────────────────────────────────────────────────────────

function party(p: CallActivity['from']): string {
  return p.name || p.user || p.number || 'Unknown';
}

function callTone(c: CallActivity): Tone {
  return c.state === 'active'
    ? 'success'
    : c.state === 'held'
      ? 'warning'
      : 'info';
}

export function CallsCard() {
  const { ui } = useFlowContext();
  const { calls, callStatus, now } = useLive();
  const { Table, TableHead, TableBody, TableRow, TableCell, Chip } = ui ?? {};
  if (!Table || !TableHead || !TableBody || !TableRow || !TableCell || !Chip)
    return null;
  return (
    <CardBody
      status={callStatus}
      call='calls.onDomainCalls({ updated, ended })'
    >
      {calls.length === 0 ? (
        <Empty icon='mdi:phone-in-talk' title='No calls in progress' />
      ) : (
        <Table size='small'>
          <TableHead>
            <TableRow>
              <TableCell>From</TableCell>
              <TableCell>To</TableCell>
              <TableCell>Via</TableCell>
              <TableCell>State</TableCell>
              <TableCell align='right'>Duration</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {calls.map((c) => (
              <TableRow key={c.callId}>
                <TableCell>{party(c.from)}</TableCell>
                <TableCell>{party(c.to)}</TableCell>
                <TableCell>
                  {c.through ? c.through.name || c.through.user : '—'}
                </TableCell>
                <TableCell>
                  <Chip
                    size='small'
                    label={c.state}
                    color={chipColor(callTone(c))}
                  />
                </TableCell>
                <TableCell align='right'>
                  {fmtSeconds(since(c.answeredAt ?? c.startedAt, now))}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
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

/**
 * Every delivery as it arrives, so a record's later updates are visible: the
 * call ends (`completed`), then the recording, call quality, summary and
 * disposition land one by one (`updated`).
 */
export function RecordDeliveriesCard() {
  const { ui } = useFlowContext();
  const { recordDeliveries, recordStatus } = useLive();
  const ActivityList = ui?.ActivityList;
  if (!ActivityList) return null;
  const rows: ActivityRow[] = recordDeliveries.map((d) => ({
    id: d.id,
    primary: `${party(d.record.from)} → ${party(d.record.to)}`,
    secondary:
      d.kind === 'completed'
        ? 'Call ended'
        : d.changed.length
          ? `Updated: ${d.changed.join(', ')}`
          : 'Updated',
    meta: new Date(d.receivedAt).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    }),
    tone: d.kind === 'completed' ? 'primary' : 'success',
  }));
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

// ── Phones ───────────────────────────────────────────────────────────────────

export function PhonesCard() {
  const { ui } = useFlowContext();
  const { devices, deviceStatus, nameOf } = useLive();
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
    <CardBody status={deviceStatus} call='devices.onDomain(update)'>
      {devices.length === 0 ? (
        <Empty
          icon='mdi:phone-classic'
          title='No registration changes yet'
          description='A phone appears here when it registers or drops off.'
        />
      ) : (
        <Table size='small'>
          <TableHead>
            <TableRow>
              <TableCell>Device</TableCell>
              <TableCell>User</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Transport</TableCell>
              <TableCell align='right'>Latency</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {devices.map((d) => (
              <TableRow key={d.device}>
                <TableCell>
                  <Tooltip title={d.userAgent || 'Unknown phone'}>
                    <Typography variant='body2'>{d.device}</Typography>
                  </Tooltip>
                </TableCell>
                <TableCell>{nameOf(d.user)}</TableCell>
                <TableCell>
                  <Chip
                    size='small'
                    variant='outlined'
                    label={d.registered ? 'Registered' : 'Not registered'}
                    color={d.registered ? 'success' : 'error'}
                  />
                </TableCell>
                <TableCell>{d.transport || '—'}</TableCell>
                <TableCell align='right'>
                  {d.latencyMs ? `${Math.round(d.latencyMs.current)} ms` : '—'}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </CardBody>
  );
}

// ── Feeds ────────────────────────────────────────────────────────────────────

function severityTone(n: FlowNotification): Tone {
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
