/** Showcase section: Tabs (the host's pill strip + the standard bar). */
import { useState } from 'react';
import { useFlowContext } from '@netsapiens/flow-sdk';

import { SectionCode } from '../SectionCode';

const PANEL_TABS = [
  { value: 'overview', label: 'Overview', icon: 'mdi:view-dashboard' },
  { value: 'activity', label: 'Activity', icon: 'mdi:pulse' },
  { value: 'settings', label: 'Settings', icon: 'mdi:cog' },
  { value: 'archived', label: 'Archived', disabled: true },
];

const PANEL_BODY: Record<string, string> = {
  overview: 'The Overview panel. Tabs owns the strip; this body is ours.',
  activity:
    'The Activity panel — switching tabs swapped this text, nothing else.',
  settings:
    'The Settings panel. Panels are keyed off the value you hold in state.',
};

const PLAIN_TABS = [
  { value: 'all', label: 'All' },
  { value: 'active', label: 'Active' },
  { value: 'suspended', label: 'Suspended' },
];

export default function TabsSection() {
  const { ui } = useFlowContext();
  const { Tabs, Box, Typography, Stack, Paper } = ui || {};
  const [panelTab, setPanelTab] = useState<string | number>('overview');
  const [pillTab, setPillTab] = useState<string | number>('all');
  const [standardTab, setStandardTab] = useState<string | number>('all');
  if (!Paper || !Typography || !Stack || !Box || !Tabs) return null;

  return (
    <Paper rounded>
      <Typography variant='h5' gutterBottom>
        Tabs
      </Typography>
      <Typography variant='body2' color='text.secondary' sx={{ mb: 3 }}>
        The host&apos;s own tabbed-page treatment. It owns the strip only — you
        render the panels, keyed off the value you hold in state.
      </Typography>

      <Stack spacing={3}>
        <Box>
          <Typography variant='subtitle2' gutterBottom>
            With panels (icons + a disabled option)
          </Typography>
          <Tabs options={PANEL_TABS} value={panelTab} onChange={setPanelTab} />
          <Paper rounded variant='outlined' sx={{ p: 2, mt: 2 }}>
            <Typography variant='body2'>
              {PANEL_BODY[panelTab] ?? ''}
            </Typography>
          </Paper>
        </Box>

        <Box>
          <Typography variant='subtitle2' gutterBottom>
            Pill (default) — the Aurora treatment used across the host&apos;s
            own pages
          </Typography>
          <Tabs options={PLAIN_TABS} value={pillTab} onChange={setPillTab} />
        </Box>

        <Box>
          <Typography variant='subtitle2' gutterBottom>
            Pill, <code>fullWidth</code> — stretches to fill the strip
          </Typography>
          <Tabs
            options={PLAIN_TABS}
            value={pillTab}
            onChange={setPillTab}
            fullWidth
          />
        </Box>

        <Box>
          <Typography variant='subtitle2' gutterBottom>
            Standard — MUI&apos;s underlined bar, for the rare page that wants
            it
          </Typography>
          <Tabs
            options={PLAIN_TABS}
            value={standardTab}
            onChange={setStandardTab}
            variant='standard'
          />
        </Box>
      </Stack>

      <SectionCode>
        {`const { Tabs } = flowContext.ui;

// Options-based, like Select and ToggleButtonGroup — the kit does not expose
// the <Tab> children MUI would want. \`onChange\` receives the new value
// DIRECTLY, not MUI's (event, value), so a plain setter is enough.
const OPTIONS = [
  { value: 'overview', label: 'Overview', icon: 'mdi:view-dashboard' },
  { value: 'activity', label: 'Activity', icon: 'mdi:pulse' },
  { value: 'archived', label: 'Archived', disabled: true },
];

function MyPage() {
  const [tab, setTab] = useState('overview');

  return (
    <>
      <Tabs options={OPTIONS} value={tab} onChange={setTab} />
      {/* Tabs owns the strip only — the panels stay yours. There is
          deliberately no TabPanel contract, because apps differ on whether a
          panel stays mounted or unmounts to reset its state. */}
      {tab === 'overview' && <OverviewPanel />}
      {tab === 'activity' && <ActivityPanel />}
    </>
  );
}

// variant="pill" (default) is the host treatment; "standard" is the underlined
// bar. fullWidth stretches the pills, and is only meaningful for pill.
<Tabs options={OPTIONS} value={tab} onChange={setTab} variant="standard" />`}
      </SectionCode>

      <Typography
        variant='caption'
        color='text.secondary'
        sx={{ mt: 2, display: 'block' }}
      >
        💡 Used in: any page that splits into sections — Account Profile, user
        details, and the Flow SDK Demo page&apos;s own six tabs
      </Typography>

      <Typography
        variant='caption'
        color='info.main'
        sx={{ mt: 2, display: 'block' }}
      >
        🎨 <strong>Why not a hand-rolled strip:</strong> a row of styled{' '}
        <code>&lt;button&gt;</code>s colored from <code>ui.theme.colors</code>{' '}
        looks right until the user toggles dark mode — those tokens are a
        snapshot, so the strip keeps its old colors. <code>Tabs</code> paints
        its selected pill from the live theme and follows the toggle for free.
      </Typography>
    </Paper>
  );
}
