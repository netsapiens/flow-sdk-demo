/**
 * Remote Demo App — the federated entry point loaded by the Flow host.
 *
 * This is the orchestrator: it initializes the SDK and, in a single effect,
 * registers everything the demo contributes to the host —
 *   - 7 full-page routes       (sdk.registerRoute)
 *   - 10 zone extensions        (sdk.registerDynamicExtension)
 *   - 1 dynamic table column    (sdk.registerDynamicColumn)
 *   - 9 dashboard widgets       (sdk.registerWidget)
 *   - 4 softphone streams       (sdk.streams.softphone)
 *   - 8 retained live feeds     (sdk.streams.retain, for Live Operations)
 *
 * Pattern-based extensions need no pre-defined extension points — each
 * registration targets a zone plus one or more route patterns, and the host
 * mounts the matching zones on its own pages. The component itself renders
 * nothing visible (it's a headless remote); all UI is injected into the host.
 *
 * ── Scope declarations (SDK 0.2.4) ────────────────────────────────────────
 * Two surfaces here declare `requiredScopes`, chosen to show the two cases that
 * behave differently:
 *
 *   - Component Showcase sits under `/apps`, which has NO section floor, so its
 *     'DOMAIN_MANAGERS' declaration is the only thing gating the page.
 *   - The CRM Status column sits on a `/manage` page whose floor is already
 *     ADMINS, and asks for 'PLATFORM' — narrowing a gate the host enforces, so a
 *     Reseller sees Contacts without that column.
 *
 * The rule underneath both: a declaration is intersected with the host's floor,
 * so it can only ever restrict further. Declaring a wider audience grants
 * nothing. Prefer a tier name over a scope list — the host resolves the name
 * against its current membership, while a list is a snapshot that silently loses
 * access as tiers change.
 *
 * ── Domain-scoped pages (SDK 0.2.9) ───────────────────────────────────────
 * CRM Sync registers under `parentPath: '/manage/:domain'` — the one parent
 * path that accepts a token. It exists so a page can follow the domain an
 * admin has drilled into WITHOUT the app enumerating domains: one registration
 * serves all of them, and the page reads the current one with
 * `useManagingDomain()`. Contrast it with CRM Integration directly above,
 * which sits at plain `/manage` and is the same page for every domain.
 */
import type { WidgetComponentProps } from '@netsapiens/flow-sdk';
import { useEffect, useMemo } from 'react';
import {
  FlowContext,
  FlowContextProvider,
  useRemoteApp,
} from '@netsapiens/flow-sdk';

import type { ZoneMarkerProps } from './integration/withZoneTestId';
import { CrmStatusCell } from './columns/CrmStatusColumn';
import { appSdk } from './integration/appSdk';
import { withZoneTestId } from './integration/withZoneTestId';
import {
  columnTestId,
  extensionRegistrations,
  routeTestId,
  widgetTestId,
} from './integration/zones';
import { crmStatusOf } from './mocks/crmStatus';
import ComponentShowcasePage from './pages/ComponentShowcasePage';
import CrmIntegrationPage from './pages/CrmIntegrationPage';
import DemoPage from './pages/DemoPage';
import DomainCrmSyncPage from './pages/DomainCrmSyncPage';
import { liveHistory } from './pages/liveOperations/liveFeeds';
import LiveOperationsPage from './pages/liveOperations/LiveOperationsPage';
import RecordingQaReviewPage from './pages/RecordingQaReviewPage';
import VendorDashboardPage from './pages/VendorDashboardPage';
import { createCallEventHandler } from './services/callEnrichment';
import { CallVolumeChart } from './widgets/CallVolumeChart';
import { IntegrationHealthPanel } from './widgets/IntegrationHealthPanel';
import { LiveCallsWidget } from './widgets/LiveCallsWidget';
import { PartnerLinksWidget } from './widgets/PartnerLinksWidget';
import { RecentActivityWidget } from './widgets/RecentActivityWidget';
import { RecordedCallsStat } from './widgets/RecordedCallsStat';
import { SyncedContactsStat } from './widgets/SyncedContactsStat';
import { SyncFailuresStat } from './widgets/SyncFailuresStat';
import { SyncQueueTable } from './widgets/SyncQueueTable';

// Injected at build time by webpack DefinePlugin (see webpack.config.js).
declare const __MF_NAME__: string;

// Widget components, tagged with their manifest testId once at module scope.
// `registerWidget` stores the component by identity and the host renders that
// identity, so building the wrapper inside the effect would hand the host a new
// component every time the effect re-ran and remount every placed instance.
//
// No `data-zone` here, unlike a zone extension: a widget declares a LIST of
// dashboards it is eligible on and the same component mounts on whichever one
// the user added it to, so a single zone attribute would name the wrong one. The
// eligible zones are recorded in zones.manifest.json instead.
//
// The type argument is explicit: `withZoneTestId` infers `P` from the component
// it is handed, and spelling it out keeps the result a
// `ComponentType<WidgetComponentProps>` — exactly what `registerWidget` wants.
const RecentActivityWidgetTagged = withZoneTestId<WidgetComponentProps>(
  RecentActivityWidget,
  widgetTestId('demo-recent-activity'),
);

const RecordedCallsStatTagged = withZoneTestId<WidgetComponentProps>(
  RecordedCallsStat,
  widgetTestId('demo-recorded-calls'),
);

const CallVolumeChartTagged = withZoneTestId<WidgetComponentProps>(
  CallVolumeChart,
  widgetTestId('demo-call-volume'),
);

const SyncQueueTableTagged = withZoneTestId<WidgetComponentProps>(
  SyncQueueTable,
  widgetTestId('demo-sync-queue'),
);

const LiveCallsWidgetTagged = withZoneTestId<WidgetComponentProps>(
  LiveCallsWidget,
  widgetTestId('demo-live-calls'),
);

// Tagged like the rest for consistency, though the host renders its LeafContainer
// instead of this component — see IntegrationHealthPanel.tsx. The suite locates
// this card by the frame's own testid, keyed on the stored widget id.
const IntegrationHealthPanelTagged = withZoneTestId<WidgetComponentProps>(
  IntegrationHealthPanel,
  widgetTestId('demo-integration-health'),
);

const SyncedContactsStatTagged = withZoneTestId<WidgetComponentProps>(
  SyncedContactsStat,
  widgetTestId('demo-contacts-synced'),
);

const SyncFailuresStatTagged = withZoneTestId<WidgetComponentProps>(
  SyncFailuresStat,
  widgetTestId('demo-sync-failures'),
);

const PartnerLinksWidgetTagged = withZoneTestId<WidgetComponentProps>(
  PartnerLinksWidget,
  widgetTestId('demo-partner-links'),
);

export default function App(flowContext: FlowContext) {
  // `__MF_NAME__` is injected at build time (webpack DefinePlugin) from the
  // single MODULE_FEDERATION_NAME constant in webpack.config.js — the same value
  // used as the ModuleFederationPlugin `name`, so the container name lives in one
  // place. The SDK derives the kebab app id ('flow-extension-demo') from it for
  // registry attribution.
  const { sdk, user, theme } = useRemoteApp(flowContext, __MF_NAME__);
  // For declared actions, which get no SDK handle (integration/appSdk.ts).
  appSdk.current = sdk;

  // The page wrappers below are memoized with empty deps so component identity
  // stays stable across host re-renders, which freezes `flowContext` at first
  // paint. That is fine: FlowContextProvider keeps `theme`, `locale`,
  // `managing` and `ui` live from host events (`ui` rides on `theme:changed`),
  // so pages read the current color mode through useFlowContext(). Needs a
  // host that sends `ui` with `theme:changed`; on an older one `ui.theme` and
  // `ui.styles` stay on the first-paint mode — another reason to use `ui.*`
  // components and palette paths rather than painting from tokens.
  // Full-page route components, wrapped once so they render with the live
  // FlowContext (theme/locale/ui) available via useFlowContext().
  const DemoPageWithContext = useMemo(
    () =>
      // Forward the marker props withZoneTestId injects (data-testid/data-zone)
      // into the page so it can tag its own root — otherwise they're dropped.
      function DemoPageWithContext(props: ZoneMarkerProps) {
        return (
          <FlowContextProvider context={flowContext}>
            <DemoPage {...props} />
          </FlowContextProvider>
        );
      },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [], // stable identity prevents the host from remounting the page
  );

  const ComponentShowcasePageWithContext = useMemo(
    () =>
      function ComponentShowcasePageWithContext(props: ZoneMarkerProps) {
        return (
          <FlowContextProvider context={flowContext}>
            <ComponentShowcasePage {...props} />
          </FlowContextProvider>
        );
      },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [], // stable identity prevents the host from remounting the page
  );

  const CrmIntegrationPageWithContext = useMemo(
    () =>
      function CrmIntegrationPageWithContext(props: ZoneMarkerProps) {
        return (
          <FlowContextProvider context={flowContext}>
            <CrmIntegrationPage {...props} />
          </FlowContextProvider>
        );
      },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [], // stable identity prevents the host from remounting the page
  );

  // The one page that needs the SDK itself, for its sdk.streams subscriptions.
  // `sdk` is stable for the life of the app (useRemoteApp keeps it in a ref).
  const LiveOperationsPageWithContext = useMemo(
    () =>
      function LiveOperationsPageWithContext(props: ZoneMarkerProps) {
        return (
          <FlowContextProvider context={flowContext}>
            <LiveOperationsPage sdk={sdk} {...props} />
          </FlowContextProvider>
        );
      },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [], // stable identity prevents the host from remounting the page
  );

  const DomainCrmSyncPageWithContext = useMemo(
    () =>
      function DomainCrmSyncPageWithContext(props: ZoneMarkerProps) {
        return (
          <FlowContextProvider context={flowContext}>
            <DomainCrmSyncPage {...props} />
          </FlowContextProvider>
        );
      },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [], // stable identity prevents the host from remounting the page
  );

  const VendorDashboardPageWithContext = useMemo(
    () =>
      function VendorDashboardPageWithContext(props: ZoneMarkerProps) {
        return (
          <FlowContextProvider context={flowContext}>
            <VendorDashboardPage {...props} />
          </FlowContextProvider>
        );
      },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [], // stable identity prevents the host from remounting the page
  );

  const RecordingQaReviewPageWithContext = useMemo(
    () =>
      function RecordingQaReviewPageWithContext(props: ZoneMarkerProps) {
        return (
          <FlowContextProvider context={flowContext}>
            <RecordingQaReviewPage {...props} />
          </FlowContextProvider>
        );
      },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [], // stable identity prevents the host from remounting the page
  );

  useEffect(() => {
    // ============================================================
    // 1. FULL PAGE ROUTES — added to the Apps, Manage and My Account menus
    // ============================================================
    sdk
      .registerRoute({
        id: 'ucaas-demo-page',
        parentPath: '/apps',
        path: 'flow-sdk-demo',
        label: 'Flow SDK Demo',
        icon: 'mdi:rocket-launch',
        placement: { last: true },
        component: withZoneTestId(
          DemoPageWithContext,
          routeTestId('ucaas-demo-page'),
        ),
      })
      .catch((error) =>
        console.error('[Demo App] Failed to register demo page:', error),
      );

    // Live Operations — the sdk.streams example. Deliberately NOT narrowed by
    // requiredScopes: a Basic User reaches the page and sees the domain-calls
    // card refused with the host's own message, which is half of the lesson.
    sdk
      .registerRoute({
        id: 'ucaas-live-operations',
        parentPath: '/apps',
        path: 'live-operations',
        label: 'Live Operations',
        icon: 'mdi:monitor-dashboard',
        component: withZoneTestId(
          LiveOperationsPageWithContext,
          routeTestId('ucaas-live-operations'),
        ),
      })
      .catch((error) =>
        console.error('[Demo App] Failed to register Live Operations:', error),
      );

    sdk
      .registerRoute({
        id: 'ucaas-component-showcase',
        parentPath: '/apps',
        path: 'component-showcase',
        label: 'Component Showcase',
        icon: 'mdi:palette',
        placement: { first: true },
        // `/apps` carries no section floor, so this declaration is the ONLY
        // thing gating the page — the case where `requiredScopes` does real
        // work rather than narrowing something the host already enforces. It
        // governs the nav entry and the URL together, so a Basic User neither
        // sees the menu item nor reaches /apps/component-showcase by typing it.
        //
        // A tier NAME, not a scope list: the host resolves 'DOMAIN_MANAGERS'
        // against its own current membership when access is checked, so if the
        // platform re-members the tier this page follows with nothing to
        // rebuild. A literal list would be a snapshot of today, and because the
        // host intersects, a stale one quietly LOSES access rather than failing.
        //
        // Written inline rather than pulled from a constant on purpose: the
        // platform analyser extracts an app's declared surface by reading string
        // literals out of the submitted source, so a constant extracts as
        // nothing and the Registered Apps page shows an empty Routes column.
        requiredScopes: 'DOMAIN_MANAGERS',
        component: withZoneTestId(
          ComponentShowcasePageWithContext,
          routeTestId('ucaas-component-showcase'),
        ),
      })
      .catch((error) =>
        console.error(
          '[Demo App] Failed to register Component Showcase:',
          error,
        ),
      );

    sdk
      .registerRoute({
        id: 'ucaas-crm-integration',
        // Mounts under the host's /manage/$ dynamic-route outlet, so the route
        // lives one level under /manage (→ /manage/crm-integration). The menu
        // item is placed right after Call Logs. (Deeper nesting under a static
        // route like call-logs would need a host-side splat outlet there.)
        parentPath: '/manage',
        path: 'crm-integration',
        label: 'CRM Integration',
        icon: 'mdi:account-sync',
        placement: { after: 'call-logs' },
        component: withZoneTestId(
          CrmIntegrationPageWithContext,
          routeTestId('ucaas-crm-integration'),
        ),
      })
      .catch((error) =>
        console.error('[Demo App] Failed to register CRM Integration:', error),
      );

    sdk
      .registerRoute({
        id: 'ucaas-domain-crm-sync',
        // DOMAIN-SCOPED. `:domain` is a token the host fills from the URL, so
        // this ONE registration serves every domain the admin can drill into
        // (→ /manage/acme.example.com/crm-sync). The app never enumerates or
        // names a domain; the page reads the selected one with
        // useManagingDomain(). `/manage/:domain` is the only parent path that
        // takes a token today, and the token must sit at that one position.
        parentPath: '/manage/:domain',
        path: 'crm-sync',
        label: 'CRM Sync',
        icon: 'mdi:sync',
        // Drilling into a domain is a Reseller-and-up action to begin with; the
        // page itself only needs a domain manager once you are inside one.
        requiredScopes: 'DOMAIN_MANAGERS',
        component: withZoneTestId(
          DomainCrmSyncPageWithContext,
          routeTestId('ucaas-domain-crm-sync'),
        ),
      })
      .catch((error) =>
        console.error('[Demo App] Failed to register CRM Sync:', error),
      );

    // A PAGE THAT IS A DASHBOARD. Everything in §4 below registers into one of
    // the HOST's dashboards, where the reader decides what lands and where. This
    // is the other model: `templates.DashboardTemplate` gives an app the same
    // dashboard shell and the same card frames on a page it owns outright, with
    // the widgets it declares in the order it chose and no Customize or Reorder
    // — neither means anything when the app decided the layout.
    sdk
      .registerRoute({
        id: 'ucaas-vendor-dashboard',
        parentPath: '/apps',
        path: 'example-crm',
        label: 'Example CRM',
        icon: 'mdi:view-dashboard-outline',
        component: withZoneTestId(
          VendorDashboardPageWithContext,
          routeTestId('ucaas-vendor-dashboard'),
        ),
      })
      .catch((error) =>
        console.error('[Demo App] Failed to register Example CRM:', error),
      );

    sdk
      .registerRoute({
        id: 'ucaas-recording-qa-review',
        // Mounts under the host's /home/$ dynamic-route outlet (→
        // /home/recording-qa-review), which puts it in the My Account menu —
        // the third menu tree this app extends, alongside Apps and Manage.
        //
        // This was "Call Recordings" until it was noticed that it duplicated
        // the host: Call Logs already plays and downloads every recording. It
        // is now a mock QA review queue — data on top of the recordings that
        // Flow does not have — and stays the reference DatagridTemplate page.
        //
        // '/home' is the right prefix even though the menu reads "My Account":
        // the label, the host's section id ('myaccount') and the URL prefix are
        // three different strings for one tree. '/myaccount' is not a route.
        // Older hosts resolve this URL but show no menu entry for it; see
        // "Choosing a menu — parentPath" in the README.
        //
        // Placed right after Call Logs, where the recordings it reviews play.
        // The anchor is matched by normalizing the menu item's NAME, not its
        // path: 'call-logs' resolves the My Account item named 'CALL_LOGS'
        // (both normalize to 'calllogs'). That its path is /home/call-logs
        // is a coincidence the match does not rely on.
        parentPath: '/home',
        path: 'recording-qa-review',
        label: 'Recording QA Review',
        icon: 'mdi:clipboard-check-outline',
        placement: { after: 'call-logs' },
        component: withZoneTestId(
          RecordingQaReviewPageWithContext,
          routeTestId('ucaas-recording-qa-review'),
        ),
      })
      .catch((error) =>
        console.error(
          '[Demo App] Failed to register Recording QA Review:',
          error,
        ),
      );

    // ============================================================
    // 2. CALL EVENTS — enrich inbound calls from the mock CRM
    // ============================================================
    // The signed-in user's own softphone, through sdk.streams: the host checks
    // this app's `softphone` grant on every event.
    // One method per lifecycle step, all feeding the same handler, which lives
    // in services/callEnrichment.ts.
    const onCall = createCallEventHandler(user?.extension ?? '');
    const softphoneStreams = [
      sdk.streams.softphone.onCallStarted(onCall),
      sdk.streams.softphone.onCallAnswered(onCall),
      sdk.streams.softphone.onCallMissed(onCall),
      sdk.streams.softphone.onCallEnded(onCall),
    ];

    // Live Operations: open its eight feeds now, not when the page is first
    // opened, and keep them for the session. The page attaches to them and is
    // handed everything they collected while it was closed. See liveFeeds.ts.
    liveHistory.start(sdk);

    // ============================================================
    // 3. DYNAMIC EXTENSIONS + COLUMN — inject into host zones
    // ============================================================
    // The 10 zone extensions are declared in integration/zones.manifest.json
    // (zone, route patterns, priority, permissions, testId) and registered by
    // iterating that manifest. Each component is wrapped with withZoneTestId so
    // the netsapiens-horizon-testing Playwright suite can locate the zone it
    // mounts into. Add/remove an extension by editing the manifest + the
    // COMPONENTS map in integration/zones.ts.
    for (const ext of extensionRegistrations) {
      sdk.registerDynamicExtension(ext);
    }

    // "CRM Status (SDK)" merged into the host's domain Contacts grid. The
    // host's DataTable derives the `contacts-columns` zone from the route and
    // merges registered columns into the grid. Each rendered cell carries the
    // manifest testId so the suite can assert the column mounted.
    //
    // This used to be a "Priority" column on Call Logs, and both halves of that
    // were wrong. Call Logs is among the busiest tables in the platform, so an
    // invented column there gets read as platform data; and "Priority" was this
    // app's own rule about duration and direction with nothing on screen saying
    // so. Contacts is quieter, the content actually belongs there — it is the
    // demo's CRM story, the same fixture behind the CRM Sync page and the
    // sync-queue widget — and `(SDK)` in the header says whose column it is
    // before anyone reads a value.
    sdk.registerDynamicColumn({
      id: 'demo-crm-status-column',
      zone: 'contacts-columns',
      routes: [
        { pattern: '/manage/contacts' },
        { pattern: '/manage/*/contacts' },
      ],
      // Narrower than the page it appears on. Contacts lives under `/manage`,
      // whose section floor is ADMINS (Admin, Super User, Reseller); this column
      // asks for PLATFORM, so a Reseller opens the page and sees every native
      // column but not this one. That is the intended shape of a column gate —
      // `renderCell` below is where action controls live, so a column reaches a
      // user exactly as a zone extension does, and deserves the same thought.
      //
      // The host intersects this with the page's floor, so it can only subtract.
      // Declaring a WIDER audience here (say 'END_USERS') would grant nothing —
      // it would intersect to the empty set and hide the column from everyone.
      requiredScopes: 'PLATFORM',
      column: {
        field: 'crm-status',
        // The caveat lives in the header, where a reader meets it before the
        // value. A column an app invents should never be mistakable for one the
        // platform owns, and that costs exactly one word.
        headerName: 'CRM Status (SDK)',
        width: 160,
        sortable: true,
        filterable: true,
        type: 'string',
        // Alignment is handled by the SDK — registered columns default to
        // right-aligned (matching native columns) unless a column overrides it.
        // Second argument is the host-built extension context — the same `ui`,
        // `theme`, `t` and side-panel methods a zone extension receives. The
        // cell renders from `context.ui`, so it re-themes with the host toggle.
        renderCell: (params, context) => (
          <CrmStatusCell
            params={params}
            context={context}
            data-testid={columnTestId('demo-crm-status-column')}
            data-zone='contacts-columns'
          />
        ),
        // Sorting and filtering act on this, not on the rendered chip, so the
        // grid orders by the same string the reader sees.
        valueGetter: (_value, row) => crmStatusOf(row),
      },
    });

    // ============================================================
    // 4. DASHBOARD WIDGETS — cards on the host's dashboards
    // ============================================================
    // Nine of them, chosen to cover the contract rather than to fill a grid.
    // Read down the list and every axis of `WidgetRegistration` appears once:
    //
    //   kind          panel · leaf (in the host's container AND in the app's own)
    //                 · panel-that-accepts-leaves (a container)
    //   category      activity · charts · tables · stats · other — which also
    //                 picks which of the five loading wireframes the host draws
    //   chrome        'host' everywhere except `call-volume`, which owns its own
    //   refreshPolicy shared-range · own-cadence · realtime · none at all
    //   size          half · full · resizable · a declared row height
    //   gates         requiredScopes (who the user is) · requiredPermissions
    //                 (what the app was granted) · condition (the app's own)
    //
    // Only the Platform admin dashboard renders a widget grid today, so every
    // new widget targets `platform-admin-dashboard-widgets` alone; Recent
    // activity keeps its second zone to show what listing two looks like.
    // `sdk.registerWidget` is the only path. There is no bus event to emit: the
    // event names are an SDK implementation detail and are deliberately not
    // exported, so an app that reaches for the bus is coding against something
    // it cannot see change.
    //
    // Registering a widget makes it ELIGIBLE; it does not place it. A saved
    // layout is authoritative, so a widget an app ships appears in the
    // dashboard's Customize catalogue rather than on a grid somebody already
    // arranged. Both of these show up under Customize on first load, not on the
    // dashboard — that is the contract working.
    //
    // Registered inline rather than looped out of zones.manifest.json (which the
    // 10 zone extensions above are), for the same reason routes and the column
    // are: bundle verification reviews an app by extracting string literals from
    // its source, so `zones` has to be a literal array written at the call site.
    // A helper — including the SDK's own internal `widgetZoneFor(surface)`, which
    // is not exported for exactly this reason — extracts as nothing, and the zone
    // can then never be attributed to this app.

    // A PANEL: its own card on the grid.
    sdk.registerWidget({
      // A plain name, NOT 'flow-extension-demo:recent-activity'. The host
      // stamps the app prefix itself, from this app's binding on the bus, so two
      // apps can both ship a `recent-activity` and neither has to know. It is
      // stored as 'flow-extension-demo:recent-activity', and that stored id is
      // what lands in every user's saved layout — which makes this the one field
      // that cannot be renamed later without losing every placement.
      id: 'recent-activity',
      kind: 'panel',
      // Written out in full, as literals. Two zones because the same panel suits
      // both dashboards; the user still adds it separately on each.
      zones: ['platform-admin-dashboard-widgets', 'manage-dashboard-widgets'],
      title: 'Recent activity',
      description: 'Recent call activity for the selected time range.',
      icon: 'mdi:pulse',
      // Decides the catalogue section AND the shape of the loading wireframe the
      // host draws while the component is suspended.
      category: 'activity',
      // Panels only. A leaf has no size of its own — see the leaf below.
      size: { default: 'half', resizable: true },
      // No `chrome` — it defaults to 'host', so the frame draws the card, the
      // title row from `title` above, the inner padding and the overflow menu.
      // The component draws none of them. Setting 'self' here would give the card
      // two titles and a double inset.

      // Where it lands on add, and on every RE-add: anchors resolve each time, so
      // a widget removed and added back returns here rather than to wherever it
      // was last dragged. Once it is on a grid the user's arrangement wins and
      // this is not consulted again. 'health' is a native panel on the Platform
      // dashboard; on the Manage dashboard, where that anchor does not exist, the
      // host falls back to the end.
      placement: { after: 'health' },
      // The host resolves the dashboard's shared range and hands this widget
      // `widget.range` as from/to TIMESTAMPS — never a preset label like
      // "Last 7 days", so there is nothing for the widget to parse.
      refreshPolicy: 'shared-range',
      // Narrows only, like the route and column declarations above: the host
      // intersects it with the dashboard's own floor. Both dashboards this
      // targets are already at ADMINS or above, so today this subtracts nothing —
      // it is here to show where the declaration goes on a widget. The Priority
      // column is the example of one that actually bites.
      requiredScopes: 'ADMINS',
      component: RecentActivityWidgetTagged,
    });

    // A PANEL that draws its OWN chrome, and the demo's charts entry.
    sdk.registerWidget({
      id: 'call-volume',
      kind: 'panel',
      zones: ['platform-admin-dashboard-widgets'],
      title: 'Call volume',
      description: 'Answered vs missed calls across the dashboard’s range.',
      icon: 'mdi:chart-bar',
      // The category picks the catalogue section AND the loading wireframe the
      // host draws — 'charts' gets a plot with axes and a legend rather than the
      // generic panel shape. The five categories are covered across this app's
      // widgets on purpose, so a partner can see all five skeletons.
      category: 'charts',
      // No `chrome`, like every other widget here. The frame draws the title,
      // the `description` below it as a subtitle, the shared-range window chip,
      // and the `metric` provenance tooltip. `chrome: 'self'` turns all four
      // off in exchange for owning the padding and type scale yourself — it
      // exists for host panels that predate the frame, not for apps.
      // `height` is in grid row units. It also sizes the reserved slot, so the
      // grid does not reflow when this widget's code arrives.
      size: { default: 'full', resizable: true, height: 5 },
      placement: { after: 'average-calls' },
      refreshPolicy: 'shared-range',
      // Provenance, drawn by the frame as an info tooltip beside the title. A
      // number nobody can trace is a number nobody trusts, and this is the whole
      // cost of saying where one came from.
      metric: {
        formula: 'count(call_events) grouped by bucket, split by disposition',
        source: 'Demo fixture — mocks/widgetActivity.ts',
        cadence: 'On range change',
      },
      component: CallVolumeChartTagged,
    });

    // A PANEL on its OWN cadence — the second of the three refresh policies.
    sdk.registerWidget({
      id: 'sync-queue',
      kind: 'panel',
      zones: ['platform-admin-dashboard-widgets'],
      title: 'CRM sync queue',
      description: 'Contacts waiting to reconcile with the vendor CRM.',
      icon: 'mdi:table-sync',
      category: 'tables',
      size: { default: 'half', resizable: true, height: 4 },
      placement: { after: 'suspect-domains' },
      // The widget owns a timer, so the host hands it NO range: `widget.range`
      // is undefined for anything that did not ask to follow the shared one.
      refreshPolicy: 'own-cadence',
      component: SyncQueueTableTagged,
    });

    // A REALTIME PANEL, and the demo's blank-canvas example. Every other widget
    // here maps onto something the host already draws; this one is a layout the
    // platform has no equivalent for, composed from kit primitives — a filter,
    // a toggle, a card per call, per-row actions. A partner's product is usually
    // not a restyled version of ours, so the kit has to express something we
    // never anticipated without the app reaching for its own styling.
    sdk.registerWidget({
      id: 'live-calls',
      kind: 'panel',
      zones: ['platform-admin-dashboard-widgets'],
      title: 'Live call console',
      description: 'Calls in progress, pushed as they ring.',
      icon: 'mdi:phone-in-talk',
      category: 'activity',
      size: { default: 'half', resizable: true, height: 4 },
      placement: { after: 'health' },
      refreshPolicy: 'realtime',
      // Gates on what the APP was granted, not on who the user is — the other
      // half of the pair `requiredScopes` starts. The host checks it before this
      // reaches the catalogue, so a platform with call events switched off never
      // offers a card that could only ever be empty. Same grant the softphone
      // streams are checked against, declared where a dashboard sees it.
      requiredPermissions: ['streams:softphone'],
      // The app's own predicate, evaluated last and on every read. The widget
      // shows the signed-in user's own softphone calls, so a context with no
      // signed-in user could only ever show an empty card: don't offer it.
      // A condition that throws hides the widget rather than taking the
      // dashboard down with it, so being strict here is free.
      condition: (context) => Boolean(context.user?.username),
      component: LiveCallsWidgetTagged,
    });

    // A CONTAINER PANEL the app ships itself, plus the two leaves that go in it.
    // The third widget shape, and the one most apps never find: `acceptsLeaves`
    // makes the host render its LeafContainer in place of `component`, so the
    // leaves below lay out and reorder INSIDE this card and cannot escape it.
    sdk.registerWidget({
      id: 'integration-health',
      kind: 'panel',
      zones: ['platform-admin-dashboard-widgets'],
      title: 'Integration health',
      description: 'The demo app’s own stat blocks, in a container it owns.',
      icon: 'mdi:heart-pulse',
      category: 'other',
      // Namespaced, NOT 'stat'. The host resolves a leaf's container by finding
      // the first panel that accepts its category, so reusing 'stat' here would
      // race the host's own stat card for every stat leaf on the dashboard.
      acceptsLeaves: { category: 'demo-insight' },
      size: { default: 'half', resizable: true, height: 3 },
      placement: 'end',
      component: IntegrationHealthPanelTagged,
    });

    sdk.registerWidget({
      id: 'contacts-synced',
      kind: 'leaf',
      // Into the app's OWN container above — contrast `recorded-calls` below,
      // which declares 'stat' and lands in the host's stat card instead.
      leafOf: 'demo-insight',
      zones: ['platform-admin-dashboard-widgets'],
      title: 'Contacts synced',
      description: 'Contacts reconciled with the CRM in the last 24 hours.',
      icon: 'mdi:account-check',
      category: 'stats',
      component: SyncedContactsStatTagged,
    });

    sdk.registerWidget({
      id: 'sync-failures',
      kind: 'leaf',
      leafOf: 'demo-insight',
      zones: ['platform-admin-dashboard-widgets'],
      title: 'Sync failures',
      description: 'Rows that exhausted their retries in the same window.',
      icon: 'mdi:alert-circle-outline',
      category: 'stats',
      component: SyncFailuresStatTagged,
    });

    // A PANEL with NO refresh policy — not every widget has data that goes
    // stale, and declaring one it does not need is a claim the host acts on.
    sdk.registerWidget({
      id: 'partner-links',
      kind: 'panel',
      zones: ['platform-admin-dashboard-widgets'],
      title: 'Demo app links',
      description:
        'Where the rest of this demo lives, and a side panel to open.',
      icon: 'mdi:link-variant',
      // The fallback bucket, and the last of the five loading wireframes.
      category: 'other',
      size: { default: 'half', resizable: true, height: 3 },
      placement: 'end',
      component: PartnerLinksWidgetTagged,
    });

    // A LEAF: a block INSIDE the host's stat container, not a card of its own.
    sdk.registerWidget({
      id: 'recorded-calls',
      kind: 'leaf',
      // The container category it belongs in. The host's stats panel declares
      // `acceptsLeaves: { category: 'stat' }`, so this sits alongside the native
      // stat blocks and reorders within that container rather than on the grid.
      leafOf: 'stat',
      zones: ['platform-admin-dashboard-widgets'],
      title: 'Recordings processed',
      description: 'Recordings successfully processed in the last 24 hours.',
      icon: 'mdi:record-rec',
      category: 'stats',
      // Deliberately no `size`: that is panels only, and a leaf's width belongs
      // to its container's grid. It gets no pixel box either — `widget.pixel` is
      // `{ width: 0, height: 0 }` for a leaf.
      component: RecordedCallsStatTagged,
    });

    return () => {
      softphoneStreams.forEach((stream) => stream.unsubscribe());
      liveHistory.stop();
      // By the same plain names they were registered under — the host resolves
      // the prefix, here as at registration. A container is withdrawn like any
      // other widget; the host keeps its slot and shows the leaves as pending
      // rather than rewriting a layout the user arranged.
      sdk.unregisterWidget('recent-activity');
      sdk.unregisterWidget('call-volume');
      sdk.unregisterWidget('sync-queue');
      sdk.unregisterWidget('live-calls');
      sdk.unregisterWidget('integration-health');
      sdk.unregisterWidget('contacts-synced');
      sdk.unregisterWidget('sync-failures');
      sdk.unregisterWidget('partner-links');
      sdk.unregisterWidget('recorded-calls');
    };
  }, [
    sdk,
    user?.extension,
    DemoPageWithContext,
    LiveOperationsPageWithContext,
    DomainCrmSyncPageWithContext,
    ComponentShowcasePageWithContext,
    CrmIntegrationPageWithContext,
    VendorDashboardPageWithContext,
    RecordingQaReviewPageWithContext,
  ]);

  // Headless: the app injects UI into the host; it renders nothing itself.
  return (
    <div style={{ display: 'none' }}>
      Demo App Loaded - User: {user.displayName} - Theme: {theme}
    </div>
  );
}
