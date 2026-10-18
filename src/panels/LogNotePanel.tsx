/**
 * Log note — side-panel content opened from a row of the Live call console
 * (`widgets/LiveCallsWidget.tsx`).
 *
 * The console's per-call action, and the half of a CRM integration a host can
 * never offer: writing something BACK to the partner's system while the call
 * is still live. The panel shows what Example CRM knows about the caller (tier,
 * open deal, last contact, the account's own notes), takes a note, and "saves"
 * it — a mock write-back that logs the request a real integration would make,
 * the same way `services/callEnrichment.ts` logs its lookup. A caller the CRM
 * does not know gets a lead instead of an activity.
 *
 * Opened through the host's side panel (`useSidePanel(context).open`), so it
 * receives `{ context, close }` like every panel body, plus the call the row
 * closed over.
 */
import type { SidePanelContentProps } from '@netsapiens/flow-sdk';
import { useState } from 'react';

import type { CallerInfo } from '../services/callEnrichment';
import { formatDealValue } from '../mocks/crm';

const VENDOR_NAME = 'Example CRM';
const VENDOR_CRM_BASE_URL = 'https://app.example-crm.example';

interface LogNotePanelProps extends SidePanelContentProps {
  call: CallerInfo;
}

/** The other party's number: the side of the call that is not the user's. */
const partyOf = (call: CallerInfo) =>
  call.direction === 'inbound' ? call.from : call.to;

/**
 * The write-back. In production this is an authenticated POST to the vendor
 * CRM with the token `auth.requestRemoteAuth` brokered; here it is logged, and
 * resolves as if the CRM accepted it.
 */
function writeBack(call: CallerInfo, note: string): void {
  const known = Boolean(call.company);
  const url = `${VENDOR_CRM_BASE_URL}/api/${known ? 'activities' : 'leads'}`;
  const body = known
    ? { type: 'call-note', phone: partyOf(call), callId: call.callId, note }
    : { source: 'Flow call', phone: partyOf(call), callId: call.callId, note };
  console.groupCollapsed(
    `[${VENDOR_NAME}] ${known ? 'Call note' : 'New lead'} for ${partyOf(call)}`,
  );
  console.info('→ POST', url, body);
  console.info('← 201 Created (mock)');
  console.groupEnd();
}

export function LogNotePanel({ context, close, call }: LogNotePanelProps) {
  const { Alert, Button, Chip, Divider, Stack, TextField, Typography } =
    context.ui ?? {};
  const [note, setNote] = useState('');
  const [saved, setSaved] = useState(false);
  if (!Stack || !Typography || !TextField || !Button) return null;

  const known = Boolean(call.company);
  const facts: [string, string][] = known
    ? [
        ['Contact', call.callerName ?? '—'],
        ['Number', partyOf(call)],
        ['Last contact', call.lastContact ?? '—'],
        ['Calls on record', String(call.callCount ?? 0)],
      ]
    : [['Number', partyOf(call)]];

  return (
    <Stack spacing={2}>
      {known ? (
        <Stack spacing={1}>
          <Typography variant='subtitle1' fontWeight={600}>
            {call.company}
          </Typography>
          {Chip && (call.tier === 'vip' || call.opportunity) ? (
            <Stack direction='row' spacing={0.5} flexWrap='wrap' useFlexGap>
              {call.tier === 'vip' ? (
                <Chip size='small' color='warning' label='VIP' />
              ) : null}
              {call.opportunity ? (
                <Chip
                  size='small'
                  variant='outlined'
                  color='primary'
                  label={`${call.opportunity.name} · ${formatDealValue(call.opportunity.value)} · ${call.opportunity.stage}`}
                />
              ) : null}
            </Stack>
          ) : null}
          {call.notes ? (
            <Typography variant='body2' color='text.secondary'>
              {call.notes}
            </Typography>
          ) : null}
        </Stack>
      ) : Alert ? (
        <Alert severity='info'>
          {VENDOR_NAME} has no record for this caller. Saving creates a lead
          with this note on it.
        </Alert>
      ) : null}

      <Stack spacing={1}>
        {facts.map(([label, value]) => (
          <Stack
            key={label}
            direction='row'
            justifyContent='space-between'
            spacing={2}
          >
            <Typography variant='body2' color='text.secondary'>
              {label}
            </Typography>
            <Typography variant='body2' fontWeight={600}>
              {value}
            </Typography>
          </Stack>
        ))}
      </Stack>

      {Divider ? <Divider /> : null}

      <TextField
        label='Note'
        fullWidth
        multiline
        minRows={4}
        value={note}
        disabled={saved}
        onChange={(e) => setNote(e.target.value.slice(0, 2000))}
      />

      {saved && Alert ? (
        <Alert severity='success'>
          {known
            ? `Written to ${call.company} in ${VENDOR_NAME} (mock — the request is in the browser console).`
            : `Lead created in ${VENDOR_NAME} (mock — the request is in the browser console).`}
        </Alert>
      ) : null}

      <Stack direction='row' spacing={1} justifyContent='flex-end'>
        <Button variant='text' onClick={close}>
          {saved
            ? (context.t?.('CLOSE') ?? 'Close')
            : (context.t?.('CANCEL') ?? 'Cancel')}
        </Button>
        {saved ? null : (
          <Button
            variant='contained'
            disabled={!note.trim()}
            onClick={() => {
              writeBack(call, note.trim());
              setSaved(true);
            }}
          >
            {known ? 'Save to CRM' : 'Create lead'}
          </Button>
        )}
      </Stack>
    </Stack>
  );
}

export default LogNotePanel;
