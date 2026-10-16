/**
 * The Notifications tab: send one with `sdk.sendNotification()`, and watch it
 * come back on `sdk.streams.notifications`. The round trip in one place.
 *
 * `sdk.sendNotification({ … })` is written as a plain call on purpose: the
 * platform grants the notifications capability from the `sendNotification(`
 * call it finds in the bundle when a version is submitted, the way stream
 * grants are found. Behind a helper or a computed name it would not be found.
 *
 * Kit components only; colours are palette paths and Chip tones.
 */
import type { AppNotification, FlowNotification } from '@netsapiens/flow-sdk';
import { useState } from 'react';
import { useFlowContext } from '@netsapiens/flow-sdk';

import type { Tone } from './format';
import { chipColor } from './format';
import { useLive } from './liveContext';
import { CardBody, Empty } from './parts';

type Severity = NonNullable<AppNotification['severity']>;

const SEVERITIES: { value: Severity; label: string }[] = [
  { value: 'info', label: 'Info' },
  { value: 'success', label: 'Success' },
  { value: 'warning', label: 'Warning' },
  { value: 'error', label: 'Error' },
];

/** Where the notification links to by default: this page. */
const DEFAULT_LINK = '/apps/live-operations';

export function SendNotificationCard() {
  const { ui } = useFlowContext();
  const { sdk } = useLive();
  const [title, setTitle] = useState('Live Operations test');
  const [body, setBody] = useState('');
  const [severity, setSeverity] = useState<Severity>('info');
  const [link, setLink] = useState(DEFAULT_LINK);
  const [id, setId] = useState('');
  const [sentAt, setSentAt] = useState<string | null>(null);

  const { Alert, Button, Select, Stack, TextField, Typography } = ui ?? {};
  if (!Alert || !Button || !Select || !Stack || !TextField || !Typography)
    return null;

  const trimmed = title.trim();
  const send = () => {
    // A plain call, so the bundle scan finds `sendNotification(`.
    sdk.sendNotification({
      title: trimmed,
      body: body.trim() || undefined,
      severity,
      link: link.trim() || undefined,
      id: id.trim() || undefined,
    });
    setSentAt(new Date().toLocaleTimeString());
  };

  return (
    <Stack spacing={1.5}>
      <Typography variant='body2' color='text.secondary'>
        Raises a real Flow notification for you. It shows in the notification
        center and arrives in the list beside this one.
      </Typography>
      <TextField
        label='Title'
        required
        fullWidth
        value={title}
        onChange={(e) => setTitle(e.target.value.slice(0, 120))}
      />
      <TextField
        label='Body (optional)'
        fullWidth
        value={body}
        onChange={(e) => setBody(e.target.value.slice(0, 1000))}
      />
      <Select
        label='Severity'
        value={severity}
        options={SEVERITIES}
        onChange={(e: { target: { value: unknown } }) =>
          setSeverity(String(e.target.value) as Severity)
        }
      />
      <TextField
        label='Link (a path inside Flow)'
        fullWidth
        value={link}
        onChange={(e) => setLink(e.target.value)}
      />
      <TextField
        label='Id (optional: the same id again raises nothing new)'
        fullWidth
        value={id}
        onChange={(e) => setId(e.target.value)}
      />
      <Stack direction='row' spacing={1} alignItems='center'>
        <Button variant='contained' disabled={!trimmed} onClick={send}>
          Send notification
        </Button>
      </Stack>
      {sentAt ? (
        <Alert severity='info'>
          Sent at {sentAt}. Sending is fire-and-forget: if it is refused (the
          capability switched off, or a server without app notifications), the
          browser console says why and nothing arrives.
        </Alert>
      ) : null}
    </Stack>
  );
}

function severityTone(s: FlowNotification['severity']): Tone {
  if (s === 'critical') return 'error';
  return s === 'success' || s === 'warning' || s === 'error' ? s : 'info';
}

/** The link an app notification carries, if the platform passes it through. */
function linkOf(n: FlowNotification): string {
  const link = n.payload?.['link'];
  return typeof link === 'string' ? link : '—';
}

export function ReceivedNotificationsCard() {
  const { ui } = useFlowContext();
  const { notifications, notificationStatus } = useLive();
  const { Chip, Table, TableBody, TableCell, TableHead, TableRow } = ui ?? {};
  if (!Chip || !Table || !TableBody || !TableCell || !TableHead || !TableRow)
    return null;

  return (
    <CardBody
      status={notificationStatus}
      call='notifications.onNotification(update)'
    >
      {notifications.length === 0 ? (
        <Empty
          icon='mdi:bell-outline'
          title='Nothing received yet'
          description='Send one, and it arrives here from sdk.streams.notifications.'
        />
      ) : (
        <Table size='small'>
          <TableHead>
            <TableRow>
              <TableCell>Time</TableCell>
              <TableCell>Category</TableCell>
              <TableCell>Severity</TableCell>
              <TableCell>Title</TableCell>
              <TableCell>Link</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {notifications.map((n) => (
              <TableRow key={n.id}>
                <TableCell>
                  {new Date(n.createdAt).toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit',
                  })}
                </TableCell>
                <TableCell>{n.category}</TableCell>
                <TableCell>
                  <Chip
                    size='small'
                    label={n.severity}
                    color={chipColor(severityTone(n.severity))}
                  />
                </TableCell>
                <TableCell>{n.title ?? '—'}</TableCell>
                <TableCell>{linkOf(n)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </CardBody>
  );
}
