/**
 * Activity fixtures for the dashboard widgets in `src/widgets/`.
 *
 * Two feeds, both about the integration rather than about the phones:
 *
 * - {@link buildCallFeed} — calls, each matched or not to the CRM directory
 *   (`mocks/crm.ts`). The Call volume chart buckets them as CRM-matched vs
 *   unmatched. The host already charts answered vs missed calls on its own
 *   dashboard; the match rate is the number only the integration has.
 * - {@link buildAppEventFeed} — what THIS APP did in the CRM: contacts synced,
 *   leads created from unknown callers, call notes written back. The Recent
 *   activity panel lists them. It used to list answered / missed calls, which
 *   is Call Logs again; an app's own events are the feed no host screen has.
 *
 * Unlike every other fixture in this folder, these timestamps are built
 * **relative to a caller-supplied `now`**. Both widgets filter by
 * `widget.range` — the resolved from/to window a dashboard hands a widget that
 * follows the shared range — and `callRecordings.ts` pins its dates to a fixed
 * month so table sorting stays stable under test. A widget fixture pinned the
 * same way would fall outside every preset the dashboard's range control
 * offers, and the panel would read as broken rather than as filtered.
 *
 * `now` is a parameter rather than a `Date.now()` read in here, so a render stays
 * a pure function of its inputs: the widget passes `widget.range.to`, and two
 * renders of the same window produce the same feed.
 */
import { lookupCrmRecord, MOCK_CRM_DIRECTORY } from './crm';
import { INTERNAL_PEOPLE } from './people';

// ── Calls, matched to the CRM ────────────────────────────────────────────────

export interface MatchedCall {
  id: string;
  /** The other party — E.164 or an extension, as the CDR feed reports it. */
  party: string;
  /** The CRM account the party resolved to, if any. */
  account?: string;
  /** ISO 8601, resolved against the `now` passed to {@link buildCallFeed}. */
  at: string;
}

/**
 * Who called, cycled. Five of the eight resolve in the CRM directory, so the
 * chart's split is visibly uneven without being all one colour.
 */
const CALL_PARTIES = [
  '+15551234567',
  '+13025551000',
  '+15559876543',
  '+14155550142',
  '+15555555555',
  '2009',
  '+17705550188',
  '3832',
];

/** How many calls the feed holds; spaced so a 24h window and a 30d one both fill. */
const CALL_COUNT = 48;

/**
 * The feed, newest first. Minutes-ago grow geometrically (about 4 minutes to
 * about 3 weeks), so the shorter range presets visibly cut it down.
 */
export function buildCallFeed(now: Date): MatchedCall[] {
  return Array.from({ length: CALL_COUNT }, (_, index): MatchedCall => {
    const party = CALL_PARTIES[index % CALL_PARTIES.length];
    const minutes = Math.round(4 * 1.2 ** index);
    return {
      id: `call-${String(index + 1).padStart(2, '0')}`,
      party,
      account: lookupCrmRecord(party)?.company,
      at: new Date(now.getTime() - minutes * 60_000).toISOString(),
    };
  });
}

// ── What the app did in the CRM ──────────────────────────────────────────────

export type AppEventKind = 'contact-synced' | 'lead-created' | 'note-written';

export interface AppEvent {
  id: string;
  kind: AppEventKind;
  /** The CRM account or, for a new lead, the number it was created from. */
  subject: string;
  /** One line on what happened. */
  detail: string;
  /** The agent whose call caused it, from the shared directory. */
  agent: string;
  /** ISO 8601, resolved against the `now` passed to {@link buildAppEventFeed}. */
  at: string;
}

/**
 * Minutes before `now`, ascending. Deliberately spread from a few minutes to
 * ~three weeks back, so the shorter presets on the dashboard's range control
 * (an hour, a day) visibly cut the list down instead of returning everything.
 */
const MINUTES_AGO = [
  4, 12, 27, 51, 88, 143, 219, 305, 486, 742, 1_090, 1_615, 2_480, 3_270, 4_640,
  6_120, 8_450, 11_300, 15_700, 21_800, 28_900,
];

/** Cycled so every kind appears, with notes written back the plurality. */
const KINDS: readonly AppEventKind[] = [
  'note-written',
  'contact-synced',
  'lead-created',
  'note-written',
  'contact-synced',
  'note-written',
  'lead-created',
];

const ACCOUNTS = Object.values(MOCK_CRM_DIRECTORY);

/** The callers the CRM did not know — each one became a lead. */
const UNKNOWN_CALLERS = CALL_PARTIES.filter((p) => !lookupCrmRecord(p));

/**
 * The feed, newest first, with every timestamp resolved against `now`.
 *
 * Cheap enough to call on every range change: 21 rows, no allocation beyond the
 * array itself.
 */
export function buildAppEventFeed(now: Date): AppEvent[] {
  return MINUTES_AGO.map((minutes, index): AppEvent => {
    const kind = KINDS[index % KINDS.length];
    const account = ACCOUNTS[index % ACCOUNTS.length];
    const agent = INTERNAL_PEOPLE[index % INTERNAL_PEOPLE.length].name;
    const at = new Date(now.getTime() - minutes * 60_000).toISOString();
    const id = `app-event-${String(index + 1).padStart(2, '0')}`;
    switch (kind) {
      case 'lead-created': {
        const number = UNKNOWN_CALLERS[index % UNKNOWN_CALLERS.length];
        return {
          id,
          kind,
          subject: number,
          detail: 'Unknown caller — lead created and assigned',
          agent,
          at,
        };
      }
      case 'contact-synced':
        return {
          id,
          kind,
          subject: account.company,
          detail: `${account.name} updated from Flow`,
          agent,
          at,
        };
      default:
        return {
          id,
          kind,
          subject: account.company,
          detail: `Call note on ${account.name} written back`,
          agent,
          at,
        };
    }
  });
}
