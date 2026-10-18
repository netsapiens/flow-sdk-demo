/**
 * Call analysis, opened in the host's side panel by the "Analyze calls" header
 * action on Call Logs. It works on the rows the page published — the user's
 * selection when there is one, otherwise every row the grid holds — so it
 * makes no API call of its own.
 *
 * It goes past the summary the `page-content-after` widget already shows under
 * the table: calls per hour, how they split by direction, and the longest ones.
 *
 * Renders outside the page's FlowContextProvider, so it draws from the
 * `context` the host hands it. Kit components only; colours are tones.
 */
import type { SidePanelContentProps } from '@netsapiens/flow-sdk';

/** The call-log fields this panel reads. */
export interface CdrRow {
  id?: string;
  'call-direction'?: number; // 1 inbound, 0 outbound, 2 missed, 3 inter-company, -1 not routed
  'call-start-datetime'?: string;
  'call-total-duration-seconds'?: number;
  'call-talking-duration-seconds'?: number;
  'call-orig-from-name'?: string;
  'call-orig-from-user'?: string;
  'call-orig-from-uri'?: string;
  'call-term-to-name'?: string;
  'call-term-user'?: string;
  'call-orig-to-user'?: string;
}

/**
 * The grid's timestamps read `2026-10-17T20:06:46Z[America/Los_Angeles]`: wall
 * time in the named zone, despite the `Z`. `new Date()` rejects that form, so
 * drop the suffix and read the rest as local time, which is what the grid shows.
 */
function startHour(value: string | undefined): number | null {
  if (!value) return null;
  const hour = new Date(value.replace(/Z?\[.+\]$/, '')).getHours();
  return Number.isNaN(hour) ? null : hour;
}

/** The caller as the grid shows it: name, else the user or number. */
function fromOf(row: CdrRow): string {
  const uriUser = row['call-orig-from-uri']
    ?.replace(/^sips?:/, '')
    .split('@')[0];
  return (
    row['call-orig-from-name']?.trim() ||
    row['call-orig-from-user'] ||
    uriUser ||
    '—'
  );
}

function toOf(row: CdrRow): string {
  return (
    row['call-term-to-name']?.trim() ||
    row['call-term-user'] ||
    row['call-orig-to-user'] ||
    '—'
  );
}

type Tone = 'success' | 'info' | 'error' | 'warning';

const DIRECTIONS: { code: number; label: string; tone: Tone }[] = [
  { code: 1, label: 'Inbound', tone: 'info' },
  { code: 0, label: 'Outbound', tone: 'success' },
  { code: 2, label: 'Missed', tone: 'error' },
  { code: 3, label: 'Inter-company', tone: 'warning' },
];

const LONGEST = 5;

function fmtDuration(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = Math.floor(totalSeconds % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

interface CallAnalysisPanelProps extends SidePanelContentProps {
  rows: CdrRow[];
  /** True when the rows are the user's selection rather than the whole grid. */
  fromSelection: boolean;
}

export function CallAnalysisPanel({
  context,
  close,
  rows,
  fromSelection,
}: CallAnalysisPanelProps) {
  const {
    Stack,
    Typography,
    Alert,
    Chart,
    Donut,
    Button,
    Table,
    TableHead,
    TableBody,
    TableRow,
    TableCell,
  } = context.ui ?? {};
  if (!Stack || !Typography || !Button) return null;

  if (rows.length === 0) {
    return (
      <Stack spacing={2} sx={{ p: 2 }}>
        {Alert ? (
          <Alert severity='info'>
            No calls to analyze. Widen the date range or the filters, then try
            again.
          </Alert>
        ) : null}
        <Button variant='text' onClick={close}>
          Close
        </Button>
      </Stack>
    );
  }

  // Calls per hour of day, split answered / missed.
  const byHour = Array.from({ length: 24 }, (_, hour) => ({
    hour: `${String(hour).padStart(2, '0')}:00`,
    answered: 0,
    missed: 0,
  }));
  for (const row of rows) {
    const hour = startHour(row['call-start-datetime']);
    if (hour === null) continue;
    const bucket = byHour[hour];
    if (!bucket) continue;
    if (row['call-direction'] === 2) bucket.missed += 1;
    else bucket.answered += 1;
  }
  const firstBusy = byHour.findIndex((h) => h.answered + h.missed > 0);
  const lastBusy =
    byHour.length -
    1 -
    [...byHour].reverse().findIndex((h) => h.answered + h.missed > 0);
  const hours = firstBusy >= 0 ? byHour.slice(firstBusy, lastBusy + 1) : [];

  const slices = DIRECTIONS.map((d) => ({
    label: d.label,
    value: rows.filter((r) => r['call-direction'] === d.code).length,
    tone: d.tone,
  })).filter((s) => s.value > 0);

  const longest = [...rows]
    .sort(
      (a, b) =>
        (b['call-total-duration-seconds'] ?? 0) -
        (a['call-total-duration-seconds'] ?? 0),
    )
    .slice(0, LONGEST);

  return (
    <Stack spacing={3} sx={{ p: 2 }}>
      <Typography variant='body2' color='text.secondary'>
        {fromSelection ? 'Your selection' : 'The calls the grid has loaded'}:{' '}
        {rows.length} call{rows.length === 1 ? '' : 's'}.
      </Typography>

      {Chart && hours.length > 0 ? (
        <Stack spacing={1}>
          <Typography variant='subtitle2'>Calls by hour</Typography>
          <Chart
            kind='bar'
            stacked
            height={200}
            data={hours}
            xKey='hour'
            series={[
              { key: 'answered', label: 'Answered', tone: 'success' },
              { key: 'missed', label: 'Missed', tone: 'error' },
            ]}
          />
        </Stack>
      ) : null}

      {Donut && slices.length > 0 ? (
        <Stack spacing={1}>
          <Typography variant='subtitle2'>By direction</Typography>
          <Donut
            slices={slices}
            centerLabel={String(rows.length)}
            height={200}
          />
        </Stack>
      ) : null}

      {Table && TableHead && TableBody && TableRow && TableCell ? (
        <Stack spacing={1}>
          <Typography variant='subtitle2'>Longest calls</Typography>
          <Table size='small'>
            <TableHead>
              <TableRow>
                <TableCell>From</TableCell>
                <TableCell>To</TableCell>
                <TableCell align='right'>Length</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {longest.map((row, i) => (
                <TableRow key={row.id ?? i}>
                  <TableCell>{fromOf(row)}</TableCell>
                  <TableCell>{toOf(row)}</TableCell>
                  <TableCell align='right'>
                    {fmtDuration(row['call-total-duration-seconds'] ?? 0)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Stack>
      ) : null}

      <Button variant='text' onClick={close}>
        Close
      </Button>
    </Stack>
  );
}
