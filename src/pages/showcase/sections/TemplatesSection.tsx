/** Showcase section: the page- and panel-level templates. */
import { useFlowContext, useLocale } from '@netsapiens/flow-sdk';

import { SectionCode } from '../SectionCode';

const TEMPLATES: Array<{ name: string; what: string; where: string }> = [
  {
    name: 'PageTemplate',
    what: 'Title, subtitle, breadcrumbs, header actions.',
    where: 'This page, and every full-page route the demo registers.',
  },
  {
    name: 'PageTemplateWithExtensions',
    what: 'The same, plus the host zones so OTHER apps can extend your page.',
    where: 'A page you want to be extensible in turn.',
  },
  {
    name: 'DashboardTemplate',
    what: 'A dashboard page you own: the host grid and card frames, minus reorder and customize.',
    where: 'Apps → Example CRM.',
  },
  {
    name: 'DatagridTemplate',
    what: 'Search, filter, sort, CSV export, column show/hide, pagination.',
    where: 'My Account → Recording QA Review.',
  },
  {
    name: 'FormTemplate / FormPanel',
    what: 'A themed form shell, and its multi-step drawer variant.',
    where: 'Add/edit flows.',
  },
  {
    name: 'SidePanel',
    what: "Flow's shared right-hand drawer, opened from anywhere.",
    where: 'The Help button in the top bar.',
  },
  {
    name: 'CarouselTemplate',
    what: 'A slide deck with auto-advance or manual control.',
    where: 'Below.',
  },
];

export default function TemplatesSection() {
  const { ui } = useFlowContext();
  // Host keys for the shared vocabulary: these follow the language switch,
  // and a string hard-coded here would be English forever.
  const { t } = useLocale();
  const { Typography, Stack, Paper, Box, Chip } = ui || {};
  if (!Paper || !Typography || !Stack || !Box) return null;

  return (
    <Paper rounded>
      <Typography variant='h5' gutterBottom>
        {t?.('TEMPLATES') ?? 'Templates'}
      </Typography>
      <Typography variant='body2' color='text.secondary' sx={{ mb: 3 }}>
        Whole page and panel shells, on <code>ui.templates</code>. A template is
        the fastest way to a page that looks native, because the layout is the
        host&rsquo;s and only the content is yours.
      </Typography>

      <Stack direction='column' spacing={1.5}>
        {TEMPLATES.map((t) => (
          <Box
            key={t.name}
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', md: '210px 1fr' },
              gap: { xs: 0.5, md: 2 },
              alignItems: 'baseline',
              borderLeft: '2px solid',
              borderColor: 'divider',
              pl: 2,
            }}
          >
            <Typography variant='subtitle2' sx={{ fontFamily: 'monospace' }}>
              {t.name}
            </Typography>
            <Stack direction='column' spacing={0.25}>
              <Typography variant='body2'>{t.what}</Typography>
              <Stack direction='row' spacing={1} alignItems='center'>
                {Chip ? (
                  <Chip size='small' variant='outlined' label='Live' />
                ) : null}
                <Typography variant='caption' color='text.secondary'>
                  {t.where}
                </Typography>
              </Stack>
            </Stack>
          </Box>
        ))}
      </Stack>

      <SectionCode>
        {`const { PageTemplate, DashboardTemplate } = flowContext.ui.templates;

// A normal page
<PageTemplate title="Example CRM" subtitle="…" breadcrumbs={[…]}>
  {children}
</PageTemplate>

// A dashboard page you own end to end
<DashboardTemplate
  title="Acme Insights"
  rangeControl                       // the host's pre-canned time windows
  widgets={[
    { id: 'volume', title: 'Call volume', size: 'full', height: 4,
      refreshPolicy: 'shared-range', component: VolumeChart },
  ]}
/>`}
      </SectionCode>

      <Typography
        variant='caption'
        color='text.secondary'
        sx={{ mt: 2, display: 'block' }}
      >
        💡 <code>DashboardTemplate</code> is the counterpart to{' '}
        <code>sdk.registerWidget</code>: that contributes a card to one of{' '}
        <em>our</em> dashboards, where the user places it. This gives you a
        whole dashboard page of your own, in the order you chose.
      </Typography>
    </Paper>
  );
}
