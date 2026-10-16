/**
 * Example CRM — a full-page route built from `templates.DashboardTemplate`.
 *
 * The counterpart to everything in `src/widgets/`. Those register into the
 * HOST's dashboards, where they appear in Customize and the user decides
 * whether and where they land. This page is the other model: the app owns the
 * whole surface, declares which cards appear and in what order, and no reader
 * rearranges it. A vendor dashboard for a vendor's feature set.
 *
 * What the template still gives is everything that makes it look like ours —
 * the dashboard page header, the widget grid and its edge-to-edge bleed, and the
 * same card frame a registered widget gets, so each card draws its title,
 * subtitle, shared-range chip and metric tooltip from what is declared here.
 * What it drops is Reorder, Customize and the saved layout, none of which mean
 * anything when the app decided the layout.
 *
 * `rangeControl` opts into the host's own pre-canned window selector. Cards
 * declaring `refreshPolicy: 'shared-range'` then receive resolved timestamps and
 * a window chip in their header; the sync queue declares `'own-cadence'` and is
 * correctly left alone by it.
 *
 * The widgets are the SAME components registered in `App.tsx` §4, reused
 * unchanged through one adapter — see `asPageWidget`. That is the point worth
 * making to a partner: a widget is a component, and where it renders is a
 * registration decision, not something to rebuild for.
 */
import type {
  DashboardTemplateWidgetProps,
  ExtensionContext,
  WidgetComponentProps,
} from '@netsapiens/flow-sdk';
import type { ComponentType } from 'react';
import { useFlowContext } from '@netsapiens/flow-sdk';

import { VENDOR_DASHBOARD_CARDS } from '../content/vendorDashboardContent';
import { type ZoneMarkerProps } from '../integration/withZoneTestId';
import { CallVolumeChart } from '../widgets/CallVolumeChart';
import { LiveCallsWidget } from '../widgets/LiveCallsWidget';
import { RecentActivityWidget } from '../widgets/RecentActivityWidget';
import { SyncedContactsStat } from '../widgets/SyncedContactsStat';
import { SyncFailuresStat } from '../widgets/SyncFailuresStat';
import { SyncOutcomesDonut } from '../widgets/SyncOutcomesDonut';
import { SyncQueueTable } from '../widgets/SyncQueueTable';

/**
 * Run a dashboard widget on a template page.
 *
 * A registered widget is handed `{ context, widget, actions }` by the host. On a
 * page the app is already inside `FlowContextProvider`, so the context comes
 * from `useFlowContext()` instead — the same `ui`, live with the colour mode.
 *
 * `actions` are no-ops, and honestly so: remove, resize and refresh act on a
 * grid the reader arranged, and there is no such grid here. A widget that calls
 * one gets nothing rather than a broken frame.
 *
 * The cast is the seam between two context shapes. `FlowContext` is the
 * page-level object and `ExtensionContext` the injected one; they overlap on
 * everything a widget reads (`ui`, `theme`, `t`), which is why one
 * component can serve both surfaces at all.
 */
function asPageWidget(
  Widget: ComponentType<WidgetComponentProps & ZoneMarkerProps>,
  testId: string,
) {
  return function PageWidget({ widget }: DashboardTemplateWidgetProps) {
    const context = useFlowContext();

    return (
      <Widget
        data-testid={testId}
        context={context as unknown as ExtensionContext}
        widget={{ ...widget, isEditing: false, isDragging: false }}
        actions={{
          remove: () => {},
          resize: () => {},
          refresh: () => {},
        }}
      />
    );
  };
}

/**
 * Card id → the component that draws it.
 *
 * Every one of these is a widget already registered in `App.tsx` §4 and reused
 * here unchanged — a widget is a component, and where it renders is a
 * registration decision. The donut is the exception and the interesting one: it
 * exists only on this page, because a card built from the template is page
 * content and needs no registration, no zone and no stable id at all.
 */
const COMPONENTS: Record<
  string,
  ComponentType<DashboardTemplateWidgetProps>
> = {
  'vendor-call-volume': asPageWidget(
    CallVolumeChart,
    'sdk-demo-vendor-call-volume',
  ),
  // Leaves, not cards. Same map — the template asks for a component per id
  // whether that id names a card or a figure inside one.
  'vendor-contacts-synced': asPageWidget(
    SyncedContactsStat,
    'sdk-demo-vendor-contacts-synced',
  ),
  'vendor-sync-failures': asPageWidget(
    SyncFailuresStat,
    'sdk-demo-vendor-sync-failures',
  ),
  // Not wrapped: it is written against the template's own props rather than the
  // dashboard widget contract, which is all a page-only card ever needs.
  'vendor-sync-outcomes': SyncOutcomesDonut,
  'vendor-sync-queue': asPageWidget(
    SyncQueueTable,
    'sdk-demo-vendor-sync-queue',
  ),
  'vendor-recent-activity': asPageWidget(
    RecentActivityWidget,
    'sdk-demo-vendor-recent-activity',
  ),
  'vendor-live-calls': asPageWidget(
    LiveCallsWidget,
    'sdk-demo-vendor-live-calls',
  ),
};

export default function VendorDashboardPage({ ...marker }: ZoneMarkerProps) {
  const { ui } = useFlowContext();
  const DashboardTemplate = ui?.templates?.DashboardTemplate;
  const Box = ui?.Box;

  // Carve-out: without the kit there is no page to draw.
  if (!DashboardTemplate || !Box) {
    return (
      <div {...marker} style={{ padding: 24 }}>
        Dashboard template not available
      </div>
    );
  }

  return (
    // `Box`, not a bare div: the marker needs a root to ride on, and the rule
    // against hand-rolled markup carves out inline text semantics, not
    // structural wrappers.
    <Box {...marker}>
      <DashboardTemplate
        title='Example CRM'
        subtitle='Your Example CRM integration at a glance'
        // The host's own window selector, with the platform's pre-canned ranges.
        rangeControl
        // Copy and layout from content/, components from the map above. The
        // page itself is neither — it is the join.
        widgets={VENDOR_DASHBOARD_CARDS.map(({ leaves, ...card }) =>
          leaves
            ? // A card of figures. The template draws each on the host's leaf
              // frame, so `Sync health` here is the same object the host builds
              // when these two register as `kind: 'leaf'` on its own dashboard.
              {
                ...card,
                leaves: leaves.map((leaf) => ({
                  ...leaf,
                  component: COMPONENTS[leaf.id],
                })),
              }
            : { ...card, component: COMPONENTS[card.id] },
        )}
      />
    </Box>
  );
}
