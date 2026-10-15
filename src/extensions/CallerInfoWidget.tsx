/**
 * Caller Info Widget
 * Displays enriched caller information in the incoming call widget
 * Shows data fetched based on call events
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
  // context.theme is injected by DynamicExtensionRenderer via useColorScheme()
  // and updated as a prop whenever the host theme changes — always correct on
  // first render, no event subscription needed.
  const { Paper, Stack, Typography, Divider, Icon } = context.ui ?? {};

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
  // Only render when there's a ringing call AND the CRM actually matched it.
  // With no enrichment data the card would be an empty bordered box, so we hide
  // the zone entirely instead.
  const hasCrmData =
    !!ringingCall &&
    !!(
      ringingCall.company ||
      ringingCall.lastContact ||
      ringingCall.notes ||
      (ringingCall.callCount ?? 0) > 0
    );
  if (!ringingCall || !hasCrmData || !Paper || !Stack || !Typography) {
    return null;
  }

  return (
    <Paper {...marker} variant='outlined' sx={{ p: 1.5, mb: 2 }}>
      <Stack spacing={1}>
        {ringingCall.company && (
          <Stack direction='row' spacing={1} alignItems='center'>
            {Icon && (
              <Icon
                icon='mdi:office-building'
                sx={{ fontSize: 18, color: 'text.secondary' }}
              />
            )}
            <Typography variant='subtitle2' fontWeight={600}>
              {ringingCall.company}
            </Typography>
          </Stack>
        )}

        {ringingCall.lastContact && (
          <Stack direction='row' spacing={1} alignItems='center'>
            {Icon && (
              <Icon
                icon='mdi:clock-outline'
                sx={{ fontSize: 16, color: 'text.secondary' }}
              />
            )}
            <Typography variant='caption' color='text.secondary'>
              Last contact: {ringingCall.lastContact}
            </Typography>
          </Stack>
        )}

        {ringingCall.callCount !== undefined && ringingCall.callCount > 0 && (
          <Stack direction='row' spacing={1} alignItems='center'>
            {Icon && (
              <Icon
                icon='mdi:phone'
                sx={{ fontSize: 16, color: 'text.secondary' }}
              />
            )}
            <Typography variant='caption' color='text.secondary'>
              {ringingCall.callCount} previous calls
            </Typography>
          </Stack>
        )}

        {ringingCall.notes && (
          <>
            {Divider && <Divider />}
            <Typography
              variant='caption'
              color='text.secondary'
              sx={{ fontStyle: 'italic' }}
            >
              {ringingCall.notes}
            </Typography>
          </>
        )}
      </Stack>
    </Paper>
  );
}
