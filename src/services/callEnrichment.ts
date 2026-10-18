/**
 * Call enrichment service.
 *
 * Bridges the SDK's live call-event stream to the demo's UI: when a call rings
 * in, it looks the caller up in the mock CRM (`mocks/crm.ts`), stores the
 * enriched record, and tells the app's own listeners (`onCallChanges`) so the
 * `CallerInfoWidget` and the Live calls widget can render it. On call-ended it
 * clears the record.
 *
 * App-internal on purpose: these components live in the same bundle, so a
 * module-level listener set is all they need. The host's event bus is not part
 * of the SDK's public surface (flow-sdk 0.3.6), and was never meant for an
 * app talking to itself.
 *
 * In production the CRM lookup would be a real API call; everything else (the
 * store + event contract) would stay the same.
 */
import type { CallEvent } from '@netsapiens/flow-sdk';

import type { CrmRecord } from '../mocks/crm';
import { lookupCrmRecord, normalizePhoneNumber } from '../mocks/crm';

/** The vendor CRM this demo "calls" to enrich a caller. */
const VENDOR_NAME = 'Example CRM';
const VENDOR_CRM_BASE_URL = 'https://app.example-crm.example';

/**
 * Resolve a caller from the CRM, logging the request/response.
 *
 * In production this is a real authenticated request to the vendor CRM, with a
 * token from `auth.requestRemoteAuth` — the handshake sketched in the header of
 * `pages/CrmIntegrationPage.tsx` and run live on the Remote Auth tab. Here it
 * resolves from the mock directory, but we log the GET it *would* make (with the
 * remoteAuth-brokered token) and the record it returns, so the third-party CRM
 * call behind the caller card is visible in the console on each incoming call.
 */
function fetchCrmContact(phone: string): CrmRecord | undefined {
  const url = `${VENDOR_CRM_BASE_URL}/api/contacts/lookup?phone=${encodeURIComponent(phone)}`;
  console.groupCollapsed(
    `%c[${VENDOR_NAME}]%c CRM lookup for ${phone}`,
    'color:#7b61ff;font-weight:600',
    'color:inherit',
  );
  console.info('→ GET', url);
  console.info('  headers', {
    Authorization: 'Bearer <vendor token from auth.requestRemoteAuth>',
  });

  const record = lookupCrmRecord(phone);
  if (record) {
    console.info('← 200 OK', record);
  } else {
    console.info(`← 404 Not Found — no contact for ${phone}`);
  }
  console.groupEnd();
  return record;
}

/** Enriched active-call record shared between this service and CallerInfoWidget. */
export interface CallerInfo {
  callId: string;
  from: string;
  to: string;
  direction: 'inbound' | 'outbound';
  status: 'ringing' | 'answered' | 'missed' | 'ended';
  timestamp: number;
  callerName?: string;
  company?: string;
  lastContact?: string;
  notes?: string;
  callCount?: number;
  /** The CRM's tier and open deal, for the console's flags (see mocks/crm.ts). */
  tier?: CrmRecord['tier'];
  opportunity?: CrmRecord['opportunity'];
}

/** In-memory store of active calls, shared across component instances. */
export const activeCallsStore = new Map<string, CallerInfo>();

/** What a component hears about active calls (see onCallChanges). */
export interface CallListener {
  /** A call was added or changed; the record is also in activeCallsStore. */
  updated?: (call: CallerInfo) => void;
  /** A call ended; it has already left activeCallsStore. */
  removed?: (callId: string) => void;
}

const listeners = new Set<CallListener>();

/**
 * Listen for active-call changes. Returns the function that stops listening;
 * call it from the effect's cleanup.
 */
export function onCallChanges(listener: CallListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function statusForEvent(type: CallEvent['type']): CallerInfo['status'] {
  if (type === 'call-answered') return 'answered';
  if (type === 'call-missed') return 'missed';
  return 'ringing';
}

/**
 * Build a softphone call handler. Pass the result to the
 * `sdk.streams.softphone` methods (see App.tsx). Updates `activeCallsStore`
 * and tells every `onCallChanges` listener.
 *
 * A `CallEvent` names the other party (`remote`) rather than from/to, so the
 * direction decides which side the user's own extension was on.
 */
export function createCallEventHandler(ownExtension = '') {
  return (event: CallEvent) => {
    if (event.type === 'call-ended') {
      activeCallsStore.delete(event.callId);
      listeners.forEach((l) => l.removed?.(event.callId));
      return;
    }

    const remote = event.remote.number;
    const record = fetchCrmContact(normalizePhoneNumber(remote));
    const inbound = event.direction === 'inbound';

    const enriched: CallerInfo = {
      callId: event.callId,
      from: inbound ? remote : ownExtension,
      to: inbound ? ownExtension : remote,
      direction: event.direction,
      status: statusForEvent(event.type),
      timestamp: Date.now(),
      callerName: record?.name ?? event.remote.name,
      company: record?.company,
      lastContact: record?.lastContact,
      notes: record?.notes,
      callCount: record?.callCount,
      tier: record?.tier,
      opportunity: record?.opportunity,
    };

    activeCallsStore.set(event.callId, enriched);
    listeners.forEach((l) => l.updated?.(enriched));
  };
}
