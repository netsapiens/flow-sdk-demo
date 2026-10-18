/**
 * Analytics Widget Extension
 * Computes call statistics from the live filtered rows published by DataTable.
 * No API calls — the data is already in memory from the page's own query.
 *
 * Every figure here has to be one the host does NOT already show. That rules
 * out a plain "Total Calls": the Call Logs grid prints its own row count in the
 * footer, so the widget used to repeat a number sitting a few hundred pixels
 * above it. In its place is "CRM matched" — the share of the visible calls
 * whose far-end party resolves in the (mock) CRM — which only an app that owns
 * a CRM can compute. The other three stay because the grid lists durations and
 * start times per row but never aggregates them:
 *
 *   - Avg Duration — the grid has a duration column, not a mean of it.
 *   - Peak Hour    — the grid sorts by start time; it does not bucket it.
 *   - Success Rate — the grid can filter to missed calls, but it never says
 *                    what fraction of the result they are.
 *
 * All four follow the grid's own filters for free: `pageContext.rows` is the
 * filtered set, so narrowing the grid to one user narrows every figure.
 */
import type { ExtensionComponentProps } from '@netsapiens/flow-sdk';
import { useMemo } from 'react';

import { type ZoneMarkerProps } from '../integration/withZoneTestId';
import { lookupCrmRecord, normalizePhoneNumber } from '../mocks/crm';

// Shape of a CDR row as published by the call-logs DataTable
interface CdrRow {
  'call-total-duration-seconds'?: number;
  /** Wall time in the bracketed zone, e.g. `2026-10-17T20:06:46Z[America/Los_Angeles]`. */
  'call-start-datetime'?: string;
  'call-direction'?: number; // 1=inbound, 2=missed, 3=inter-company, -1=not-routed, 0=outbound
  /** Caller's user part (extension or number) — the far end of an inbound call. */
  'call-orig-from-user'?: string;
  /** Caller as a SIP URI (`sip:631@host`), when the user part is absent. */
  'call-orig-from-uri'?: string;
  /** What the caller dialled — the far end of an outbound call. */
  'call-orig-to-user'?: string;
  /** Who finally answered — the fallback far end of an outbound call. */
  'call-term-user'?: string;
}

/**
 * The CDR's far-end party: the number the CRM would know. Outbound (0) means
 * the user dialled out, so the other side is the dialled number; every other
 * direction — inbound, missed, inter-company — means someone called in, so the
 * other side is the caller.
 */
function farEndParty(r: CdrRow): string {
  const raw =
    r['call-direction'] === 0
      ? (r['call-orig-to-user'] ?? r['call-term-user'])
      : (r['call-orig-from-user'] ?? r['call-orig-from-uri']);
  return raw ? normalizePhoneNumber(String(raw)) : '';
}

/**
 * Does `party` resolve in the mock CRM? The directory keys external callers by
 * E.164 (`+15551234567`) and internal people by bare extension, while a CDR
 * carries whatever the trunk sent — `15551234567`, `5551234567`, or `+1…`. Try
 * the number as given, then the E.164 forms a NANP number can arrive in. A real
 * CRM lookup would normalise server-side; the point here is only that the
 * match is done on the far end, not the user's own extension.
 */
function isCrmMatch(party: string): boolean {
  if (!party) return false;
  const digits = party.replace(/\D/g, '');
  const candidates = [party, `+${digits}`];
  if (digits.length === 10) candidates.push(`+1${digits}`);
  return candidates.some((c) => lookupCrmRecord(c) !== undefined);
}

interface CallLogsPageContext {
  rows?: CdrRow[];
}

function fmtDuration(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = Math.floor(totalSeconds % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

type StatKey = 'crmMatched' | 'avgDuration' | 'peakHour' | 'successRate';

interface StatConfig {
  key: StatKey;
  label: string;
  color: string;
  /** Appended to the value, unless the value is the em-dash placeholder. */
  suffix?: string;
}

const STAT_CONFIGS: readonly StatConfig[] = [
  // Not "Total Calls": the grid's footer already prints the row count.
  {
    key: 'crmMatched',
    label: 'CRM Matched',
    suffix: '%',
    color: 'primary.main',
  },
  { key: 'avgDuration', label: 'Avg Duration', color: 'success.main' },
  { key: 'peakHour', label: 'Peak Hour', color: 'warning.main' },
  {
    key: 'successRate',
    label: 'Success Rate',
    suffix: '%',
    color: 'secondary.main',
  },
];

export function AnalyticsWidget({
  context,
  ...marker
}: ExtensionComponentProps & ZoneMarkerProps) {
  const { Paper, Typography } = context.ui ?? {};
  // Read the raw reference: defaulting with `?? []` out here would allocate a
  // new array every render and the memo below would never hold.
  const pageRows = (context.pageContext as CallLogsPageContext | undefined)
    ?.rows;

  const stats = useMemo<Record<StatKey, string | number>>(() => {
    const rows = pageRows ?? [];
    const n = rows.length;

    if (n === 0) {
      return {
        crmMatched: '—',
        avgDuration: '—',
        peakHour: '—',
        successRate: '—',
      };
    }

    // Average call duration
    const totalSecs = rows.reduce(
      (sum, r) => sum + (r['call-total-duration-seconds'] ?? 0),
      0,
    );
    const avgDuration = fmtDuration(totalSecs / n);

    // Peak hour — bucket by hour of call-start-datetime.
    // The API returns datetimes as "YYYY-MM-DDTHH:mm:ssZ[Timezone]" which is non-standard
    // ISO 8601 — strip the bracket timezone suffix before parsing (same as formatDate does).
    const hourCounts = new Array(24).fill(0) as number[];
    let parsedDateCount = 0;
    rows.forEach((r) => {
      if (r['call-start-datetime']) {
        const cleaned = r['call-start-datetime'].replace(/Z\[.+\]$/, '');
        const hour = new Date(cleaned).getHours();
        if (!isNaN(hour)) {
          hourCounts[hour]++;
          parsedDateCount++;
        }
      }
    });
    let peakHour = '—';
    if (parsedDateCount > 0) {
      const maxHour = hourCounts.indexOf(Math.max(...hourCounts));
      const h12 = maxHour % 12 || 12;
      peakHour = `${h12}:00 ${maxHour < 12 ? 'AM' : 'PM'}`;
    }

    // Success rate — exclude missed (2) and not-routed (-1)
    const successful = rows.filter(
      (r) => r['call-direction'] !== 2 && r['call-direction'] !== -1,
    ).length;
    const successRate = Number(((successful / n) * 100).toFixed(1));

    // CRM matched — share of the visible calls whose far end is a CRM contact.
    const matched = rows.filter((r) => isCrmMatch(farEndParty(r))).length;
    const crmMatched = Number(((matched / n) * 100).toFixed(1));

    return { crmMatched, avgDuration, peakHour, successRate };
  }, [pageRows]);

  if (!Paper || !Typography) return null;

  return (
    <Paper
      {...marker}
      variant='outlined'
      sx={{
        p: 2.5,
        display: 'grid',
        gridTemplateColumns: 'repeat(4, 1fr)',
        gap: 2,
        width: '100%',
        alignSelf: 'stretch',
      }}
    >
      {STAT_CONFIGS.map(({ key, label, color, suffix }) => (
        <Paper
          key={key}
          variant='outlined'
          sx={{ p: 2, display: 'flex', flexDirection: 'column', gap: 0.5 }}
        >
          <Typography variant='caption' color='text.secondary'>
            {label}
          </Typography>
          <Typography variant='h5' fontWeight={600} sx={{ color }}>
            {stats[key]}
            {suffix && stats[key] !== '—' ? suffix : ''}
          </Typography>
        </Paper>
      ))}
    </Paper>
  );
}
