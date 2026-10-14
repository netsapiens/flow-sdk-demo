/** DemoPage tab: Overview — what the SDK does + capability cards. */
import { useFlowContext } from '@netsapiens/flow-sdk';

import { CAPABILITIES } from '../../content/demoContent';
import { accentAt } from './accents';

export default function OverviewPanel() {
  const { ui } = useFlowContext();
  const { Paper, Stack, Box, Typography, Chip } = ui || {};
  if (!Paper || !Stack || !Box || !Typography || !Chip) return null;

  return (
    <Stack spacing={3}>
      <Paper rounded>
        <Typography variant='h6' gutterBottom>
          What the Flow SDK does
        </Typography>
        <Typography variant='body2' color='text.secondary'>
          The Flow SDK lets a separately-deployed (federated) application extend
          the Flow UI without changing core platform code. It registers pages,
          injects components into existing pages by zone and route pattern, adds
          table columns, subscribes to live call events, and renders with the
          host&rsquo;s themed component kit. Everything on the other tabs is
          registered by <strong>this</strong> demo app.
        </Typography>
      </Paper>

      <Paper rounded>
        <Typography variant='h6' gutterBottom>
          Capabilities
        </Typography>
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
            gap: 2,
            mt: 2,
          }}
        >
          {CAPABILITIES.map((c, i) => (
            <Paper
              rounded
              key={c.title}
              variant='outlined'
              sx={{
                p: 3,
                bgcolor: 'background.elevation1',
                borderLeft: '4px solid',
                borderLeftColor: accentAt(i),
              }}
            >
              <Typography variant='subtitle2' fontWeight={600} gutterBottom>
                {c.title}
              </Typography>
              <Typography
                variant='body2'
                color='text.secondary'
                sx={{ mb: 1.5 }}
              >
                {c.desc}
              </Typography>
              <Chip
                label={c.api}
                size='small'
                color='primary'
                variant='outlined'
              />
            </Paper>
          ))}
        </Box>
      </Paper>
    </Stack>
  );
}
