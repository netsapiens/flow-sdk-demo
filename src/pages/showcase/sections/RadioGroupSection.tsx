/** Showcase section: RadioGroup (pre-built). */
import { useState } from 'react';
import { useFlowContext, useLocale } from '@netsapiens/flow-sdk';

import { SectionCode } from '../SectionCode';

export default function RadioGroupSection() {
  const { ui } = useFlowContext();
  // Host keys where the platform has one. "Important only" has none, so it
  // stays English — borrowing a near-miss key would change what it says.
  const { t } = useLocale();
  const { RadioGroup, Typography, Stack, Paper } = ui || {};
  const [radioGroupValue, setRadioGroupValue] = useState('all');
  if (!Paper || !Typography || !Stack || !RadioGroup) return null;

  return (
    <Paper rounded>
      <Typography variant='h5' gutterBottom>
        RadioGroup
      </Typography>
      <Typography variant='body2' color='text.secondary' sx={{ mb: 3 }}>
        Pre-built radio button group
      </Typography>

      <RadioGroup
        label={t?.('PREFERENCES') ?? 'Preferences'}
        value={radioGroupValue}
        onChange={(e) => setRadioGroupValue(e.target.value)}
        options={[
          {
            value: 'all',
            label: t?.('ALL_NOTIFICATIONS') ?? 'All notifications',
          },
          { value: 'important', label: 'Important only' },
          { value: 'none', label: t?.('NONE') ?? 'None' },
        ]}
      />

      <SectionCode>
        {`const { RadioGroup } = flowContext.ui;
const [radioGroupValue, setRadioGroupValue] = useState('all');

<RadioGroup
  label="Preference"
  value={radioGroupValue}
  onChange={(e) => setRadioGroupValue(e.target.value)}
  options={[
    { value: 'all', label: 'All notifications' },
    { value: 'important', label: 'Important only' },
    { value: 'none', label: 'None' }
  ]}
/>`}
      </SectionCode>

      <Typography
        variant='caption'
        color='text.secondary'
        sx={{ mt: 2, display: 'block' }}
      >
        💡 Used in: Settings panels, configuration forms (e.g., notification
        preferences, call routing options)
      </Typography>
    </Paper>
  );
}
