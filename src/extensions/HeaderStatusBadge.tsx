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

  // Kit unavailable: plain, uncoloured text. A hand-drawn pill here would be
  // the one thing on the header that ignores the tenant theme and the toggle.
  if (!Chip) {
    return <span {...marker}>Live</span>;
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
