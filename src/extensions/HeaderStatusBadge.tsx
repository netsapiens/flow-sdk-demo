/**
 * Header Status Badge Extension
 * Zone: `page-header-secondary` — secondary content beside the page title
 * (badges, status indicators). Renders via Flow's PageHeader / PageTemplate.
 */
import type { ExtensionComponentProps } from '@netsapiens/flow-sdk';

import { type ZoneMarkerProps } from '../integration/withZoneTestId';

export function HeaderStatusBadge({
  context,
  ...marker
}: ExtensionComponentProps & ZoneMarkerProps) {
  const { Chip } = context.ui ?? {};

  // Fallback if the host UI surface is unavailable
  if (!Chip) {
    return (
      <span
        {...marker}
        style={{
          padding: '2px 8px',
          borderRadius: 12,
          background: '#10b98120',
          color: '#10b981',
          fontSize: 12,
          fontWeight: 600,
        }}
      >
        ● Live
      </span>
    );
  }

  return (
    <Chip
      {...marker}
      size='small'
      color='success'
      variant='outlined'
      label='● Live (Demo Extension)'
    />
  );
}
