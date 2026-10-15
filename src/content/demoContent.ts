/**
 * Static content for the Flow SDK Demo overview page (DemoPage). Pure data —
 * the capabilities, extension zones, route patterns, walkthrough cards, and code
 * snippets the page renders. Kept out of the page so the page is just layout.
 */

/** Semantic badge color key — resolved against `styles.badge[...]` at render. */
export type BadgeKey = 'primary' | 'success' | 'warning';

export interface Capability {
  title: string;
  api: string;
  desc: string;
}

/** The capabilities this demo exercises. */
export const CAPABILITIES: Capability[] = [
  {
    title: 'Full-page routes',
    api: 'sdk.registerRoute()',
    desc: 'Add standalone pages to the Apps and Manage menus — e.g. this page and the CRM Integration page.',
  },
  {
    title: 'Dynamic extensions',
    api: 'sdk.registerDynamicExtension()',
    desc: 'Inject components into named zones on existing host pages, targeted by route patterns. No pre-defined extension points.',
  },
  {
    title: 'Dynamic columns',
    api: 'sdk.registerDynamicColumn()',
    desc: 'Add a sortable/filterable column to a host data table, such as the CRM Status (SDK) column on domain Contacts.',
  },
  {
    title: 'Dashboard widgets',
    api: 'sdk.registerWidget()',
    desc: 'Contribute cards to a host dashboard — panels on the grid, leaves inside a stat container, or a container of your own that holds them. The host draws the card, the heading and the menu; the app supplies the content.',
  },
  {
    title: 'Live data',
    api: 'sdk.streams',
    desc: 'Live calls, queues, agents, presence and more, one named method per feed. The host checks the app’s grants and the user’s scope, and reports a status you can show.',
  },
  {
    title: 'On-demand side panel',
    api: 'sdk.openSidePanel() / useSidePanel()',
    desc: 'Open Flow’s shared side panel from anywhere — a row action, a header button, a call handler — with your own React content.',
  },
  {
    title: 'Themed UI kit',
    api: 'flowContext.ui',
    desc: 'Build with the host’s MUI Aurora components and templates so extensions match Flow in light and dark mode.',
  },
  {
    title: 'Gated API access',
    api: 'flowContext.api',
    desc: 'Call the NetSapiens v2 API through an authenticated proxy that enforces per-capability and per-resource access.',
  },
];

export interface ZoneInfo {
  zone: string;
  desc: string;
  usedFor: string;
}

/**
 * Every zone this demo registers into. All are mounted by the host.
 *
 * The last two are **dashboard widget** zones, which behave differently from the
 * rest: a widget zone names a dashboard rather than a slot on a page, takes no
 * route patterns, and the widget appears in that dashboard's Customize catalogue
 * for the user to add rather than mounting itself.
 */
export const ZONES: ZoneInfo[] = [
  {
    zone: 'page-header-actions',
    desc: 'Action buttons in the page header.',
    usedFor:
      'Export data button on Call Logs, Contacts, Users & Devices — declared via `actions`, rendered by the host.',
  },
  {
    zone: 'page-header-secondary',
    desc: 'Badges / status beside the page title.',
    usedFor: '“● Live” status badge, on this app\u2019s own page only.',
  },
  {
    zone: 'page-content-after',
    desc: 'Content below the main page body.',
    usedFor: 'Call analytics summary widget on Call Logs.',
  },
  {
    zone: 'table-toolbar',
    desc: 'The toolbar row above a data table.',
    usedFor: 'Triage tips button on Call Logs.',
  },
  {
    zone: 'table-filter-bar',
    desc: 'Filter chips alongside the host’s status filters.',
    usedFor:
      '“● Recording / ⏸ On hold / ☎ In queue” filters on Active Calls.',
  },
  {
    zone: 'table-row-actions',
    desc: 'Per-row action buttons in a table.',
    usedFor:
      'Quick action on Call Logs rows → opens a Call details side panel.',
  },
  {
    zone: 'call-logs-columns (dynamic column)',
    desc: 'A registered column merged into a host table.',
    usedFor: 'CRM Status (SDK) column on the domain Contacts table.',
  },
  {
    zone: 'form-section-before',
    desc: 'Above a form’s field sections.',
    usedFor: 'CRM context banner on the Contacts add/edit form.',
  },
  {
    zone: 'form-section-after',
    desc: 'Below a form’s fields, before the actions.',
    usedFor: 'Consent / opt-in checkboxes on the Contacts form.',
  },
  {
    zone: 'inbound-call-content',
    desc: 'Inside the inbound-call widget.',
    usedFor: 'Enriched caller info card on ringing calls.',
  },
  {
    zone: 'topbar-actions',
    desc: 'The global top app bar (every page).',
    usedFor: 'Help button → opens the Quick Links side panel.',
  },
  {
    zone: 'platform-admin-dashboard-widgets',
    desc: 'The Platform admin dashboard. A widget zone: it names a dashboard, not a slot on a page.',
    usedFor:
      'Nine widgets covering every shape the contract has: panels (Recent activity, Call volume, CRM sync queue, Live calls, Demo app links), a container the app ships itself (Integration health) with its own two leaves, and a leaf inside the host’s stat card (Recordings processed). Add any of them from Customize.',
  },
  {
    zone: 'manage-dashboard-widgets',
    desc: 'The Manage dashboard. Listing a second zone offers the same widget on a second dashboard.',
    usedFor:
      'Recent activity again — the user still adds it separately here, and its placement anchor does not exist on this dashboard, so it lands at the end.',
  },
];

export interface PatternInfo {
  pattern: string;
  kind: string;
  matches: string;
}

export const PATTERNS: PatternInfo[] = [
  {
    pattern: '/manage/call-logs',
    kind: 'Exact path',
    matches: 'Only /manage/call-logs',
  },
  {
    pattern: '/manage/*/call-logs',
    kind: 'Wildcard segment',
    matches: '/manage/example/call-logs',
  },
  {
    pattern: '/manage/:domain/contacts',
    kind: 'Named param',
    matches: '/manage/example/contacts (domain=example)',
  },
  { pattern: '/manage/*', kind: 'Prefix', matches: 'Any page under /manage' },
  { pattern: '/*', kind: 'Global', matches: 'Every page — use sparingly' },
];

export interface WalkthroughItem {
  label: string;
  desc: string;
  nav: string;
  badge: BadgeKey;
}

export const WALKTHROUGH: WalkthroughItem[] = [
  {
    label: 'Call Logs',
    desc: 'Export button, CRM Status column, analytics widget, toolbar tips, and a row quick-action that opens a Call details side panel.',
    nav: '/manage/call-logs',
    badge: 'primary',
  },
  {
    label: 'Contacts',
    desc: 'Open the add/edit contact drawer to see the CRM banner and the consent checkboxes injected into the form.',
    nav: '/home/contacts',
    badge: 'success',
  },
  {
    label: 'Active Calls',
    desc: 'Recording / On hold / In queue filter chips injected beside the host’s status filters.',
    nav: '/manage/active-calls',
    badge: 'warning',
  },
  {
    label: 'CRM Integration',
    desc: 'A full registered page in the Manage menu that lists the user’s calls from a live NetSapiens v2 API call and matches each caller to their CRM record.',
    nav: '/manage/crm-integration',
    badge: 'primary',
  },
  {
    label: 'Component Showcase',
    desc: 'A reference page rendering every shared MUI Aurora component available via flowContext.ui.',
    nav: '/apps/component-showcase',
    badge: 'success',
  },
];

export interface CodeExample {
  title: string;
  code: string;
}

/** The registration snippets shown on the Code tab. */
export const CODE_EXAMPLES: CodeExample[] = [
  {
    title: 'Register a full page',
    code: `sdk.registerRoute({
  id: 'ucaas-crm-integration',
  parentPath: '/manage', // extend the Manage menu, not just /apps
  path: 'crm-integration',
  label: 'CRM Integration',
  icon: 'mdi:account-sync',
  placement: { after: 'call-logs' },
  component: CrmIntegrationPage,
});`,
  },
  {
    title: 'Contribute a header button (declare the intent, not the styling)',
    code: `// Say what the button IS. The host renders it exactly as it renders its
// own header buttons, so it cannot drift from the page it sits on.
// 'secondary' is the default; 'primary' and 'danger' are the other intents.
sdk.registerDynamicExtension({
  id: 'demo-export-button',
  zone: 'page-header-actions',
  routes: [
    { pattern: '/manage/call-logs' },
    { pattern: '/manage/*/contacts' },
    { pattern: '/manage/*/users' },
  ],
  priority: 10,
  actions: [
    {
      id: 'export-data',
      label: 'Export data',
      icon: 'material-symbols:download',
      intent: 'secondary',
      // Page state arrives at click time. On a table page the host publishes
      // rows / selectedRows, so an action can work on the user's selection.
      onClick: ({ pageContext, route }) => {
        const { rows, selectedRows } = pageContext ?? {};
        exportRows(selectedRows?.length ? selectedRows : rows, route);
      },
    },
    // Several buttons from one registration: add an entry. Several apps in one
    // zone: the host orders by priority, then array order.
  ],
});

// Prefer 'actions' for page-header-actions, table-toolbar and topbar-actions.
// Use 'component' for anything that is not a button — badges, banners, widgets.`,
  },
  {
    title: 'Add a table column',
    code: `sdk.registerDynamicColumn({
  id: 'demo-crm-status-column',
  // The zone is derived from the route's last segment, so any host
  // DataTable opts in without the page wiring anything.
  zone: 'contacts-columns',
  routes: [{ pattern: '/manage/*/contacts' }],
  requiredScopes: 'PLATFORM',   // narrows the page's floor; never widens it
  column: {
    field: 'crm-status',
    // Say whose column it is, in the header. A column an app invents
    // should not be mistakable for one the platform owns, and a reader
    // meets the header before the value.
    headerName: 'CRM Status (SDK)',
    sortable: true,
    // Second arg is the ExtensionContext — render from context.ui and the
    // cell re-themes with the host's light/dark toggle for free.
    renderCell: (params, context) => (
      <CrmStatusCell params={params} context={context} />
    ),
    // Sort and filter act on this, not on the rendered chip.
    valueGetter: (_value, row) => crmStatusOf(row),
  },
});

// Pick a quiet page. This started life as a 'Priority' column on Call
// Logs — one of the busiest tables we ship — where an invented column
// gets read as platform data.`,
  },
  {
    title: 'Contribute a dashboard widget',
    code: `// A PANEL — its own card on the dashboard grid.
sdk.registerWidget({
  // A plain name. The host stamps the app prefix, so this is stored as
  // 'flow-extension-demo:recent-activity' — and that stored id is what
  // lands in every saved layout, so it cannot be renamed later.
  id: 'recent-activity',
  kind: 'panel',
  // Literal zone strings, written out. Never widgetZoneFor(surface): bundle
  // verification extracts string literals, and a helper call extracts as
  // nothing — the zone could then never be attributed to your app.
  zones: ['platform-admin-dashboard-widgets', 'manage-dashboard-widgets'],
  title: 'Recent activity',
  icon: 'mdi:pulse',
  category: 'activity',        // catalogue section + loading wireframe shape
  size: { default: 'half' },   // panels only
  placement: { after: 'health' },
  refreshPolicy: 'shared-range', // → widget.range arrives as from/to timestamps
  requiredScopes: 'ADMINS',      // narrows only; intersected with the floor
  component: RecentActivityWidget,
  // No 'chrome': it defaults to 'host', so the frame draws the card, the title,
  // the description above as a subtitle, the '7d' window chip, the padding and
  // the menu. Your component draws none of them.
});

// A LEAF — a block INSIDE the host's stat container, not a card of its own.
sdk.registerWidget({
  id: 'recorded-calls',
  kind: 'leaf',
  leafOf: 'stat',              // the container category it belongs in
  zones: ['platform-admin-dashboard-widgets'],
  title: 'Recordings processed',
  category: 'stats',
  component: RecordedCallsStat, // no size, and widget.pixel is 0×0 for a leaf
});

// A CONTAINER — a panel that holds YOUR leaves. The host renders its own
// LeafContainer in place of \`component\`, lays the leaves out and reorders
// them inside this card. Namespace the category: the host resolves a leaf's
// home by finding the first panel accepting it, so 'stat' would race the
// host's own stat card.
sdk.registerWidget({
  id: 'integration-health',
  kind: 'panel',
  acceptsLeaves: { category: 'demo-insight' },
  zones: ['platform-admin-dashboard-widgets'],
  title: 'Integration health',
  category: 'other',
  component: IntegrationHealthPanel, // never called — see acceptsLeaves
});

sdk.registerWidget({
  id: 'contacts-synced',
  kind: 'leaf',
  leafOf: 'demo-insight',      // → lands in the container above, not the host's
  zones: ['platform-admin-dashboard-widgets'],
  title: 'Contacts synced',
  category: 'stats',
  component: SyncedContactsStat,
});

// refreshPolicy declares where your data comes from, and the host acts on it:
//   'shared-range' → you get widget.range as resolved from/to timestamps
//   'own-cadence'  → no range; you own the timer  (CRM sync queue)
//   'realtime'     → no range; data arrives by push (sdk.streams)
//   omitted        → nothing goes stale, so ask for nothing  (Demo app links)

// Two more gates, answering different questions:
//   requiredPermissions: ['streams:softphone']   // what the APP was granted
//   condition: (context) => Boolean(context.user?.username)  // your own, run last

// Your component receives { context, widget, actions }:
function RecentActivityWidget({ context, widget, actions }) {
  const { Stack, Typography } = context.ui;      // no MUI in a remote app
  const { from, to } = widget.range ?? {};       // resolved timestamps
  const { width, height } = widget.pixel;        // host-derived box
  // actions: remove() / resize() / refresh() — refresh remounts you
  return <Stack>…</Stack>;                       // content only, no card
}

// On unmount. Same plain name — the host resolves the prefix.
sdk.unregisterWidget('recent-activity');`,
  },
  {
    title: 'Subscribe to live data',
    code: `// One named method per feed; the host checks the app's grant.
const call = sdk.streams.softphone.onCallStarted((event) => enrich(event));

// In a component: opens on mount, closes on unmount, returns its status.
const status = useStream(
  sdk,
  (streams) => streams.queues.onDomainQueues({ stats: setStats }),
  [],
);
if (status.state === 'refused') return <Alert>{status.message}</Alert>;

// Keep a feed for the session, not the page (0.3.3+): retain it at startup...
sdk.streams.retain('domain-queues', (streams) =>
  streams.queues.onDomainQueues({ stats: (q) => totals.set(q.queue, q) }),
);
// ...and attach in the page: every kept record arrives at once on mount.
useStream(sdk, (s) => s.queues.onDomainQueues({ stats: setStats }), [], {
  retain: 'domain-queues',
});
// 'pending' after 'live' means the session changed: clear what you hold.

call.unsubscribe();`,
  },
  {
    title: 'Open the side panel from anywhere',
    code: `// From any extension, widget or column component, with its own context:
const { open } = useSidePanel(context);

open({
  title: 'Call details',
  width: 'sm',
  component: CallDetailsPanel,   // your React content
});

// CallDetailsPanel receives { context, close }
function CallDetailsPanel({ context, close }) {
  const { Stack, Typography, Button } = context.ui;
  return <Stack>…<Button onClick={close}>Close</Button></Stack>;
}`,
  },
];
