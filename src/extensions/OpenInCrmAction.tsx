import type {
  ExtensionComponentProps,
  SidePanelContentProps,
} from '@netsapiens/flow-sdk';
import { useSidePanel } from '@netsapiens/flow-sdk';

import { type ZoneMarkerProps } from '../integration/withZoneTestId';
import { CrmContactPanel } from '../panels/CrmContactPanel';
import { CRM_ICON } from '../panels/CrmSearchPanel';
import { externalParty } from '../services/callParty';

/**
 * Open in CRM — a row action on Call Logs.
 * Zone: `table-row-actions` — one button per row, beside the host's own.
 *
 * The host already ships a "Show details" row action that opens its full call
 * drawer (legs, quality, recordings), so an app button that re-displays the
 * row's from/to/duration would teach the SDK as a way to rebuild Flow. This one
 * does what Flow cannot: it takes the row's **far end** — the caller on an
 * inbound or missed call, the dialled number on an outbound one — and looks it
 * up in a system Flow has no knowledge of, here the mock CRM in `mocks/crm.ts`.
 * A hit shows the contact as the CRM knows it; a miss offers to create one.
 *
 * The mechanics are the same as any side panel: `useSidePanel(context)` with a
 * content component that closes over the row, so the panel body renders this
 * row's party rather than reading anything global.
 */

export function OpenInCrmAction({
  context,
  ...marker
}: ExtensionComponentProps & ZoneMarkerProps) {
  const row = (
    context.pageContext as { row?: Record<string, unknown> } | undefined
  )?.row;
  const { IconButton, Tooltip } = context.ui ?? {};
  // Pass `context`: extension components render outside FlowContextProvider.
  const { open } = useSidePanel(context);

  if (!row) return null;

  const handleAction = () => {
    // Resolve the party once, at click time, so the panel is about the row the
    // user pressed even if the grid re-renders underneath it.
    const party = externalParty(row);
    const Panel = (props: SidePanelContentProps) => (
      <CrmContactPanel {...props} party={party} />
    );
    open({
      title: party.name || party.number || 'Unknown party',
      subtitle: 'Example CRM · opened from a Call Logs row',
      width: 'sm',
      icon: CRM_ICON,
      component: Panel,
    });
  };

  // Carve-out: no kit, so a bare control with no styling of its own.
  if (!IconButton) {
    return (
      <button {...marker} onClick={handleAction} title='Open in CRM'>
        CRM
      </button>
    );
  }

  const button = (
    <IconButton
      {...marker}
      icon={CRM_ICON}
      iconSize={18}
      aria-label='Open in CRM'
      size='small'
      onClick={handleAction}
    />
  );

  return Tooltip ? <Tooltip title='Open in CRM'>{button}</Tooltip> : button;
}
