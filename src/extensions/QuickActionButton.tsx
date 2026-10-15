import type {
  ExtensionComponentProps,
  SidePanelContentProps,
} from '@netsapiens/flow-sdk';
import { useSidePanel } from '@netsapiens/flow-sdk';

import { type ZoneMarkerProps } from '../integration/withZoneTestId';
import { CallDetailsPanel } from '../panels/CallDetailsPanel';

/**
 * Quick Action Button Extension
 * Zone: `table-row-actions` — appears on each Call Logs row.
 *
 * Demonstrates opening the shared SDK side panel from *anywhere* (here, a table
 * row) via `useSidePanel()`, populated with row-specific content.
 */

export function QuickActionButton({
  context,
  ...marker
}: ExtensionComponentProps & ZoneMarkerProps) {
  const row = (
    context.pageContext as { row?: Record<string, unknown> } | undefined
  )?.row;
  const { IconButton } = context.ui ?? {};
  // Pass `context`: extension components render outside FlowContextProvider.
  const { open } = useSidePanel(context);

  if (!row) return null;

  const handleAction = () => {
    // Close over `row` so the panel body renders this row's details.
    const Panel = (props: SidePanelContentProps) => (
      <CallDetailsPanel {...props} row={row} />
    );
    open({
      title: 'Call details',
      subtitle: 'Opened from a table row',
      width: 'sm',
      icon: 'material-symbols:phone-in-talk-outline',
      component: Panel,
    });
  };

  // Fallback if UI components not available
  if (!IconButton) {
    return (
      <button
        {...marker}
        onClick={handleAction}
        title='Quick Action (Demo Extension)'
      >
        ⚡
      </button>
    );
  }

  return (
    <IconButton
      {...marker}
      icon='material-symbols:bolt'
      iconSize={18}
      aria-label='quick-action'
      size='small'
      onClick={handleAction}
    />
  );
}
