/**
 * Live call console — a `kind: 'panel'` widget, and the demo's answer to "what
 * can I actually build in one of these?"
 *
 * Registered in `App.tsx` §4. Every other widget here maps onto something the
 * host already draws: a chart, a datagrid, a stat block, a tabbed card. This one
 * is deliberately the other case — a layout the platform has no equivalent for,
 * assembled entirely from `context.ui`. That is the argument the demo has to
 * make: a partner's product is usually not a restyled version of ours, and the
 * kit has to express something we never anticipated without the app reaching for
 * its own styling.
 *
 * Sixteen kit components, no hand-styled markup, and no colour literal in the
 * file:
 *
 *   SearchField         filter by caller, debounced by the host
 *   ToggleButtonGroup   status filter
 *   Switch              CRM enrichment on/off
 *   Alert               the waiting-call banner, only while something rings
 *   Card / CardContent  the three summary tiles
 *   Paper               one row per call, `background` stepped while ringing
 *   Avatar              caller initials
 *   Chip                direction, status, running talk time, footer counts
 *   Tooltip             names each row action
 *   IconButton          per-row actions
 *   Button              the empty state's routes out
 *   Icon                the empty state's mark
 *   Divider / Stack / Typography / Box   structure
 *
 * ── Layout ───────────────────────────────────────────────────────────────
 * The rows are a CSS grid with a fixed column template, not a flex row of
 * chips. Chips size to their content, so a flex row leaves every column ragged —
 * `In` and `Out`, `ringing` and `2:23`, all different widths, and nothing lines
 * up down the card. One template applied to every row fixes the columns and
 * costs nothing.
 *
 * How many rows are drawn comes from `widget.pixel.height`, so the board fills
 * the card it is given and overflow becomes a "+N more" line rather than a
 * scrollbar. A dashboard is for seeing everything at once; a card that hides
 * content behind its own scrollbar works against that.
 *
 * Data is pushed, not polled — `refreshPolicy: 'realtime'`. `App.tsx` subscribes
 * to the softphone once through `sdk.streams.softphone`,
 * `services/callEnrichment.ts` enriches each event and re-emits it, and this
 * console listens to that one broadcast. A widget does not open a second
 * subscription to the host.
 *
 * With nothing in progress it shows the sample board from `mocks/liveCalls.ts`,
 * badged in the footer — and badged "Live feed" when it is real. A console that
 * goes blank whenever the phones are quiet demonstrates nothing; passing a
 * sample off as live would be worse than either.
 */
import type {
  SidePanelContentProps,
  WidgetComponentProps,
} from '@netsapiens/flow-sdk';
import { useEffect, useMemo, useState } from 'react';
import { useSidePanel } from '@netsapiens/flow-sdk';

import type { CallerInfo } from '../services/callEnrichment';
import { type ZoneMarkerProps } from '../integration/withZoneTestId';
import { buildSampleCalls } from '../mocks/liveCalls';
import { CallDetailsPanel } from '../panels/CallDetailsPanel';
import { activeCallsStore, onCallChanges } from '../services/callEnrichment';

type StatusFilter = 'all' | 'ringing' | 'answered';

const FILTERS = [
  { value: 'all', label: 'All' },
  { value: 'ringing', label: 'Ringing' },
  { value: 'answered', label: 'Active' },
];

/** Status → the semantic colour key the kit resolves. Never a literal. */
const STATUS_TONE: Record<CallerInfo['status'], string> = {
  ringing: 'warning',
  answered: 'success',
  missed: 'error',
  ended: 'default',
};

/**
 * One template for every row, so the columns line up down the card.
 * avatar · caller · direction · status · action
 */
const ROW_COLUMNS = '34px minmax(0, 1fr) 46px 68px 32px';

function initials(call: CallerInfo): string {
  const name = call.callerName?.trim();
  if (!name) return call.from.replace(/\D/g, '').slice(-2) || '?';
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}

function clock(seconds: number): string {
  const m = Math.floor(Math.max(0, seconds) / 60);
  const s = Math.max(0, seconds) % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

/** Seconds since the event that put this call on the board. */
function secondsOn(call: CallerInfo, nowMs: number): number {
  return Math.max(0, Math.floor((nowMs - call.timestamp) / 1000));
}

/** Rows the board has room for, from the host-measured box. */
function rowsThatFit(pixelHeight: number, hasBanner: boolean): number {
  if (pixelHeight <= 0) return 4;
  const CHROME = (hasBanner ? 250 : 190) + 56; // controls + tiles + footer
  const ROW = 54;
  return Math.max(1, Math.min(9, Math.floor((pixelHeight - CHROME) / ROW)));
}

export function LiveCallsWidget({
  context,
  widget,
  ...marker
}: WidgetComponentProps & ZoneMarkerProps) {
  const {
    Stack,
    Typography,
    Box,
    Paper,
    Card,
    CardContent,
    Avatar,
    Chip,
    Button,
    IconButton,
    Divider,
    Switch,
    ToggleButtonGroup,
    SearchField,
    Alert,
    Tooltip,
    Icon,
  } = context.ui ?? {};

  // A widget renders outside FlowContextProvider, exactly as a zone
  // extension does, so the hook is handed the bus rather than reading context.
  const { open } = useSidePanel(context);
  const navigate = context.navigate;

  const [live, setLive] = useState<CallerInfo[]>([]);
  const [filter, setFilter] = useState<StatusFilter>('all');
  const [search, setSearch] = useState('');
  const [enriched, setEnriched] = useState(true);

  useEffect(() => {
    // The enrichment service keeps activeCallsStore and tells us when it
    // changes. Seed from the store: a console added mid-call should not wait
    // for the next change to have anything to say.
    const sync = () => setLive(Array.from(activeCallsStore.values()));
    sync();
    return onCallChanges({ updated: sync, removed: sync });
  }, []);

  // One clock for every row, rather than a timer per card.
  const [nowMs, setNowMs] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNowMs(Date.now()), 1_000);
    return () => clearInterval(timer);
  }, []);

  const showingSample = live.length === 0;
  const calls = useMemo(
    () => (showingSample ? buildSampleCalls(new Date(nowMs)) : live),
    // `nowMs` deliberately absent: the sample board is built once on the switch
    // to sample mode, not rebuilt every second under the ticking clock.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [showingSample, live],
  );

  const shown = useMemo(() => {
    const term = search.trim().toLowerCase();
    return calls
      .filter((c) => filter === 'all' || c.status === filter)
      .filter(
        (c) =>
          !term ||
          (c.callerName ?? '').toLowerCase().includes(term) ||
          (c.company ?? '').toLowerCase().includes(term) ||
          c.from.includes(term),
      );
  }, [calls, filter, search]);

  // Carve-out: the kit is what supplies every visible element, so with none of
  // it there is nothing to fall back to but the count.
  if (!Stack || !Typography || !Paper || !Box) {
    return <div {...marker}>{calls.length} calls</div>;
  }

  const ringingCalls = calls.filter((c) => c.status === 'ringing');
  const answered = calls.filter((c) => c.status === 'answered');
  const longestWait = ringingCalls.length
    ? Math.max(...ringingCalls.map((c) => secondsOn(c, nowMs)))
    : 0;
  const avgTalk = answered.length
    ? Math.round(
        answered.reduce((n, c) => n + secondsOn(c, nowMs), 0) / answered.length,
      )
    : 0;

  const hasBanner = ringingCalls.length > 0;
  const visible = shown.slice(0, rowsThatFit(widget.pixel.height, hasBanner));
  const hidden = shown.length - visible.length;

  /**
   * Open the shared side panel on one call. `CallDetailsPanel` takes the row as
   * a prop, so it is closed over here — the same shape `OpenInCrmAction` uses
   * to open the CRM panel from a Call Logs row.
   */
  const openDetails = (call: CallerInfo) => {
    const Panel = (props: SidePanelContentProps) => (
      <CallDetailsPanel
        {...props}
        row={{
          'call-from': call.from,
          'call-to': call.to,
          'call-direction': call.direction,
          'call-status': call.status,
          'caller-name': call.callerName ?? '',
          company: call.company ?? '',
          'last-contact': call.lastContact ?? '',
          notes: call.notes ?? '',
        }}
      />
    );
    open({
      title: call.callerName ?? call.from,
      subtitle: 'Live call · opened from a dashboard widget',
      width: 'sm',
      icon: 'mdi:phone-in-talk',
      component: Panel,
    });
  };

  /** The three summary tiles. Values only — the labels never change. */
  const tiles = [
    { label: 'Ringing', value: String(ringingCalls.length) },
    { label: 'Connected', value: String(answered.length) },
    { label: 'Avg talk', value: answered.length ? clock(avgTalk) : '—' },
  ];

  return (
    <Stack {...marker} direction='column' spacing={1.5} sx={{ height: '100%' }}>
      {/* Controls. A dashboard card is allowed to be interactive: the frame owns
          the card, the title and the menu, and everything inside is the app's. */}
      <Stack
        direction='row'
        spacing={1}
        alignItems='center'
        flexWrap='wrap'
        useFlexGap
      >
        {SearchField ? (
          <Box sx={{ flexGrow: 1, minWidth: 150 }}>
            <SearchField
              value={search}
              onChange={setSearch}
              placeholder='Filter callers'
              size='small'
              fullWidth
            />
          </Box>
        ) : null}
        {ToggleButtonGroup ? (
          <ToggleButtonGroup
            exclusive
            size='small'
            value={filter}
            options={FILTERS}
            onChange={(_event: unknown, next: string | null) =>
              setFilter((current) => (next as StatusFilter) ?? current)
            }
          />
        ) : null}
        {Switch ? (
          <Switch
            size='small'
            label='CRM'
            checked={enriched}
            onChange={(_event: unknown, checked: boolean) =>
              setEnriched(checked)
            }
          />
        ) : null}
      </Stack>

      {/* Only while something is actually waiting — a banner that is always
          there stops being a signal. */}
      {hasBanner && Alert ? (
        <Alert
          severity='warning'
          message={`${ringingCalls.length} waiting · longest ${clock(longestWait)}`}
        />
      ) : null}

      {/* Summary tiles. Equal columns, so the three read as one strip. */}
      {Card && CardContent ? (
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
            gap: 1,
          }}
        >
          {tiles.map((tile) => (
            <Card key={tile.label} variant='outlined'>
              <CardContent sx={{ p: 1.25, '&:last-child': { pb: 1.25 } }}>
                <Typography
                  variant='caption'
                  color='text.secondary'
                  noWrap
                  sx={{ display: 'block' }}
                >
                  {tile.label}
                </Typography>
                <Typography variant='h6' fontWeight={600} noWrap>
                  {tile.value}
                </Typography>
              </CardContent>
            </Card>
          ))}
        </Box>
      ) : null}

      {/* The board. */}
      <Stack
        direction='column'
        spacing={0.75}
        sx={{ flexGrow: 1, minHeight: 0 }}
      >
        {visible.length === 0 ? (
          <Stack
            direction='column'
            spacing={1.5}
            alignItems='center'
            justifyContent='center'
            sx={{ flexGrow: 1, textAlign: 'center', px: 2 }}
          >
            {Icon ? (
              <Icon
                icon='mdi:phone-off-outline'
                sx={{ fontSize: 30, color: 'text.disabled' }}
              />
            ) : null}
            <Typography variant='body2' color='text.secondary'>
              {search
                ? `Nothing matches “${search}”.`
                : `Nothing ${filter === 'all' ? 'in progress' : `is ${filter}`} right now.`}
            </Typography>
            <Stack direction='row' spacing={1} flexWrap='wrap' useFlexGap>
              {Button && (search || filter !== 'all') ? (
                <Button
                  size='small'
                  variant='text'
                  onClick={() => {
                    setSearch('');
                    setFilter('all');
                  }}
                >
                  Clear filters
                </Button>
              ) : null}
              {Button && navigate ? (
                <Button
                  size='small'
                  variant='soft'
                  onClick={() => navigate('/manage/crm-integration')}
                >
                  Open CRM Integration
                </Button>
              ) : null}
            </Stack>
          </Stack>
        ) : (
          visible.map((call) => (
            // `background` is a palette step the host resolves per colour mode,
            // not a colour this file chose — a ringing call lifts off the card
            // without this knowing what "lifted" looks like in dark.
            <Paper
              key={call.callId}
              variant='outlined'
              background={call.status === 'ringing' ? 5 : undefined}
              sx={{
                p: 1,
                display: 'grid',
                gridTemplateColumns: ROW_COLUMNS,
                alignItems: 'center',
                columnGap: 1,
              }}
            >
              {Avatar ? (
                <Avatar sx={{ width: 30, height: 30, fontSize: 12 }}>
                  {initials(call)}
                </Avatar>
              ) : (
                <Box />
              )}

              <Box sx={{ minWidth: 0 }}>
                <Typography variant='body2' fontWeight={600} noWrap>
                  {call.callerName ?? call.from}
                </Typography>
                <Typography variant='caption' color='text.secondary' noWrap>
                  {enriched && call.company
                    ? `${call.company} · ${call.callCount ?? 0} calls`
                    : call.from}
                </Typography>
              </Box>

              {/* Fixed columns: chips size to their text, so without these the
                  board is ragged down its right-hand side. */}
              <Box sx={{ justifySelf: 'end' }}>
                {Chip ? (
                  <Chip
                    size='small'
                    variant='outlined'
                    label={call.direction === 'inbound' ? 'In' : 'Out'}
                  />
                ) : null}
              </Box>

              <Box sx={{ justifySelf: 'end' }}>
                {Chip ? (
                  <Chip
                    size='small'
                    color={STATUS_TONE[call.status]}
                    label={
                      call.status === 'answered'
                        ? clock(secondsOn(call, nowMs))
                        : call.status
                    }
                    sx={{ minWidth: 62 }}
                  />
                ) : null}
              </Box>

              <Box sx={{ justifySelf: 'end' }}>
                {IconButton ? (
                  Tooltip ? (
                    <Tooltip
                      title={context.t?.('CALL_DETAILS') ?? 'Call details'}
                    >
                      {/* Tooltip needs a child that holds a ref, and the kit's
                          IconButton is a plain function component. `Box
                          component='span'` is the kit's own way to get one —
                          the rule against hand-rolled markup has no carve-out
                          for a structural wrapper. */}
                      <Box component='span' sx={{ display: 'inline-flex' }}>
                        <IconButton
                          icon='mdi:open-in-new'
                          size='small'
                          aria-label={`Details for ${call.callerName ?? call.from}`}
                          onClick={() => openDetails(call)}
                        />
                      </Box>
                    </Tooltip>
                  ) : (
                    <IconButton
                      icon='mdi:open-in-new'
                      size='small'
                      aria-label={`Details for ${call.callerName ?? call.from}`}
                      onClick={() => openDetails(call)}
                    />
                  )
                ) : null}
              </Box>
            </Paper>
          ))
        )}

        {hidden > 0 ? (
          <Typography variant='caption' color='text.secondary' sx={{ pt: 0.5 }}>
            +{hidden} more not shown
          </Typography>
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
        <Stack direction='row' spacing={1} flexWrap='wrap' useFlexGap>
          {Chip ? (
            <Chip
              size='small'
              variant='outlined'
              label={`${shown.length} of ${calls.length} shown`}
            />
          ) : null}
          {/* Never passes a sample off as live. */}
          {Chip ? (
            <Chip
              size='small'
              variant='soft'
              color={showingSample ? 'default' : 'success'}
              label={showingSample ? 'Sample data' : 'Live feed'}
            />
          ) : null}
        </Stack>
        <Typography variant='caption' color='text.secondary'>
          {widget.pixel.width}&times;{widget.pixel.height}px
        </Typography>
      </Stack>
    </Stack>
  );
}
