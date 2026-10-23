import type { ExtensionComponentProps } from '@netsapiens/flow-sdk';
import { useSyncExternalStore } from 'react';

import {
  isHighlighting,
  subscribeHighlighting,
  toggleHighlighting,
} from '../integration/highlightExtensions';
import { type ZoneMarkerProps } from '../integration/withZoneTestId';

/**
 * Topbar "Highlight extensions" toggle.
 * Zone: `topbar-actions` — the global top app bar, on every page.
 *
 * A presenter tool: on, every piece this app contributes is outlined in orange
 * with its zone name, so the room can tell SDK from native Flow; off, it all
 * blends back in. Alt+Shift+H does the same from the keyboard.
 *
 * A component rather than a declared action because it shows state: the
 * button is filled while highlighting is on. The outlines themselves are the
 * one carve-out in integration/highlightExtensions.ts; the button is the kit's.
 */

const ICON = 'material-symbols:select-all';
const LABEL = 'Highlight extensions (Alt+Shift+H)';

export function TopbarHighlightToggle({
  context,
  ...marker
}: ExtensionComponentProps & ZoneMarkerProps) {
  const { Button, Icon, Tooltip } = context.ui ?? {};
  const on = useSyncExternalStore(subscribeHighlighting, isHighlighting);

  // Carve-out: no kit, so a bare control with no styling of its own.
  if (!Button || !Icon) {
    return (
      <button
        {...marker}
        onClick={toggleHighlighting}
        title={LABEL}
        aria-pressed={on}
      >
        SDK
      </button>
    );
  }

  // Same soft circle as the native topbar buttons; filled while on.
  const button = (
    <Button
      {...marker}
      color={on ? 'warning' : 'primary'}
      variant={on ? 'contained' : 'soft'}
      shape='circle'
      size='medium'
      aria-label={LABEL}
      aria-pressed={on}
      onClick={toggleHighlighting}
    >
      <Icon icon={ICON} sx={{ fontSize: 22 }} />
    </Button>
  );

  return Tooltip ? <Tooltip title={LABEL}>{button}</Tooltip> : button;
}
