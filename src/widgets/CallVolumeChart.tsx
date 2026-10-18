/**
 * Call volume, matched to the CRM — a `kind: 'panel'` widget in the **charts**
 * category.
 *
 * Registered in `App.tsx` §4 under the id `call-volume`, which is unchanged:
 * the stored id is what lands in every saved layout. What it charts did
 * change. It used to stack answered vs missed calls, and the host's own
 * dashboard already charts call volume (its calls chart reads the same CDRs),
 * so the card was a copy of a native one with a different owner. It now
 * splits each bucket by whether the caller resolved to an Example CRM record
 * (`mocks/crm.ts`) — the integration's match rate, which only the integration
 * can know. A climbing "Not in the CRM" bar is the prompt to go create leads.
 *
 * This file used to hand-draw its bars out of
 * `Box` elements, because `context.ui` had no chart of any kind and the host
 * kept its ten ECharts panels to itself. It now uses `ui.Chart`, and the
 * difference is the whole argument for the SDK:
 *
 * - The host owns ECharts, the palette, the grid, the axes, the legend and the
 *   tooltip. This file owns the bucketing and nothing else.
 * - Series colour is a semantic `tone` — `'primary'`, `'warning'` — never a hex.
 *   The app says what a series *means* and the host decides what that looks
 *   like, so the bars follow the light/dark toggle with nothing here to update.
 * - `kind: 'bar'` with `stacked` is the same option shape the native Voice usage
 *   panel builds, so this card and that one are the same component.
 *
 * What is left is the honest division of labour: `widget.range` in, buckets out.
 * The chart sizes itself to the card, so `widget.pixel` is no longer read here —
 * the host derives the box and ECharts follows it.
 */
import type { WidgetComponentProps } from '@netsapiens/flow-sdk';
import { useMemo } from 'react';

import { type ZoneMarkerProps } from '../integration/withZoneTestId';
import { buildCallFeed } from '../mocks/widgetActivity';

const DAY_MS = 24 * 60 * 60 * 1000;

/** One column of the chart. Keys match the `series` declared below. */
interface Bucket extends Record<string, unknown> {
  label: string;
  matched: number;
  unmatched: number;
}

/** Fixed column count — the host thins the axis labels so they never collide. */
const COLUMNS = 12;

function bucketLabel(at: Date, spanMs: number): string {
  return spanMs > DAY_MS
    ? at.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
    : at.toLocaleTimeString(undefined, { hour: 'numeric' });
}

export function CallVolumeChart({
  context,
  widget,
  ...marker
}: WidgetComponentProps & ZoneMarkerProps) {
  const { Chart, Stack, Typography } = context.ui ?? {};

  // Keyed on the timestamps, not on `widget.range` — the host rebuilds that
  // object every render, so an object dep would rebucket on every paint.
  const from = widget.range?.from;
  const to = widget.range?.to;

  const buckets = useMemo<Bucket[]>(() => {
    const toDate = to ? new Date(to) : new Date();
    const fromDate = from
      ? new Date(from)
      : new Date(toDate.getTime() - DAY_MS);
    const spanMs = Math.max(toDate.getTime() - fromDate.getTime(), 60_000);
    const width = spanMs / COLUMNS;

    const empty: Bucket[] = Array.from({ length: COLUMNS }, (_, index) => ({
      label: bucketLabel(new Date(fromDate.getTime() + index * width), spanMs),
      matched: 0,
      unmatched: 0,
    }));

    for (const call of buildCallFeed(toDate)) {
      const offset = new Date(call.at).getTime() - fromDate.getTime();
      if (offset < 0 || offset > spanMs) continue;
      const slot = Math.min(COLUMNS - 1, Math.floor(offset / width));
      if (call.account) empty[slot].matched += 1;
      else empty[slot].unmatched += 1;
    }

    return empty;
  }, [from, to]);

  // Carve-out: with no kit there is nothing to draw a chart with.
  if (!Chart) {
    const total = buckets.reduce((n, b) => n + b.matched + b.unmatched, 0);
    if (!Stack || !Typography) return <div {...marker}>{total} calls</div>;
    return (
      <Stack {...marker} direction='column' sx={{ height: '100%' }}>
        <Typography variant='body2' color='text.secondary'>
          {total} calls in the selected range
        </Typography>
      </Stack>
    );
  }

  return (
    // Content only. The frame drew the card, the title, the subtitle and the
    // window chip before this rendered.
    <Chart
      {...marker}
      kind='bar'
      stacked
      data={buckets}
      xKey='label'
      series={[
        // Semantic, not decorative: matched is the integration working, and
        // unmatched is a warning (leads not yet created), not an error.
        { key: 'matched', label: 'In Example CRM', tone: 'primary' },
        { key: 'unmatched', label: 'Not in the CRM', tone: 'warning' },
      ]}
    />
  );
}
