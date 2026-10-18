/**
 * "Analyze calls" — a declared action in `page-header-actions` on Call Logs.
 *
 * Declared, not rendered: the app states what the button is (a secondary
 * action) and the host draws it exactly as it draws its own, so it cannot drift
 * from the page it sits on.
 *
 * It shows two things an action can do:
 *   - read page state at click time. The call-logs grid publishes `rows` and
 *     `selectedRows` into `pageContext`, so the analysis covers the user's
 *     selection when there is one, otherwise every row the grid holds;
 *   - drive a host capability. It opens the host's side panel with the
 *     analysis. An action receives no SDK handle, so it reads the app's own
 *     (see `integration/appSdk.ts`).
 *
 * It replaces an "Export data" button: the grid's own toolbar already exports,
 * and an example that repeats a host feature teaches nothing.
 */
import type {
  ExtensionAction,
  ExtensionActionContext,
} from '@netsapiens/flow-sdk';

import type { CdrRow } from '../panels/CallAnalysisPanel';
import { appSdk } from '../integration/appSdk';
import { CallAnalysisPanel } from '../panels/CallAnalysisPanel';

/** The table state the call-logs grid publishes into `pageContext`. */
interface CallLogsPageContext {
  rows?: CdrRow[];
  selectedRows?: CdrRow[];
}

function analyzeCalls({ pageContext }: ExtensionActionContext) {
  const ctx = (pageContext ?? {}) as CallLogsPageContext;
  const selected = ctx.selectedRows ?? [];
  const fromSelection = selected.length > 0;
  const rows = fromSelection ? selected : (ctx.rows ?? []);

  appSdk.current?.openSidePanel({
    title: 'Call analysis',
    subtitle: fromSelection ? 'Selected calls' : 'Calls in the grid',
    width: 'md',
    icon: 'material-symbols:query-stats',
    component: (props) => (
      <CallAnalysisPanel {...props} rows={rows} fromSelection={fromSelection} />
    ),
  });
}

/**
 * One registration may carry several actions, and several apps may target the
 * same zone — the host orders them by `priority`, then array order. Adding a
 * second button here is a new array entry, not a second registration.
 */
export const analyzeCallsActions: ExtensionAction[] = [
  {
    id: 'analyze-calls',
    label: 'Analyze calls',
    icon: 'material-symbols:query-stats',
    // Also the default; stated because it is the point of this example.
    intent: 'secondary',
    tooltip:
      'Calls by hour, by direction, and the longest — for your selection or every row',
    'data-testid': 'sdk-demo-ext-analyze-calls',
    onClick: analyzeCalls,
  },
];
