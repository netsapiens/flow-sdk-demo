/**
 * Recording QA review — a full page registered into the host's My Account
 * (/home) menu, and the reference for building a list page that looks native.
 *
 * Why this data: it used to be a "Call recordings" list, which duplicated the
 * host — Call Logs already plays and downloads the recording on every row. A
 * reference page that re-implements a platform feature teaches the wrong
 * lesson, so this one lists what Flow does NOT have: a quality-review queue
 * layered on top of the recordings (agent, queue, reviewer, score, flags). The
 * one thing a reviewer needs from the recording itself, listening to it, is a
 * row action that navigates to Call Logs rather than a second player. All of it
 * is mock data, and the page header says so.
 *
 * It exists because `DatagridTemplate` gives you the whole list-page apparatus
 * and the common failure is rebuilding parts of it by hand. Every control below
 * comes from the template or from PageTemplate; nothing is re-implemented:
 *
 *   - Primary action ("Assign N selected to me") lives in PageTemplate's
 *     `actions`, so it renders top-right in the header like "+ Add Domain" on
 *     native pages — NOT in the table toolbar — and reacts to the checkbox
 *     selection.
 *   - Search is `toolbar.enableSearch`, so it is the host's rounded field with a
 *     magnifier. A hand-rolled TextField is the single most obvious tell that a
 *     page was not built with the template.
 *   - Rows-per-page, the row count and the page arrows are the grid's own footer.
 *     There is nothing to add above the table.
 *   - Export / Filter / Columns are toolbar flags.
 *   - `toolbar.customControls` holds only the thing the host cannot know about —
 *     here a "Needs coaching only" switch. That is what the slot is for.
 *
 * It also exercises the props that a remote app could not reach before the SDK's
 * datagrid type was widened: `pageSizeOptions`, `enableCheckboxSelection` +
 * `onSelectionChange`, `initialState`, master-detail via
 * `getDetailPanelContent` (the scorecard), and `layout='fill'` sizing.
 */
import type { DatagridAction, DatagridColumn } from '@netsapiens/flow-sdk';
import { useCallback, useMemo, useState } from 'react';
import { useFlowContext, useLocale } from '@netsapiens/flow-sdk';

import type { QaStatus, RecordingQaReview } from '../mocks/recordingQaReviews';
import {
  CALL_LOGS_PATH,
  RECORDING_QA_COPY as COPY,
} from '../content/recordingQaContent';
import { type ZoneMarkerProps } from '../integration/withZoneTestId';
import {
  formatRecordingDuration,
  formatRecordingStartedAt,
} from '../mocks/callRecordings';
import {
  QA_QUEUES,
  QA_STATUSES,
  SAMPLE_QA_REVIEWS,
} from '../mocks/recordingQaReviews';

// Chip colours are palette keys the host resolves at render, so they follow the
// light/dark toggle — never a colour read off the theme-token snapshot.
const STATUS_COLOR: Record<QaStatus, string> = {
  'To review': 'default',
  'In review': 'info',
  Passed: 'success',
  'Needs coaching': 'warning',
};

/** A flag that is a compliance problem reads as an error; the rest are notes. */
const flagColor = (flag: string) =>
  flag.startsWith('Compliance') ? 'error' : 'default';

/** Statuses a reviewer can still pick up. A scored call is finished. */
const isOpen = (row: RecordingQaReview) =>
  row.status === 'To review' || row.status === 'In review';

// Constant props hoisted to module scope so they never churn identity. The grid
// caches its column set against the identity of `columns`/`actions`, and reads
// every object-valued prop the same way, so an inline literal here would make it
// reprocess on every re-render of this page — and this page re-renders on each
// selection change. See "Keep columns and actions stable" in DATAGRID.md.
const getRowId = (row: RecordingQaReview) => row.id;
const getDetailPanelHeight = () => 'auto' as const;
const INITIAL_STATE = {
  // Newest calls first, and keep the caller's number and direction out of the
  // way until asked for — a reviewer works from agent and queue.
  sorting: [{ field: 'startedAt', sort: 'desc' as const }],
  columnVisibility: { party: false, direction: false },
};
const PAGE_SIZE_OPTIONS = [10, 25, 50];

/** What this page changes about a row: who has it, and so where it stands. */
type Claim = Pick<RecordingQaReview, 'reviewer' | 'status'>;

export default function RecordingQaReviewPage({ ...marker }: ZoneMarkerProps) {
  const flowContext = useFlowContext();
  const { t } = useLocale();

  const [coachingOnly, setCoachingOnly] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  // Ids, not row objects: a claim replaces the row, and a stored object would
  // keep describing the row as it was when it was ticked.
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  // Mock persistence — page state only. A real app would POST the assignment to
  // its own QA backend and refetch.
  const [claims, setClaims] = useState<Record<string, Claim>>({});
  const [lastAction, setLastAction] = useState<string | null>(null);

  const ui = flowContext.ui;
  const navigate = flowContext.navigate;
  const me = flowContext.user?.displayName || COPY.fallbackReviewer;
  const { PageTemplate, DatagridTemplate } = ui?.templates || {};
  const {
    Alert,
    Box,
    Chip,
    FormControlLabel,
    Stack,
    Switch,
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableRow,
    Typography,
  } = ui || {};

  // `customControls` is a node, so memoize it — an inline element would be a new
  // reference every render and re-mount the switch on each keystroke in search.
  const coachingSwitch = useMemo(() => {
    if (!FormControlLabel || !Switch) return undefined;
    return (
      <FormControlLabel
        control={
          <Switch
            size='small'
            checked={coachingOnly}
            onChange={(_event: unknown, checked: boolean) =>
              setCoachingOnly(checked)
            }
          />
        }
        label={COPY.needsCoachingOnly}
      />
    );
  }, [FormControlLabel, Switch, coachingOnly]);

  // The fixture with this session's claims applied. `data` is expected to change
  // when the rows do — it is the column and action props that must hold still.
  const allRows = useMemo(
    () =>
      SAMPLE_QA_REVIEWS.map((row) =>
        claims[row.id] ? { ...row, ...claims[row.id] } : row,
      ),
    [claims],
  );

  const rows = useMemo(
    () =>
      coachingOnly
        ? allRows.filter((row) => row.status === 'Needs coaching')
        : allRows,
    [allRows, coachingOnly],
  );

  // The header action counts only what it would change: open calls not already
  // yours. Selecting a scored call or one you hold leaves the count alone.
  const assignable = useMemo(() => {
    const ids = new Set(selectedIds);
    return allRows.filter(
      (row) => ids.has(row.id) && isOpen(row) && row.reviewer !== me,
    );
  }, [allRows, selectedIds, me]);

  // `useCallback` so the memos below actually hold — a memo whose dependency is a
  // fresh function every render buys nothing. `setX` setters are already stable;
  // `me` only changes if the host swaps the signed-in user.
  const claim = useCallback(
    (ids: string[]) =>
      setClaims((previous) => ({
        ...previous,
        ...Object.fromEntries(
          ids.map((id) => [id, { reviewer: me, status: 'In review' as const }]),
        ),
      })),
    [me],
  );

  const handleRefresh = useCallback(() => {
    // Stands in for a refetch; `refreshing` drives the toolbar button's spinner.
    setRefreshing(true);
    setLastAction('Refreshed the review queue.');
    window.setTimeout(() => setRefreshing(false), 600);
  }, []);

  const handleSelectionChange = useCallback(
    (selectedRows: RecordingQaReview[]) =>
      setSelectedIds(selectedRows.map(getRowId)),
    [],
  );

  // Depends only on kit components (stable, from context) — so the grid's column
  // set is built once, not on every selection change or claim.
  const columns = useMemo<DatagridColumn<RecordingQaReview>[]>(
    () => [
      { field: 'title', headerName: 'Call', flex: 1, minWidth: 190 },
      { field: 'agent', headerName: 'Agent', width: 150 },
      {
        field: 'queue',
        headerName: 'Queue',
        type: 'singleSelect',
        valueOptions: QA_QUEUES,
        width: 120,
      },
      // Hidden by default via INITIAL_STATE; the Columns picker brings them back
      // and the choice persists per user.
      { field: 'party', headerName: 'Party', width: 150 },
      {
        field: 'direction',
        headerName: 'Direction',
        type: 'singleSelect',
        valueOptions: ['Inbound', 'Outbound'],
        width: 120,
      },
      {
        field: 'startedAt',
        headerName: 'Call date',
        type: 'dateTime',
        width: 180,
        // A `dateTime` column must receive a Date, not the raw ISO string — that
        // is what gives the filter panel date operators and sorts chronologically
        // rather than alphabetically. MUI X passes these args positionally.
        valueGetter: (_value: unknown, row: RecordingQaReview) =>
          new Date(row.startedAt),
        // `renderCell` rather than `valueFormatter`: a column with no renderCell
        // is rendered from the raw value, not the formatted one, so a formatter
        // alone would show the full JS date string on screen.
        renderCell: ({ row }: { row: RecordingQaReview }) =>
          formatRecordingStartedAt(row.startedAt),
        exportValue: ({ row }: { row: RecordingQaReview }) => row.startedAt,
      },
      {
        field: 'durationSec',
        headerName: 'Duration',
        type: 'number',
        width: 100,
        // Same reason — display goes through renderCell. The valueFormatter is
        // kept because CSV export *does* honour it.
        renderCell: ({ row }: { row: RecordingQaReview }) =>
          formatRecordingDuration(row.durationSec),
        valueFormatter: (value: unknown) =>
          formatRecordingDuration(value as number),
      },
      {
        field: 'reviewer',
        headerName: 'Reviewer',
        width: 150,
        renderCell: ({ row }: { row: RecordingQaReview }) =>
          row.reviewer || '—',
      },
      {
        field: 'score',
        headerName: 'Score',
        // A number column sorts 92 above 100 correctly and gets >, <, = filters.
        // Unscored rows hold `null`, which the grid sorts to one end.
        type: 'number',
        width: 90,
        renderCell: ({ row }: { row: RecordingQaReview }) =>
          row.score === null ? '—' : row.score,
      },
      {
        field: 'status',
        headerName: 'Status',
        type: 'singleSelect',
        valueOptions: QA_STATUSES,
        width: 150,
        renderCell: ({ row }: { row: RecordingQaReview }) =>
          Chip ? (
            <Chip
              size='small'
              label={row.status}
              color={STATUS_COLOR[row.status]}
            />
          ) : (
            row.status
          ),
        // The Chip is markup, so give CSV export a plain-text equivalent.
        exportValue: ({ row }: { row: RecordingQaReview }) => row.status,
      },
      {
        field: 'flags',
        headerName: 'Flags',
        flex: 1,
        minWidth: 220,
        sortable: false,
        // The field is an array. Join it so search and the "contains" filter
        // match a flag's text; the chips below are display only.
        valueGetter: (_value: unknown, row: RecordingQaReview) =>
          row.flags.join(', '),
        renderCell: ({ row }: { row: RecordingQaReview }) =>
          Chip && Box ? (
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, py: 0.5 }}>
              {row.flags.map((flag) => (
                <Chip
                  key={flag}
                  size='small'
                  variant='outlined'
                  label={flag}
                  color={flagColor(flag)}
                />
              ))}
            </Box>
          ) : (
            row.flags.join(', ')
          ),
        exportValue: ({ row }: { row: RecordingQaReview }) =>
          row.flags.join('; '),
      },
    ],
    [Box, Chip],
  );

  const actions = useMemo<DatagridAction<RecordingQaReview>[]>(
    () => [
      {
        label: 'Start review',
        icon: 'mdi:clipboard-check-outline',
        // A scored call is finished, so hide rather than disable.
        visible: (row: RecordingQaReview) => isOpen(row),
        disabled: (row: RecordingQaReview) =>
          row.status === 'In review' && row.reviewer !== me,
        getTooltip: (row: RecordingQaReview) =>
          row.status === 'In review'
            ? row.reviewer === me
              ? 'You are reviewing this call'
              : `${row.reviewer} is reviewing this call`
            : 'Assign to me and start the scorecard',
        onClick: (row: RecordingQaReview) => {
          claim([row.id]);
          setLastAction(`Started reviewing "${row.title}".`);
        },
      },
      {
        // Playback is the host's: Call Logs already plays and downloads every
        // recording. Link there rather than ship a second player.
        label: 'Listen in Call Logs',
        icon: 'mdi:play-circle-outline',
        getTooltip: () => 'Open Call Logs, where the recording plays',
        onClick: () => navigate?.(CALL_LOGS_PATH),
      },
    ],
    [claim, me, navigate],
  );

  const toolbar = useMemo(
    () => ({
      enableSearch: true,
      searchPlaceholder: COPY.searchPlaceholder,
      enableFilter: true,
      enableColumns: true,
      enableExport: true,
      exportFilename: COPY.exportFilename,
      enableRefresh: true,
      onRefresh: handleRefresh,
      refreshing,
      customControls: coachingSwitch,
    }),
    [handleRefresh, refreshing, coachingSwitch],
  );

  // Expanding a row shows the scorecard and the reviewer's notes — content the
  // columns can't hold. A kit `Table`, not a grid: five fixed lines need no
  // sorting or paging.
  const getDetailPanelContent = useCallback(
    ({ row }: { row: RecordingQaReview }) => {
      if (
        !Box ||
        !Stack ||
        !Typography ||
        !Table ||
        !TableHead ||
        !TableBody ||
        !TableRow ||
        !TableCell
      ) {
        return null;
      }
      return (
        <Box sx={{ p: 2 }}>
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={3}>
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography variant='subtitle2' gutterBottom>
                {COPY.scorecardHeading}
              </Typography>
              <Table size='small'>
                <TableHead>
                  <TableRow>
                    <TableCell>Criterion</TableCell>
                    <TableCell align='right'>Score</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {row.scorecard.map((line) => (
                    <TableRow key={line.label}>
                      <TableCell>{line.label}</TableCell>
                      <TableCell align='right'>
                        {line.score === null ? '—' : line.score} / {line.max}
                      </TableCell>
                    </TableRow>
                  ))}
                  <TableRow>
                    <TableCell>
                      <strong>Total</strong>
                    </TableCell>
                    <TableCell align='right'>
                      <strong>{row.score === null ? '—' : row.score}</strong> /
                      100
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
              {row.score === null ? (
                <Typography
                  variant='body2'
                  color='text.secondary'
                  sx={{ mt: 1 }}
                >
                  {COPY.notScored}
                </Typography>
              ) : null}
            </Box>
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography variant='subtitle2' gutterBottom>
                {COPY.notesHeading}
              </Typography>
              <Typography variant='body2' color='text.secondary'>
                {row.reviewerNotes || COPY.noNotes}
              </Typography>
              <Typography variant='body2' sx={{ mt: 1 }}>
                <strong>Reviewer:</strong> {row.reviewer || '—'} ·{' '}
                <strong>Queue:</strong> {row.queue}
              </Typography>
            </Box>
          </Stack>
        </Box>
      );
    },
    [Box, Stack, Typography, Table, TableHead, TableBody, TableRow, TableCell],
  );

  if (!PageTemplate || !DatagridTemplate || !Box || !Typography) {
    return (
      <div {...marker} style={{ padding: 24 }}>
        UI components not available
      </div>
    );
  }

  const skipped = selectedIds.length - assignable.length;

  return (
    // `layout="fill"` is the whole story for grid sizing: the info Alert above the
    // grid, the toolbar, and anything the host injects all take their height
    // first, and the grid absorbs the remainder — so its pagination row sits on
    // the bottom edge of the viewport. This page used to hand-tune
    // `height={'calc(100vh - 470px)'}` to achieve the same thing, which was only
    // correct until the banner above it changed.
    <PageTemplate
      layout='fill'
      {...marker}
      title={COPY.title}
      subtitle={COPY.subtitle}
      // `t` for the host's own vocabulary only — "My Account" is a key the host
      // ships. The page's own title is app copy; see recordingQaContent.ts.
      breadcrumbs={[
        { label: t?.('MY_ACCOUNT') ?? 'My Account', url: '/home/dashboard' },
        { label: COPY.title },
      ]}
      // Descriptors, not JSX — the host renders these as themed buttons in the
      // header. `disabled` and the label react to the grid's checkbox selection.
      //
      // Inline on purpose: PageTemplate does not cache against prop identity the
      // way the grid does, and this array has to change whenever the selection
      // does. The identity contract applies to the DatagridTemplate props below.
      actions={[
        {
          label: assignable.length
            ? `Assign ${assignable.length} selected to me`
            : COPY.assignNone,
          icon: 'mdi:account-check',
          variant: 'primary',
          disabled: assignable.length === 0,
          tooltip: assignable.length === 0 ? COPY.assignTooltip : undefined,
          onClick: () => {
            claim(assignable.map(getRowId));
            setLastAction(
              `Assigned ${assignable.length} call${assignable.length === 1 ? '' : 's'} to ${me}: ${assignable
                .map((row) => row.title)
                .join(', ')}.${
                skipped > 0
                  ? ` ${skipped} selected call${skipped === 1 ? ' was' : 's were'} already scored or yours, and left as ${skipped === 1 ? 'it was' : 'they were'}.`
                  : ''
              }`,
            );
          },
        },
      ]}
    >
      {/* No wrapper around these two on purpose. `layout="fill"` makes the page
          body a flex column with its own gap, and the grid fills what is left of
          it. A <Stack> here would sit in between as an ordinary content-sized flex
          item, and the grid would size to the Stack instead of to the page — which
          is what used to be hidden by the hand-tuned `height`. */}
      {Alert && (
        <Alert severity={lastAction ? 'success' : 'info'}>
          {lastAction ?? COPY.intro}
        </Alert>
      )}

      <DatagridTemplate
        data={rows}
        getRowId={getRowId}
        columns={columns}
        actions={actions}
        toolbar={toolbar}
        enableCheckboxSelection
        onSelectionChange={handleSelectionChange}
        initialState={INITIAL_STATE}
        getDetailPanelContent={getDetailPanelContent}
        getDetailPanelHeight={getDetailPanelHeight}
        defaultPageSize={25}
        pageSizeOptions={PAGE_SIZE_OPTIONS}
      />
    </PageTemplate>
  );
}
