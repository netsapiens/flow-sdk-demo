/**
 * Recordings processed — a `kind: 'leaf'` widget with `leafOf: 'stat'`.
 *
 * Registered in `App.tsx` §4. It sits **inside** the host's own stat container,
 * directly beside native blocks like Active Calls, which is exactly why it may
 * not draw itself: this file used to hand-build the number as
 * `Typography variant='h4' fontWeight={600}`, and the native block next to it is
 * `h4`'s own weight at `text.secondary`. Sampled side by side that is 700 vs 600
 * and `rgb(77,89,94)` vs `rgb(27,33,36)` — invisible until someone inspects it,
 * and then obviously wrong.
 *
 * So it renders `ui.StatBlock`, which mirrors the native block element for
 * element. The lesson generalises: a widget that lands among host components
 * should be composed of host components, and any styling it does itself is a
 * copy that will drift.
 *
 * The numbers come from the same `SAMPLE_CALL_RECORDINGS` fixture the Recording
 * QA Review page draws its queue from (the processed ones are what a reviewer
 * can listen to), so the dashboard stat and the page agree — which is what a
 * real widget-plus-page pairing looks like.
 */
import type { WidgetComponentProps } from '@netsapiens/flow-sdk';

import { type ZoneMarkerProps } from '../integration/withZoneTestId';
import { SAMPLE_CALL_RECORDINGS } from '../mocks/callRecordings';

// Derived once at module load: the fixture is static, so recomputing it per
// render would be work with no chance of a different answer.
const TOTAL = SAMPLE_CALL_RECORDINGS.length;
const PROCESSED = SAMPLE_CALL_RECORDINGS.filter(
  (recording) => recording.status === 'Processed',
).length;
const FAILED = SAMPLE_CALL_RECORDINGS.filter(
  (recording) => recording.status === 'Failed',
).length;

/** Share of the window that came out clean, as the block's trend pill. */
const SUCCESS_PCT = TOTAL ? (PROCESSED / TOTAL) * 100 - 100 : 0;

/** The processed-per-hour shape across the window, for the sparkline. */
const PROCESSED_TREND = [3, 5, 4, 6, 5, 7, 6, 8];

export function RecordedCallsStat({
  context,
  ...marker
}: WidgetComponentProps & ZoneMarkerProps) {
  const { StatBlock } = context.ui ?? {};

  // Carve-out: with no kit there is nothing to render but the number.
  if (!StatBlock) return <div {...marker}>{PROCESSED}</div>;

  return (
    // No heading — the leaf frame drew "Recordings processed" from the
    // registration's `title`, exactly as it does for the native block beside it.
    <StatBlock
      {...marker}
      value={PROCESSED}
      caption={`of ${TOTAL} · ${FAILED} failed`}
      delta={{ pct: SUCCESS_PCT }}
      spark={PROCESSED_TREND}
      tone={FAILED > 0 ? 'warning' : 'success'}
    />
  );
}
