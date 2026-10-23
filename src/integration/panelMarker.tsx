import type { ComponentType } from 'react';

import { PANEL_PREFIX } from './highlightExtensions';

/**
 * Wrap a side-panel component so Highlight extensions can find it.
 *
 * The host draws the side panel itself, so nothing in it carries this app's
 * marker; the panel's content is ours, and this gives it one. The wrapper is
 * `display: contents`, so it adds no box and changes nothing about the panel's
 * layout: Highlight outlines the drawer around it, title bar included.
 */
export function markPanel<P extends object>(
  name: string,
  Panel: ComponentType<P>,
): ComponentType<P> {
  function MarkedPanel(props: P) {
    return (
      <div
        data-testid={`${PANEL_PREFIX}${name}`}
        style={{ display: 'contents' }}
      >
        <Panel {...props} />
      </div>
    );
  }
  MarkedPanel.displayName = `MarkedPanel(${name})`;
  return MarkedPanel;
}
