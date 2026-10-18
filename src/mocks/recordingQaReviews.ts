/**
 * Sample rows for the Recording QA review page (`pages/RecordingQaReviewPage.tsx`).
 *
 * A quality-review queue is data the host does not have. Flow already plays and
 * downloads a recording from each Call Logs row, so a page that listed
 * recordings again would only be a second, worse Call Logs; what an app can add
 * is the layer on top — who reviewed the call, what they scored it, what they
 * flagged. That is the shape a real QA integration takes, and it is all mock.
 *
 * Derived from `SAMPLE_CALL_RECORDINGS` rather than written separately: only a
 * recording that finished processing has audio a reviewer can listen to, so the
 * queue is the processed subset. It also keeps this page and the "Recordings
 * processed" dashboard stat (`widgets/RecordedCallsStat.tsx`) telling one story.
 *
 * Deterministic from the index for the same reasons as its source: enough rows
 * that the pagination footer actually pages, and stable values the Playwright
 * suite can assert on.
 */
import type { CallRecording } from './callRecordings';
import { SAMPLE_CALL_RECORDINGS } from './callRecordings';

export type QaStatus = 'To review' | 'In review' | 'Passed' | 'Needs coaching';

export const QA_STATUSES: QaStatus[] = [
  'To review',
  'In review',
  'Passed',
  'Needs coaching',
];

/** One line of the scorecard; the five `max` values add up to 100. */
export interface QaCriterion {
  label: string;
  max: number;
  /** `null` until a reviewer has scored it. */
  score: number | null;
}

export interface RecordingQaReview {
  id: string;
  /** The recording under review, in `callRecordings.ts`. */
  recordingId: string;
  /** Call subject, carried over from the recording. */
  title: string;
  agent: string;
  queue: string;
  party: string;
  direction: CallRecording['direction'];
  /** ISO 8601, so the page can give the grid a real `dateTime` column. */
  startedAt: string;
  durationSec: number;
  /** Empty while nobody has picked the call up. */
  reviewer: string;
  /** 0–100, the scorecard total; `null` until the call has been scored. */
  score: number | null;
  status: QaStatus;
  /** Issues raised by the reviewer, or by the pre-screen before one is assigned. */
  flags: string[];
  scorecard: QaCriterion[];
  reviewerNotes: string;
}

export const QA_QUEUES = ['Support', 'Sales', 'Billing', 'Onboarding'];

const AGENTS = [
  'Alice Williams',
  'Bob Martinez',
  'Tony Friar',
  'Priya Natarajan',
  'Marcus Hale',
];

const REVIEWERS = ['Dana Ortiz', 'Sam Okafor', 'Lee Whitfield'];

const CRITERIA: ReadonlyArray<Omit<QaCriterion, 'score'>> = [
  { label: 'Greeting and verification', max: 15 },
  { label: 'Compliance disclosure', max: 20 },
  { label: 'Issue resolution', max: 30 },
  { label: 'Empathy and tone', max: 20 },
  { label: 'Wrap-up and next steps', max: 15 },
];

/** Notes keyed by outcome, so a "Passed" row never reads like a coaching note. */
const PASS_NOTES = [
  'Clean call. Good use of the customer’s name throughout.',
  'Verified identity before discussing the account. Model wrap-up.',
  'Resolved on first contact; summary email offered unprompted.',
];

const COACHING_NOTES = [
  'Skipped the recording disclosure at the top of the call. Review the script.',
  'Long silence while searching the account — narrate what you are doing.',
  'Promised a callback without booking it. Use the follow-up task.',
];

/** Every fourth row is untouched, the next is in progress, the rest are scored. */
function stageFor(index: number): 'queued' | 'claimed' | 'scored' {
  if (index % 4 === 0) return 'queued';
  if (index % 4 === 1) return 'claimed';
  return 'scored';
}

/**
 * Per-criterion scores, deterministic from the row index. Every third scored row
 * drops points on compliance and resolution so "Needs coaching" has matches and
 * the filter has something to show.
 */
function scoreCriteria(index: number): QaCriterion[] {
  const weak = index % 3 === 0;
  return CRITERIA.map((criterion, position) => {
    const dip = (index + position) % 4;
    const ratio =
      weak && position >= 1 && position <= 2 ? 0.45 : 1 - dip * 0.06;
    return { ...criterion, score: Math.round(criterion.max * ratio) };
  });
}

function flagsFor(
  recording: CallRecording,
  scorecard: QaCriterion[],
  index: number,
): string[] {
  const flags: string[] = [];
  const compliance = scorecard[1];
  if (compliance.score !== null && compliance.score < compliance.max / 2) {
    flags.push('Compliance phrase missed');
  }
  // Pre-screen flags, raised before a reviewer listens — which is why queued
  // rows can carry them too.
  if (recording.durationSec > 1500) flags.push('Long hold');
  if (recording.title.startsWith('Support escalation')) {
    flags.push('Escalation');
  }
  if (index % 9 === 5) flags.push('Negative sentiment');
  return flags;
}

export const SAMPLE_QA_REVIEWS: RecordingQaReview[] =
  SAMPLE_CALL_RECORDINGS.filter(
    (recording) => recording.status === 'Processed',
  ).map((recording, index): RecordingQaReview => {
    const stage = stageFor(index);
    const scored = scoreCriteria(index);
    const scorecard =
      stage === 'scored'
        ? scored
        : CRITERIA.map((criterion) => ({ ...criterion, score: null }));
    const score =
      stage === 'scored'
        ? scorecard.reduce((total, line) => total + (line.score ?? 0), 0)
        : null;
    const status: QaStatus =
      stage === 'queued'
        ? 'To review'
        : stage === 'claimed'
          ? 'In review'
          : (score ?? 0) >= 80
            ? 'Passed'
            : 'Needs coaching';
    const notes = status === 'Passed' ? PASS_NOTES : COACHING_NOTES;

    return {
      id: `qa-${recording.id}`,
      recordingId: recording.id,
      title: recording.title,
      agent: AGENTS[index % AGENTS.length],
      queue: QA_QUEUES[index % QA_QUEUES.length],
      party: recording.party,
      direction: recording.direction,
      startedAt: recording.startedAt,
      durationSec: recording.durationSec,
      reviewer: stage === 'queued' ? '' : REVIEWERS[index % REVIEWERS.length],
      score,
      status,
      flags: flagsFor(recording, scorecard, index),
      scorecard,
      reviewerNotes: stage === 'scored' ? notes[index % notes.length] : '',
    };
  });
