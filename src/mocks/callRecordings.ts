/**
 * Sample call recordings — the source the Recording QA review queue
 * (`recordingQaReviews.ts`) and the "Recordings processed" dashboard stat
 * (`widgets/RecordedCallsStat.tsx`) are both built from. No page lists these
 * directly any more: Call Logs already plays and downloads recordings, so a
 * recordings list here would only duplicate the host.
 *
 * Generated deterministically from an index rather than written out row by row:
 * the page needs more rows than one page holds so the pagination footer actually
 * pages (a fixture smaller than `defaultPageSize` leaves every page control
 * correctly disabled, which reads as "pagination is broken"). Deterministic also
 * means the Playwright suite can assert on specific rows.
 */

export type RecordingStatus = 'Processed' | 'Processing' | 'Failed';

export interface CallRecording {
  id: string;
  /** Display label for the recording. */
  title: string;
  /** The other party's number, E.164-ish. */
  party: string;
  direction: 'Inbound' | 'Outbound';
  /** ISO 8601 — a real `dateTime` column, not a pre-formatted string. */
  startedAt: string;
  durationSec: number;
  sizeMb: number;
  status: RecordingStatus;
  starred: boolean;
  notes: string;
  transcriptExcerpt: string;
}

const PARTIES = [
  '+13025551000',
  '+14155550142',
  '+17705550188',
  '+12065550117',
  '+19045550163',
  '+16305550175',
  '+18585550129',
];

const SUBJECTS = [
  'Quarterly review',
  'Support escalation',
  'New order intake',
  'Billing question',
  'Onboarding walkthrough',
  'Renewal discussion',
  'Voicemail follow-up',
];

const NOTES = [
  'Customer asked for a written summary.',
  'Escalated to tier 2.',
  '',
  'Left a callback number.',
  '',
  'Contract sent for signature.',
  '',
];

const TRANSCRIPTS = [
  '…so if we move the renewal to the first of the month, that works on our end.',
  '…the handset reboots whenever the second line rings, which started Tuesday.',
  '…I can get you the purchase order number this afternoon.',
  '…the invoice shows two lines we already cancelled last quarter.',
  '…walk me through porting the main number without downtime.',
  '…we would like to add eight seats before the term ends.',
  '…tried you earlier, calling back about the ticket from this morning.',
];

/** Statuses cycle so every filter/`singleSelect` option has matching rows. */
function statusFor(index: number): RecordingStatus {
  if (index % 11 === 4) return 'Failed';
  if (index % 7 === 3) return 'Processing';
  return 'Processed';
}

function pad(value: number): string {
  return String(value).padStart(2, '0');
}

/**
 * Fixed base date so rows never shift under a test run. Dates walk backwards one
 * row at a time, which gives the default `startedAt` descending sort something
 * meaningful to order.
 */
function startedAtFor(index: number): string {
  const day = 28 - (index % 28);
  const hour = 8 + (index % 9);
  const minute = (index * 7) % 60;
  return `2026-06-${pad(day)}T${pad(hour)}:${pad(minute)}:00Z`;
}

export const SAMPLE_CALL_RECORDINGS: CallRecording[] = Array.from(
  { length: 42 },
  (_, index): CallRecording => {
    const status = statusFor(index);
    return {
      id: `rec-${pad(index + 1)}`,
      title: `${SUBJECTS[index % SUBJECTS.length]} #${index + 1}`,
      party: PARTIES[index % PARTIES.length],
      direction: index % 3 === 0 ? 'Outbound' : 'Inbound',
      startedAt: startedAtFor(index),
      // Failed recordings have no usable audio, so no duration or size.
      durationSec: status === 'Failed' ? 0 : 45 + ((index * 37) % 1800),
      sizeMb:
        status === 'Failed' ? 0 : Number((0.4 + (index % 9) * 0.35).toFixed(1)),
      status,
      starred: index % 5 === 0,
      notes: NOTES[index % NOTES.length],
      transcriptExcerpt: TRANSCRIPTS[index % TRANSCRIPTS.length],
    };
  },
);

/** Seconds → `m:ss`, used by the duration column. */
export function formatRecordingDuration(seconds: number): string {
  if (!seconds) return '—';
  const minutes = Math.floor(seconds / 60);
  return `${minutes}:${pad(seconds % 60)}`;
}

/** ISO timestamp → the viewer's locale, short date + time, for the Started column. */
export function formatRecordingStartedAt(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}
