/**
 * Compliance Checkbox Extension
 * Zone: `form-section-after` — injected below the contact form's fields.
 * Adds consent / marketing opt-in checkboxes to the contact form.
 */
import { useState } from 'react';
import { type ExtensionComponentProps } from '@netsapiens/flow-sdk';

import { type ZoneMarkerProps } from '../integration/withZoneTestId';

export default function ComplianceCheckbox({
  context,
  ...marker
}: ExtensionComponentProps & ZoneMarkerProps) {
  const { Stack, FormControlLabel, Checkbox, Typography, Paper, Alert } =
    context.ui ?? {};

  const [consented, setConsented] = useState(false);
  const [marketingConsent, setMarketingConsent] = useState(false);

  // The choices stay in this component. Nothing in the host reads them: an
  // extension cannot write into a host form's data today, so this demonstrates
  // a form-section zone, not a form contribution. (It used to emit
  // `form-data:updated` on the event bus, which no host listener received.)

  if (
    !Stack ||
    !FormControlLabel ||
    !Checkbox ||
    !Typography ||
    !Paper ||
    !Alert
  )
    return null;

  // Checkbox aligned to the top of multi-line labels.
  const checkboxRowSx = { alignItems: 'flex-start', m: 0 } as const;
  const checkboxSx = { pt: 0, mr: 1 } as const;

  return (
    <Paper {...marker} sx={{ width: '100%' }}>
      <Stack spacing={2}>
        <Stack spacing={0.5}>
          <Typography variant='subtitle1' fontWeight={600}>
            Data Privacy &amp; Consent
          </Typography>
          <Typography variant='body2' color='text.secondary'>
            Confirm you have the required consent before storing this
            contact&rsquo;s information.
          </Typography>
        </Stack>

        <FormControlLabel
          sx={checkboxRowSx}
          control={
            <Checkbox
              size='small'
              sx={checkboxSx}
              checked={consented}
              onChange={(e) => setConsented(e.target.checked)}
            />
          }
          label={
            <Typography variant='body2'>
              I have obtained consent to store this contact&rsquo;s personal
              information.
            </Typography>
          }
        />

        <FormControlLabel
          sx={checkboxRowSx}
          control={
            <Checkbox
              size='small'
              sx={checkboxSx}
              checked={marketingConsent}
              onChange={(e) => setMarketingConsent(e.target.checked)}
            />
          }
          label={
            <Typography variant='body2'>
              This contact has consented to receive marketing communications.
            </Typography>
          }
        />

        {consented && (
          <Alert severity='success' variant='outlined'>
            Consent recorded — this will be added to the audit trail.
          </Alert>
        )}
      </Stack>
    </Paper>
  );
}
