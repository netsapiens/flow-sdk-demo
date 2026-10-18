/**
 * The join this page exists for: Flow's live calls, matched to the (mock) CRM.
 *
 * The host already draws queues, agents and phones — its supervisor dashboard,
 * its wallboard, its registrations page. What it cannot draw is anything that
 * depends on a fact only the partner's system holds: that the caller waiting in
 * Sales is a VIP, that the agent on line three is talking to an account with a
 * $48k renewal in negotiation. Those views are what an app is for, and every
 * one of them is the same two inputs: a party off a stream, and a CRM lookup.
 *
 * Pure functions over `CallActivity` and the CRM fixture. No React and no
 * subscriptions, so the trend sampler in liveFeeds.ts and the cards share one
 * definition of "a known customer".
 */
import type { CallActivity, CallParty } from '@netsapiens/flow-sdk';

import type { CrmRecord } from '../../mocks/crm';
import { matchCrmParty } from '../../mocks/crm';

/** A call whose other party resolved to a CRM account. */
export interface AccountOnCall {
  call: CallActivity;
  record: CrmRecord;
  /** The side of the call the account is on. */
  party: CallParty;
}

/** VIPs first, then accounts with an open deal, then everyone else known. */
export function rankOf(record: CrmRecord): number {
  if (record.tier === 'vip') return 0;
  if (record.opportunity) return 1;
  return 2;
}

/**
 * The account between two parties, seen from no particular side. Both can
 * match (two colleagues on the demo domain both have records), so take the one
 * the CRM cares about more, and the caller on a tie. Takes anything with
 * `from` and `to`, so a live call and a finished call record share it.
 */
export function accountBetween(ends: {
  from: CallParty;
  to: CallParty;
}): { record: CrmRecord; party: CallParty } | null {
  const from = matchCrmParty(ends.from);
  const to = matchCrmParty(ends.to);
  if (from && (!to || rankOf(from) <= rankOf(to)))
    return { record: from, party: ends.from };
  if (to) return { record: to, party: ends.to };
  return null;
}

/** The account on a live call, if either end is in the CRM. */
export function accountOf(call: CallActivity): AccountOnCall | null {
  const match = accountBetween(call);
  return match ? { call, ...match } : null;
}

/**
 * The account an agent is talking to: the call they are a party to, and the
 * CRM record of whoever is on the OTHER end. Null when they are on no call the
 * domain feed has shown, or the other end is not in the CRM.
 */
export function accountForAgent(
  user: string,
  calls: CallActivity[],
): AccountOnCall | null {
  for (const call of calls) {
    const other =
      call.to.user === user
        ? call.from
        : call.from.user === user
          ? call.to
          : null;
    if (!other) continue;
    const record = matchCrmParty(other);
    return record ? { call, record, party: other } : null;
  }
  return null;
}

/**
 * Every call in progress whose party is in the CRM, most important first:
 * tier, then deal value, then whoever has been on longest.
 */
export function accountsOnTheLine(calls: CallActivity[]): AccountOnCall[] {
  return calls
    .map(accountOf)
    .filter((a): a is AccountOnCall => a !== null)
    .sort(
      (a, b) =>
        rankOf(a.record) - rankOf(b.record) ||
        (b.record.opportunity?.value ?? 0) -
          (a.record.opportunity?.value ?? 0) ||
        a.call.startedAt.localeCompare(b.call.startedAt),
    );
}

/**
 * Calls with an outside party the CRM has never heard of — the leads an agent
 * should be creating. A party with a `user` is a subscriber on the platform,
 * not a prospect, so an unmatched call between two extensions is not listed.
 */
export function unknownCallers(
  calls: CallActivity[],
): { call: CallActivity; party: CallParty }[] {
  return calls.flatMap((call) => {
    if (accountOf(call)) return [];
    const outside = !call.from.user
      ? call.from
      : !call.to.user
        ? call.to
        : null;
    return outside ? [{ call, party: outside }] : [];
  });
}

/**
 * A call still waiting for someone: ringing, and routed through a queue, an
 * auto attendant or a transfer. The domain feed carries no per-caller queue
 * position (that is `queues.onQueue`'s `waiting`), so this is the closest the
 * domain-wide view gets to "in the queue".
 */
export const isWaiting = (call: CallActivity) =>
  call.state === 'ringing' && call.through !== null;
