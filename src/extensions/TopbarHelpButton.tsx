import type { ExtensionComponentProps } from '@netsapiens/flow-sdk';
import { useSidePanel } from '@netsapiens/flow-sdk';

import { type ZoneMarkerProps } from '../integration/withZoneTestId';
import { QuickLinksPanel } from '../panels/QuickLinksPanel';

/**
 * Topbar Help Button Extension
 * Zone: `topbar-actions` — action button in the global top app bar (renders on
 * every page).
 *
 * Opens the demo app's Quick Links / help content in the shared SDK side panel,
 * showing the panel can be opened from a global, app-wide entry point.
 */

export function TopbarHelpButton({
  context,
  ...marker
}: ExtensionComponentProps & ZoneMarkerProps) {
  const { Button, Icon, Tooltip } = context.ui ?? {};
  // Pass `context`: extension components render outside FlowContextProvider.
  const { open } = useSidePanel(context);

  const handleClick = () => {
    open({
      title: 'Help & Quick Links',
      subtitle: 'Demo app side panel',
      width: 'sm',
      icon: 'material-symbols-light:menu-book-outline-rounded',
      component: QuickLinksPanel,
    });
  };

  // Fallback if the host UI surface is unavailable
  if (!Button || !Icon) {
    return (
      <button
        {...marker}
        onClick={handleClick}
        title='Help & docs (Demo Extension)'
      >
        ?
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
      onClick={handleClick}
    >
      <Icon
        icon='material-symbols-light:menu-book-outline-rounded'
        sx={{ fontSize: 22 }}
      />
    </Button>
  );

  return Tooltip ? (
    <Tooltip title='Help & Quick Links (Demo Extension)'>{button}</Tooltip>
  ) : (
    button
  );
}
