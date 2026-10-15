/**
 * The opening panel of the Component Showcase.
 *
 * Everything below it is a component. This is the part that explains why there
 * is a component kit at all, which is the question a partner developer actually
 * arrives with: they already have a component library, so what does taking ours
 * buy them?
 */
import { useFlowContext } from '@netsapiens/flow-sdk';

import { useShowCode } from '../ShowCode';

const POINTS: Array<{ icon: string; title: string; body: string }> = [
  {
    icon: 'mdi:palette-outline',
    title: 'It is the tenant theme, not a copy of it',
    body: 'Components arrive already wired to the running theme, so a reseller who rebrands Flow rebrands your app at the same moment. Nothing to re-skin, nothing to keep in sync.',
  },
  {
    icon: 'mdi:weather-night',
    title: 'Light and dark follow for free',
    body: 'Colours resolve at render from palette paths. Your app follows the toggle without subscribing to anything or re-reading a token.',
  },
  {
    icon: 'mdi:package-variant-closed',
    title: 'No MUI in your bundle',
    body: 'The kit is handed over at runtime by the host, which already loaded it. Your remote ships your code and nothing else.',
  },
  {
    icon: 'mdi:human-cane',
    title: 'Accessibility comes with the component',
    body: 'Focus rings, ARIA wiring, keyboard activation and hit targets are handled for you. You inherit the fixes as we make them.',
  },
];

export default function IntroSection() {
  const { ui } = useFlowContext();
  const { Typography, Paper, Box, Stack, Divider, Icon, Chip, Code } = ui || {};
  const showCode = useShowCode();
  if (!Paper || !Typography || !Box || !Stack) return null;

  return (
    <Paper rounded>
      <Stack direction='row' spacing={1} alignItems='center' sx={{ mb: 1 }}>
        <Typography variant='h4'>The Flow component kit</Typography>
        {Chip ? (
          <Chip size='small' color='primary' label='flowContext.ui' />
        ) : null}
      </Stack>
      <Typography variant='body1' color='text.secondary' sx={{ mb: 3 }}>
        Your app runs inside Flow as a Module Federation remote. Rather than
        asking you to match our look, the host hands your app the very
        components it renders itself. Build from these and your feature is
        indistinguishable from a native page — in every tenant&rsquo;s branding,
        in both colour modes, on day one.
      </Typography>

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
          gap: 2.5,
          mb: 3,
        }}
      >
        {POINTS.map((p) => (
          <Stack key={p.title} direction='row' spacing={1.5}>
            {Icon ? (
              <Icon
                icon={p.icon}
                sx={{ fontSize: 22, color: 'primary.main', mt: 0.25 }}
              />
            ) : null}
            <Stack direction='column' spacing={0.5}>
              <Typography variant='subtitle2'>{p.title}</Typography>
              <Typography variant='body2' color='text.secondary'>
                {p.body}
              </Typography>
            </Stack>
          </Stack>
        ))}
      </Box>

      {showCode ? (
        <>
          {Divider && <Divider sx={{ my: 3 }} />}
          <Typography variant='subtitle1' gutterBottom>
            The whole API
          </Typography>
          <Typography variant='body2' color='text.secondary' sx={{ mb: 2 }}>
            One hook, one destructure, one guard. The guard matters: your app
            may be mounted by a host that predates a component, so treat every
            one as optional and render a fallback rather than crashing the page.
          </Typography>
          {Code ? (
            <Code>
              {`import { useFlowContext } from '@netsapiens/flow-sdk';

function MyPanel() {
  const { ui, theme, t } = useFlowContext();
  const { Paper, Typography, Button } = ui || {};

  // Always guard — an older host may not have every component yet.
  if (!Paper || !Typography || !Button) return null;

  return (
    <Paper>
      {/* Colours are palette PATHS the host resolves at render,
          which is what makes the dark/light toggle work. */}
      <Typography variant="h6" color="text.primary">{t('title')}</Typography>
      <Button variant="contained" onClick={run}>Sync now</Button>
    </Paper>
  );
}`}
            </Code>
          ) : null}
        </>
      ) : null}

      <Typography
        variant='caption'
        color='text.secondary'
        sx={{ mt: 2, display: 'block' }}
      >
        💡 The one rule worth memorising: pass colours as palette paths
        (&lsquo;text.secondary&rsquo;, &lsquo;primary.main&rsquo;,
        &lsquo;divider&rsquo;), never as hex and never read out of a theme
        object you captured earlier. A captured token is a snapshot of whichever
        mode was active when your app loaded, and it stops following the toggle.
      </Typography>
    </Paper>
  );
}
