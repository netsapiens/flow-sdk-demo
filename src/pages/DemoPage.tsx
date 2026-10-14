/**
 * Flow SDK Demo — overview & walkthrough page.
 *
 * The single explainer for this demo app: what the Flow SDK lets a federated
 * app do, the extension zones this app uses, real registration code, and a
 * guided walkthrough of where each surface appears in Flow.
 *
 * This file is just the tab shell — each tab's content lives in its own panel
 * under `demo/`, and the static content lives in `content/demoContent.ts`.
 *
 * Every visible element comes from the host kit (`flowContext.ui`), so the
 * whole page re-themes with the host light/dark toggle — kit components read the
 * host's live MUI theme, which token objects cannot. Nothing here is painted
 * from `ui.theme` / `ui.styles`. See CLAUDE.md, "Never hand-roll UI".
 */
import { useState } from 'react';
import { useFlowContext, VERSION } from '@netsapiens/flow-sdk';

import { type ZoneMarkerProps } from '../integration/withZoneTestId';
import CodePanel from './demo/CodePanel';
import OverviewPanel from './demo/OverviewPanel';
import PatternsPanel from './demo/PatternsPanel';
import RemoteAuthPanel from './demo/RemoteAuthPanel';
import WalkthroughPanel from './demo/WalkthroughPanel';
import ZonesPanel from './demo/ZonesPanel';

type TabKey =
  | 'overview'
  | 'zones'
  | 'patterns'
  | 'code'
  | 'remote-auth'
  | 'walkthrough';

/** `KitOption`-shaped, so `Tabs` and `ToggleButtonGroup` both take it as-is. */
const TABS: { value: TabKey; label: string }[] = [
  { value: 'overview', label: 'Overview' },
  { value: 'zones', label: 'Extension Zones' },
  { value: 'patterns', label: 'Route Patterns' },
  { value: 'code', label: 'Code' },
  { value: 'remote-auth', label: 'Remote Auth' },
  { value: 'walkthrough', label: 'Walkthrough' },
];

export default function DemoPage({ ...marker }: ZoneMarkerProps) {
  const { ui } = useFlowContext();
  const [activeTab, setActiveTab] = useState<TabKey>('overview');

  const PageTemplate = ui?.templates?.PageTemplate;
  const Icon = ui?.templates?.Icon;
  const { Paper, Stack, Box, Typography, Tabs } = ui || {};

  if (!PageTemplate || !Paper || !Stack || !Box || !Typography || !Tabs) {
    return (
      <div {...marker} style={{ padding: '24px' }}>
        <h1>Flow SDK Demo</h1>
        <p>UI context not available.</p>
      </div>
    );
  }

  return (
    <PageTemplate
      {...marker}
      title='Flow SDK Demo'
      subtitle='One federated app, extending Flow in every supported way'
      breadcrumbs={[
        { label: 'Apps', url: '/apps' },
        { label: 'Flow SDK Demo' },
      ]}
    >
      {/* SDK version badge — host components throughout, accent from the live palette. */}
      <Paper
        rounded
        variant='outlined'
        sx={{
          p: 2,
          mb: 3,
          borderLeft: '4px solid',
          borderLeftColor: 'success.main',
        }}
      >
        <Stack direction='row' spacing={1.5} alignItems='center'>
          {Icon ? <Icon name='mdi:package-variant-closed' size={20} /> : null}
          <Box>
            <Typography variant='subtitle2' fontWeight={600}>
              Using the published SDK
            </Typography>
            <Typography variant='caption' color='text.secondary'>
              @netsapiens/flow-sdk@{VERSION} — loaded over Module Federation
            </Typography>
          </Box>
        </Stack>
      </Paper>

      {/* The host's own pill strip (`variant='pill'` by default) — it brings its
          own elevated background, so no divider rule underneath. It owns the
          strip only; the panels below stay ours, keyed off `activeTab`. */}
      <Box sx={{ mb: 3 }}>
        <Tabs
          options={TABS}
          value={activeTab}
          onChange={(value) => setActiveTab(value as TabKey)}
        />
      </Box>

      {activeTab === 'overview' && <OverviewPanel />}
      {activeTab === 'zones' && <ZonesPanel />}
      {activeTab === 'patterns' && <PatternsPanel />}
      {activeTab === 'code' && <CodePanel />}
      {activeTab === 'remote-auth' && <RemoteAuthPanel />}
      {activeTab === 'walkthrough' && <WalkthroughPanel />}
    </PageTemplate>
  );
}
