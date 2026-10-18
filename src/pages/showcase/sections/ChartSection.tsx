/** Showcase section: Chart — line, area and bar, drawn by the host. */
import { useFlowContext, useLocale } from '@netsapiens/flow-sdk';

import { SectionCode } from '../SectionCode';

/** One week of call outcomes. Keys match the `series` declared below. */
const DATA = [
  { day: 'Mon', answered: 42, missed: 6 },
  { day: 'Tue', answered: 51, missed: 4 },
  { day: 'Wed', answered: 38, missed: 9 },
  { day: 'Thu', answered: 64, missed: 5 },
  { day: 'Fri', answered: 58, missed: 11 },
  { day: 'Sat', answered: 21, missed: 3 },
  { day: 'Sun', answered: 17, missed: 2 },
];

const KINDS = [
  { kind: 'line' as const, label: 'line', note: 'Trends over time' },
  { kind: 'area' as const, label: 'area', note: 'A trend with volume' },
  { kind: 'bar' as const, label: 'bar', note: 'Discrete buckets' },
];

export default function ChartSection() {
  const { ui } = useFlowContext();
  // Series labels are what the host prints in the legend and tooltip, so they
  // are host strings. The day names on the axis are sample data and stay as is.
  const { t } = useLocale();
  const { Chart, Typography, Stack, Paper, Box, Chip } = ui || {};
  if (!Paper || !Typography || !Stack || !Chart || !Box) return null;

  return (
    <Paper rounded>
      <Typography variant='h5' gutterBottom>
        Chart
      </Typography>
      <Typography variant='body2' color='text.secondary' sx={{ mb: 3 }}>
        The host renders it. You pass a kind, the rows, and which keys are
        series — no charting library enters your bundle.
      </Typography>

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: 3,
        }}
      >
        {KINDS.map(({ kind, label, note }) => (
          <Stack key={kind} direction='column' spacing={1}>
            <Stack direction='row' spacing={1} alignItems='center'>
              {Chip ? <Chip size='small' label={label} /> : null}
              <Typography variant='caption' color='text.secondary'>
                {note}
              </Typography>
            </Stack>
            <Chart
              kind={kind}
              height={200}
              data={DATA}
              xKey='day'
              stacked={kind === 'bar'}
              series={[
                {
                  key: 'answered',
                  label: t?.('ANSWERED') ?? 'Answered',
                  tone: 'success',
                },
                {
                  key: 'missed',
                  label: t?.('MISSED') ?? 'Missed',
                  tone: 'error',
                },
              ]}
            />
          </Stack>
        ))}
      </Box>

      <SectionCode>
        {`const { Chart } = flowContext.ui;

<Chart
  kind="bar"          // 'line' | 'area' | 'bar'
  stacked             // bars stack; areas stack their fills
  data={rows}         // one object per x position
  xKey="day"          // which key is the axis label
  series={[
    { key: 'answered', label: 'Answered', tone: 'success' },
    { key: 'missed',   label: 'Missed',   tone: 'error' },
  ]}
/>`}
      </SectionCode>

      <Typography
        variant='caption'
        color='text.secondary'
        sx={{ mt: 2, display: 'block' }}
      >
        💡 Colour is a semantic <strong>tone</strong>, never a hex — you say
        what a series <em>means</em> and the host picks the colour, so it
        follows the light/dark toggle with nothing to update. The kinds are
        limited to what the native dashboards draw, so a contributed chart
        cannot look like nothing else on the page.
      </Typography>
    </Paper>
  );
}
