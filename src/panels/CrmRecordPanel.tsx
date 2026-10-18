/**
 * One user's (mock) CRM record, opened in the host's side panel from the CRM
 * Sync page. The panel renders outside the page's FlowContextProvider, so it
 * draws from the `context` the host hands it, never from a prop-drilled `ui`.
 *
 * The page passes the row and the link toggle in through a closure; the panel
 * itself holds no state. Toggling closes it, so it never shows a stale row.
 */
import type { SidePanelContentProps } from '@netsapiens/flow-sdk';

import type { CrmRecord } from '../mocks/crm';

export interface CrmPanelRow {
  displayName: string;
  extension: string;
  /** Present when the user is linked to a CRM account. */
  record?: CrmRecord;
}

interface CrmRecordPanelProps extends SidePanelContentProps {
  row: CrmPanelRow;
  onToggleLink: () => void;
}

export function CrmRecordPanel({
  context,
  close,
  row,
  onToggleLink,
}: CrmRecordPanelProps) {
  const { Stack, Typography, Chip, Button, Divider, Alert } = context.ui ?? {};
  if (!Stack || !Typography || !Button) return null;

  const linked = Boolean(row.record);

  return (
    <Stack spacing={2} sx={{ p: 2 }}>
      <Stack spacing={0.5}>
        <Typography variant='h6'>{row.displayName}</Typography>
        <Typography variant='body2' color='text.secondary'>
          Extension {row.extension}
        </Typography>
      </Stack>

      {Divider ? <Divider /> : null}

      {row.record ? (
        <Stack spacing={1}>
          <Stack direction='row' spacing={1} alignItems='center'>
            <Typography variant='subtitle2'>CRM account</Typography>
            {Chip ? (
              <Chip size='small' color='primary' label={row.record.company} />
            ) : (
              <Typography variant='body2'>{row.record.company}</Typography>
            )}
          </Stack>
          <Typography variant='body2'>
            Last contact: {row.record.lastContact} · {row.record.callCount}{' '}
            calls
          </Typography>
          {row.record.notes ? (
            <Typography variant='body2' color='text.secondary'>
              {row.record.notes}
            </Typography>
          ) : null}
        </Stack>
      ) : Alert ? (
        <Alert severity='info'>Not linked to a CRM account.</Alert>
      ) : (
        <Typography variant='body2'>Not linked to a CRM account.</Typography>
      )}

      <Stack direction='row' spacing={1}>
        <Button
          variant={linked ? 'outlined' : 'contained'}
          color={linked ? 'error' : 'primary'}
          onClick={() => {
            onToggleLink();
            close();
          }}
        >
          {linked ? 'Unlink' : 'Link to CRM'}
        </Button>
        <Button variant='text' onClick={close}>
          Close
        </Button>
      </Stack>

      <Typography variant='caption' color='text.secondary'>
        Example data: linking is kept on this page only and resets when you
        change domain.
      </Typography>
    </Stack>
  );
}
