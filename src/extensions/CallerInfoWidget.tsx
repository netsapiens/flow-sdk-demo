/**
 * Caller Info Widget
 *
 * The CRM's view of whoever is ringing, in the incoming call card
 * (`inbound-call-content`). Flow already draws the caller's avatar, name and
 * number just above this zone; the card adds what only the CRM knows.
 *
 * Laid out to read at a glance while the phone rings:
 *   - a header: the CRM's name for the caller, and their company
 *   - one row of facts: last contact, previous calls
 *   - the CRM's notes, clipped to two lines
 *
 * Kit components only, with palette-path colours, so the card follows the
 * tenant theme and dark mode. The lookup is synchronous (see callEnrichment),
 * so the card arrives complete with the ring: there is no loading state to
 * hold a place for.
 */
import type { ExtensionComponentProps } from '@netsapiens/flow-sdk';
import { useEffect, useState } from 'react';

import type { CallerInfo } from '../services/callEnrichment';
import { type ZoneMarkerProps } from '../integration/withZoneTestId';
import { activeCallsStore, onCallChanges } from '../services/callEnrichment';

export function CallerInfoWidget({
  context,
  ...marker
}: ExtensionComponentProps & ZoneMarkerProps) {
  const [activeCalls, setActiveCalls] = useState<CallerInfo[]>([]);

  useEffect(() => {
    // activeCallsStore holds every active call; the enrichment service (fed by
    // the softphone stream in App.tsx) tells us when it changes. Read it once
    // now, so a card mounted mid-call has something to show.
    const sync = () => setActiveCalls(Array.from(activeCallsStore.values()));
    sync();
    return onCallChanges({ updated: sync, removed: sync });
  }, []);

  const ringingCall = activeCalls.find((call) => call.status === 'ringing');
  if (!ringingCall) return null;
  return <CallerCard context={context} caller={ringingCall} {...marker} />;
}

/**
 * The card itself, for one caller. Separate from the widget so it can be drawn
 * from any record, not only the one that is ringing.
 */
export function CallerCard({
  context,
  caller,
  ...marker
}: Pick<ExtensionComponentProps, 'context'> &
  ZoneMarkerProps & { caller: CallerInfo }) {
  const { Paper, Stack, Typography, Divider, Icon } = context.ui ?? {};

  // Only once the CRM has matched the caller. With nothing to add the card
  // would be an empty box under Flow's own name and number, so the zone stays
  // empty instead.
  const previousCalls = caller.callCount ?? 0;
  const hasCrmData = !!(
    caller.company ||
    caller.lastContact ||
    caller.notes ||
    previousCalls > 0
  );
  if (!hasCrmData || !Paper || !Stack || !Typography) return null;

  const heading = [caller.callerName, caller.company]
    .filter(Boolean)
    .join(' · ');

  const fact = (icon: string, label: string) => (
    <Stack direction='row' spacing={0.5} alignItems='center' minWidth={0}>
      {Icon && (
        <Icon
          icon={icon}
          sx={{ fontSize: 16, color: 'text.secondary', flexShrink: 0 }}
        />
      )}
      <Typography variant='caption' color='text.secondary' noWrap>
        {label}
      </Typography>
    </Stack>
  );

  return (
    <Paper {...marker} variant='outlined' sx={{ p: 1.5, mb: 2 }}>
      <Stack spacing={0.75}>
        {heading && (
          <Typography variant='subtitle2' fontWeight={600} noWrap>
            {heading}
          </Typography>
        )}

        {(caller.lastContact || previousCalls > 0) && (
          <Stack direction='row' spacing={1.5} alignItems='center'>
            {caller.lastContact &&
              fact('mdi:clock-outline', caller.lastContact)}
            {previousCalls > 0 &&
              fact(
                'mdi:phone-outline',
                previousCalls === 1 ? '1 call' : `${previousCalls} calls`,
              )}
          </Stack>
        )}

        {caller.notes && (
          <>
            {Divider && <Divider sx={{ my: 0.5 }} />}
            <Typography
              variant='body2'
              color='text.secondary'
              title={caller.notes}
              sx={{
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden',
              }}
            >
              {caller.notes}
            </Typography>
          </>
        )}
      </Stack>
    </Paper>
  );
}
