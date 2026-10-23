import type { ExtensionComponentProps } from '@netsapiens/flow-sdk';
import { useSidePanel } from '@netsapiens/flow-sdk';

import { markPanel } from '../integration/panelMarker';
import { type ZoneMarkerProps } from '../integration/withZoneTestId';
import { CRM_ICON, CrmSearchPanel } from '../panels/CrmSearchPanel';

/**
 * Topbar CRM launcher.
 * Zone: `topbar-actions` — the global top app bar, on every page.
 *
 * This used to be a Help button with a book icon, beside the host's own Help
 * Center button with the same book icon: two identical-looking buttons, one of
 * them redundant. A global entry point earns its slot when it reaches something
 * Flow does not have, so this one opens the app's own system — a contact search
 * over the example CRM — in the shared side panel, from any page.
 *
 * The icon is deliberately not one the host uses in its top bar, so it reads as
 * an app's contribution rather than a second copy of platform chrome.
 */

export function TopbarCrmButton({
  context,
  ...marker
}: ExtensionComponentProps & ZoneMarkerProps) {
  const { Button, Icon, Tooltip } = context.ui ?? {};
  // Pass `context`: extension components render outside FlowContextProvider.
  const { open } = useSidePanel(context);

  const handleClick = () => {
    open({
      title: 'Example CRM',
      subtitle: 'Opened from the top bar',
      width: 'sm',
      icon: CRM_ICON,
      component: markPanel('crm-search', CrmSearchPanel),
    });
  };

  // Carve-out: no kit, so a bare control with no styling of its own.
  if (!Button || !Icon) {
    return (
      <button {...marker} onClick={handleClick} title='Example CRM'>
        CRM
      </button>
    );
  }

  // Mirror the native topbar button style (see AppbarActionItems.tsx):
  // soft-filled, circular, icon-only.
  const button = (
    <Button
      {...marker}
      color='primary'
      variant='soft'
      shape='circle'
      size='medium'
      aria-label='Example CRM'
      onClick={handleClick}
    >
      <Icon icon={CRM_ICON} sx={{ fontSize: 22 }} />
    </Button>
  );

  return Tooltip ? <Tooltip title='Example CRM'>{button}</Tooltip> : button;
}
