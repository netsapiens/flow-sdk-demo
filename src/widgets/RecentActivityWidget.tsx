/**
 * CRM activity — a `kind: 'panel'` widget in the **activity** category, and
 * the demo's tabbed card.
 *
 * Registered in `App.tsx` §4 under the id `recent-activity`, kept because the
 * stored id is what every saved layout holds. Its feed changed: it used to list
 * answered, missed and voicemail calls, which is the host's Call Logs (and the
 * agent dashboard's call history) in a smaller box. It now lists what THIS APP
 * did in Example CRM — contacts synced, leads created from callers nobody had a
 * record for, call notes written back (`buildAppEventFeed` in
 * `mocks/widgetActivity.ts`). An app's own events are the one feed no host
 * screen can have, so they are what an app's activity card should carry.
 *
 * It is the same shape as the host's own *Overall
 * System Health*: a pill strip with a count on each tab, and a feed underneath
 * filtered to the selection. `ui.Tabs` draws the strip — the kit owns that
 * treatment so a contributed card gets the platform's tab styling for free —
 * and the panel below is the app's, which is the split the kit documents: apps
 * differ on whether panels stay mounted, so a `TabPanel` contract would take
 * that choice away.
 *
 * The three inputs a panel is handed, all still on show:
 *
 * - **`widget.range`** — the dashboard's resolved from/to window, because the
 *   registration declares `refreshPolicy: 'shared-range'`. Always timestamps,
 *   never a preset label. The feed is filtered by it, so changing the range
 *   changes every tab's count.
 * - **`widget.pixel`** — the card's real box, measured by the host. Used to
 *   decide how many rows fit. It reported the row-span arithmetic until the
 *   host started measuring, which is why this card used to say "showing 2 of
 *   17" in a card with room for eight.
 * - **`actions`** — `resize()` and `remove()`, driven from the content rather
 *   than only from the frame's menu.
 *
 * `actions.refresh()` is the third action and is not called here: a widget on
 * the shared range has nothing to refresh that the range control does not
 * already drive. The host implements it as a remount; `SyncQueueTable.tsx` is
 * where that earns a button.
 */
import type { WidgetComponentProps } from '@netsapiens/flow-sdk';
import { useMemo, useState } from 'react';

import type { AppEventKind } from '../mocks/widgetActivity';
import { type ZoneMarkerProps } from '../integration/withZoneTestId';
import { buildAppEventFeed } from '../mocks/widgetActivity';

/**
 * Row label and dot per kind.
 *
 * `tone` is semantic — the host resolves it to a colour, so this file names
 * meaning and never picks a palette path. It used to carry `success.main` and
 * friends and draw its own dot; `ui.ActivityList` draws the row now.
 */
const KIND_META: Record<
  AppEventKind,
  { label: string; tone: 'success' | 'primary' | 'info' }
> = {
  'contact-synced': { label: 'Contact synced', tone: 'success' },
  'lead-created': { label: 'Lead created', tone: 'primary' },
  'note-written': { label: 'Note written back', tone: 'info' },
};

/** Tab order. `all` first, then the kinds, matching the host's health card. */
const TABS: Array<{ value: string; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'contact-synced', label: 'Synced' },
  { value: 'lead-created', label: 'Leads' },
  { value: 'note-written', label: 'Notes' },
];

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * How many rows the card has room for, from the host-supplied box — which is
 * now measured rather than derived from the declared row span.
 */
function rowsThatFit(pixelHeight: number): number {
  if (pixelHeight <= 0) return 5;
  const CHROME = 120; // tab strip + footer, inside the frame's own padding
  const ROW = 34;
  return Math.max(2, Math.min(12, Math.floor((pixelHeight - CHROME) / ROW)));
}

function formatClock(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    dateStyle: 'short',
    timeStyle: 'short',
  });
}

export function RecentActivityWidget({
  context,
  widget,
  actions,
  ...marker
}: WidgetComponentProps & ZoneMarkerProps) {
  const { Stack, Typography, Button, Divider, Tabs, ActivityList } =
    context.ui ?? {};
  const [tab, setTab] = useState<string>('all');

  // Keyed on the two timestamps rather than on `widget.range` itself: the host
  // rebuilds that object every render, so an object dep would recompute the feed
  // on every paint while a change of window is what actually matters.
  const from = widget.range?.from;
  const to = widget.range?.to;

  const { events, windowLabel } = useMemo(() => {
    const toDate = to ? new Date(to) : new Date();
    const fromDate = from
      ? new Date(from)
      : new Date(toDate.getTime() - DAY_MS);

    const filtered = buildAppEventFeed(toDate).filter((event) => {
      const at = new Date(event.at).getTime();
      return at >= fromDate.getTime() && at <= toDate.getTime();
    });

    return {
      events: filtered,
      windowLabel: `${formatClock(fromDate.toISOString())} → ${formatClock(toDate.toISOString())}`,
    };
  }, [from, to]);

  // Counts per tab, so the strip carries the same at-a-glance numbers the
  // native health card puts on its tabs.
  const counts = useMemo(() => {
    const byKind = { all: events.length } as Record<string, number>;
    for (const t of TABS.slice(1)) {
      byKind[t.value] = events.filter((e) => e.kind === t.value).length;
    }
    return byKind;
  }, [events]);

  const shown = useMemo(
    () => (tab === 'all' ? events : events.filter((e) => e.kind === tab)),
    [events, tab],
  );

  // Carve-out: the kit is what supplies every visible element, so when it is
  // missing there is nothing to fall back to but uncoloured text.
  if (!Stack || !Typography) {
    return <div {...marker}>{events.length} events in the selected range</div>;
  }

  const visible = shown.slice(0, rowsThatFit(widget.pixel.height));

  return (
    // The marker rides this root — a real, visible box the Playwright suite can
    // assert. No card and no heading: the frame drew both, and the subtitle.
    <Stack {...marker} direction='column' spacing={1.5} sx={{ height: '100%' }}>
      {Tabs ? (
        <Tabs
          value={tab}
          onChange={(value) => setTab(String(value))}
          // `standard`, not the kit's default `pill`. The pill strip is the
          // host's PAGE treatment; its dashboard panels (Overall System Health,
          // Session License Usage) draw an underlined strip instead — and they
          // do it by hand-rolling MUI Tabs rather than using this component, so
          // the kit has no dashboard-panel variant to ask for. `standard` is the
          // closest the shared component gets, and a card that sits beside those
          // two should read like them.
          variant='standard'
          options={TABS.map((t) => ({
            value: t.value,
            // The count rides the label: the kit's tab options take a label, and
            // a parallel badge contract would be a second way to say one thing.
            label: `${t.label} ${counts[t.value] ?? 0}`,
          }))}
        />
      ) : null}

      {/* The rows are the host's now. This file decides WHICH events show and
          what each one means; the dot, the rhythm, the truncation and the empty
          state are all drawn by `ui.ActivityList` — which is the same row the
          host's own notice and health-alert lists use. `width` is the measured
          card, so the host drops the middle column on a narrow card rather than
          truncating three things at once. */}
      <Stack direction='column' sx={{ flexGrow: 1, minHeight: 0 }}>
        {ActivityList ? (
          <ActivityList
            width={widget.pixel.width}
            emptyMessage={
              tab === 'all'
                ? 'Nothing written to the CRM in this window.'
                : `No ${(TABS.find((t) => t.value === tab)?.label ?? tab).toLowerCase()} in this window.`
            }
            rows={visible.map((event) => ({
              id: event.id,
              tone: KIND_META[event.kind].tone,
              primary: `${KIND_META[event.kind].label} · ${event.subject}`,
              secondary: `${event.detail} · ${event.agent}`,
              meta: formatClock(event.at),
            }))}
          />
        ) : null}

        {/* The one thing the list cannot offer: an empty state that takes the
            card away. `actions` is the widget's, not the row component's. */}
        {shown.length === 0 && Button ? (
          <Button
            size='small'
            variant='text'
            color='error'
            onClick={() => actions.remove()}
            sx={{ alignSelf: 'flex-start' }}
          >
            Remove widget
          </Button>
        ) : null}
      </Stack>

      {Divider ? <Divider /> : null}

      <Stack
        direction='row'
        spacing={1}
        alignItems='center'
        justifyContent='space-between'
        flexWrap='wrap'
        useFlexGap
      >
        {/* Printing the resolved window and the measured box is demo licence: a
            real widget would not, but a partner reading this wants to see that
            both arrive and both change. */}
        <Typography variant='caption' color='text.secondary'>
          {windowLabel} &middot; {widget.pixel.width}&times;
          {widget.pixel.height}px &middot; showing {visible.length} of{' '}
          {shown.length}
        </Typography>
        {Button ? (
          <Button
            size='small'
            variant='text'
            onClick={() =>
              actions.resize(widget.size === 'full' ? 'half' : 'full')
            }
          >
            {widget.size === 'full' ? 'Half width' : 'Full width'}
          </Button>
        ) : null}
      </Stack>
    </Stack>
  );
}
