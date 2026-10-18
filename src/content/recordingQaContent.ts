/**
 * Copy for the Recording QA review page (`pages/RecordingQaReviewPage.tsx`).
 *
 * Kept out of the page for the same reason `demoContent.ts` is: a page file is
 * layout. Plain strings only — no colour, size or spacing lives here.
 *
 * None of these go through `t()`. The host's translation catalog has keys for
 * its own pages ("My Account", "Notes"), not for an app's, and `t` is i18next's,
 * whose default for a key it has never heard of is the key, not `undefined` — so
 * `t?.('RECORDING_QA_REVIEW') ?? '…'` would put `RECORDING_QA_REVIEW` on screen.
 * Use `t` for host vocabulary; ship your own strings for your own vocabulary.
 */

export const RECORDING_QA_COPY = {
  title: 'Recording QA review',
  // Says "example data" in the header itself, so nobody mistakes the scores for
  // the platform's.
  subtitle:
    'Example data — a mock queue of recorded calls awaiting quality review. Nothing here is read from or written to Flow.',
  intro:
    'Every control on this grid — search, filter, columns, export, refresh, selection and the pagination footer — comes from DatagridTemplate. Only the "Needs coaching only" switch is app-specific. Expand a row for its scorecard; listening to the call is Call Logs’ job, so the row action links there instead of shipping a second player.',
  needsCoachingOnly: 'Needs coaching only',
  searchPlaceholder: 'Search calls, agents, reviewers or flags…',
  exportFilename: 'recording-qa-review',
  assignNone: 'Assign selected to me',
  assignTooltip: 'Select calls that are still to review or in review',
  scorecardHeading: 'Scorecard',
  notScored: 'Not scored yet — the scorecard fills in once a reviewer submits.',
  notesHeading: 'Reviewer notes',
  noNotes: 'No notes yet.',
  /** Who "me" is when the host has no display name for the session. */
  fallbackReviewer: 'You',
} as const;

/** Where the host plays a recording: My Account → Call Logs. */
export const CALL_LOGS_PATH = '/home/call-logs';
