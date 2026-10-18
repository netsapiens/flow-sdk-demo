# Flow SDK Demo

A federated demo application showing how to extend **NetSapiens Flow** with the
[`@netsapiens/flow-sdk`](https://www.npmjs.com/package/@netsapiens/flow-sdk).
It is loaded into the running Flow host over Webpack Module Federation and
exercises every capability the SDK exposes — full pages, zone-based UI
extensions, a dynamic table column, dashboard widgets, live call events, and
authenticated API access — using the host's themed component kit so everything
matches Flow in light and dark mode.

> The in-app **Apps → Flow SDK Demo** page is the live, self-documenting tour
> of everything below (Overview / Extension Zones / Route Patterns / Code /
> Walkthrough). This README is the engineering companion to it.

> **Renamed in 3.0.0.** This repository was `horizon-sdk-demo`, and the app was
> registered as `horizonExtensionDemo`. It is now `flow-sdk-demo`, served from
> `https://netsapiens.github.io/flow-sdk-demo/remoteEntry.js`, and registers as
> `flowExtensionDemo`: a new app, so a server that ran the old one registers this
> one fresh.

> **Moving an app from SDK 0.2.x to 0.3.x?** Read
> **[MIGRATION-0.2.x-TO-0.3.x.md](./MIGRATION-0.2.x-TO-0.3.x.md)**: the package
> rename, `sdk.streams` in place of `subscribeToCallEvents` / `subscribeToStream`,
> grants read from your bundle, retained streams, and the event bus leaving the
> public surface. **Rebuild on `@netsapiens/flow-sdk` ^0.3.7 (the latest 0.3.x)
> and deploy before 2026-10-31:** after that date an app built on an SDK older
> than 0.3.6 loads but adds nothing to Flow, and a new version built on one is
> rejected at submission.

> **Maintaining an app built on the old Horizon SDK 0.1.x?** The
> [migration guide](./MIGRATION-0.1.x-TO-0.2.x.md) is kept as the record of that
> upgrade: bundle verification and SRI, the reversed remote-entry URL
> policy, the `ui` surfaces, and `requiredScopes`. It predates the rename, so it
> uses the Horizon names (`@netsapiens/horizon-sdk`, `horizonContext`) that 0.3.0
> replaced with Flow ones.

> **Starting a new app with an AI agent?** This repository ships a Claude Code
> skill at
> [`.claude/skills/create-flow-app/`](./.claude/skills/create-flow-app/SKILL.md).
> Open this repo (or copy that folder into your own) and ask your agent to
> _"create a Flow app"_ — it scaffolds a project with bundle verification,
> scope declarations and the theme contract already correct, which is most of what
> the migration guide exists to explain. The skill is written against the same SDK
> version this demo uses.

## What's new in flow-sdk 0.3.x

The SDK was renamed and gained live streaming in 0.3.x. This demo runs on
**`@netsapiens/flow-sdk` ^0.3.7** and shows each change working. The SDK's own
README (its **Migration** section, `node_modules/@netsapiens/flow-sdk/README.md`)
and `STREAMS.md` are the references, and
[MIGRATION-0.2.x-TO-0.3.x.md](./MIGRATION-0.2.x-TO-0.3.x.md) walks an app through
the move step by step. This is where to see each change in the demo.

| Change                                                                                                                                                                                                                                                               | What to do                                                                                                                                                                                                                                                                                                                                                                                                              | Where the demo does it                                                                                                                                          |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Package renamed**: `@netsapiens/horizon-sdk` → `@netsapiens/flow-sdk`, with `Flow*` names (`FlowContext`, `FlowContextProvider`, `useFlowContext`, `flowContext`).                                                                                                 | Install `@netsapiens/flow-sdk` and rename the imports. The scaffold skill is now `create-flow-app`.                                                                                                                                                                                                                                                                                                                     | Everywhere. This repo was renamed to match (`flow-sdk-demo`, container `flowExtensionDemo`).                                                                    |
| **Live data is `sdk.streams`**: one named method per feed (`calls`, `queues`, `agents`, `presence`, `contacts`, `notifications`, `subscribers`, `devices`, `cdrs` call records, your own `softphone`). Grants are read from your bundle when a version is submitted. | `sdk.streams.<subject>.<method>(handlers)`, or `useStream(sdk, (streams) => …, deps)` in a component. Show `status.message` when a stream is `refused`.                                                                                                                                                                                                                                                                 | **Apps → Live Operations** (`src/pages/liveOperations/`), and the softphone feed in `App.tsx`.                                                                  |
| **Retained streams**: a feed that outlives the page, so a page opened later starts with everything delivered so far.                                                                                                                                                 | `sdk.streams.retain(key, factory)` at startup, then `useStream(…, deps, { retain: key })` in the page.                                                                                                                                                                                                                                                                                                                  | `liveFeeds.ts` retains eight feeds at startup; `liveState.tsx` attaches to them.                                                                                |
| **A session change reports `pending`**: when the user, scope or managed domain changes (an admin switching domain, a masquerade), each stream goes `pending` again.                                                                                                  | `pending` after `live` means clear what you hold; the new session's data follows.                                                                                                                                                                                                                                                                                                                                       | `useResetOnPending` in `liveState.tsx`.                                                                                                                         |
| **No starting snapshot for some feeds**: queue stats, agents, presence, devices and call records send changes only.                                                                                                                                                  | Read the current state from the API once, then let the stream keep it current.                                                                                                                                                                                                                                                                                                                                          | `liveSeed.ts` (queues, agents, phones from `/domains/{managing ?? '~'}/…`).                                                                                     |
| **The event bus left the public surface**: no `eventBus` on `FlowContext` or `ExtensionContext`, and no `FlowEventBus` type.                                                                                                                                         | Side panel: `useSidePanel(context)` or `context.openSidePanel?.(config)` in host-rendered components; `useSidePanel()` or `sdk.openSidePanel(config)` in a page. Theme and managed domain: `useTheme(context)` / `useManagingDomain(context)`, or `context.theme` / `context.managing`. Hooks and `createRemoteAppSDK` take `flowContext`. Messages between your own components: a module-level emitter in your bundle. | Side panels in `OpenInCrmAction`, `TopbarCrmButton`, `LiveCallsWidget`, `PartnerLinksWidget`; the emitter is `onCallChanges()` in `services/callEnrichment.ts`. |

**Rebuild on `@netsapiens/flow-sdk` ^0.3.7 (the latest 0.3.x) and deploy the
new version before 2026-10-31.** Flow hosts still run apps built on older SDKs
today. After 2026-10-31, Flow hosts give an app built on an SDK older than 0.3.6
(`horizon-sdk` 0.2.x, `flow-sdk` 0.3.0–0.3.5) no event bus: it loads but adds
nothing to Flow, and the browser console says why. A new version built on an
older SDK is rejected when you submit it.

## What it demonstrates

This single app registers **7 full-page routes**, **10 zone extensions**, **1
dynamic table column**, **9 dashboard widgets**, **4 softphone streams** and **8
retained live feeds** (`sdk.streams`), an **on-demand side panel**, and a
**remote-auth handshake** with a backend.

> **Building a data table?** Start with the **Recording QA Review** page
> (`pages/RecordingQaReviewPage.tsx`) — a complete list page built the way a native
> Flow page is built, and the thing to copy. Then read
> **[DATAGRID.md](./DATAGRID.md)** for the page-layout anatomy and the `height`
> rule that otherwise leaves your pagination footer below the fold. The same guide
> ships inside the installed package at
> `node_modules/@netsapiens/flow-sdk/DATAGRID.md`. There is also a minimal
> `DatagridTemplate` section on the Component Showcase page
> (`src/pages/showcase/sections/DataGridSection.tsx`).

### Full-page routes — `sdk.registerRoute()`

| Page                | Menu location                  | Notes                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| ------------------- | ------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Flow SDK Demo       | Apps                           | The overview/walkthrough page (`pages/DemoPage.tsx`).                                                                                                                                                                                                                                                                                                                                                                                                                            |
| Component Showcase  | Apps                           | Reference for every shared MUI Aurora component (`pages/ComponentShowcasePage.tsx`).                                                                                                                                                                                                                                                                                                                                                                                             |
| Live Operations     | Apps                           | **The `sdk.streams` example.** A live wallboard of queues, agents, domain calls, call records, presence and phones, each card showing its stream's status — including the host's refusal for users whose scope does not allow a feed (`pages/liveOperations/LiveOperationsPage.tsx`).                                                                                                                                                                                            |
| Example CRM         | Apps                           | A vendor dashboard page built on `templates.DashboardTemplate`: the host's grid, card frames and range control on a page the app owns (`pages/VendorDashboardPage.tsx`).                                                                                                                                                                                                                                                                                                         |
| CRM Integration     | Manage (after _Call Logs_)     | Lists the user's calls from a **live** NetSapiens v2 API call, matched to their CRM record — registered into the Manage menu to show the Manage tree can be extended, not just Apps (`pages/CrmIntegrationPage.tsx`).                                                                                                                                                                                                                                                            |
| CRM Sync            | Manage, **inside a domain**    | **Domain-scoped.** Registered once at `/manage/:domain`, so it mounts under whichever domain an admin has drilled into and reads that domain with `useManagingDomain()` — one registration, every domain (`pages/DomainCrmSyncPage.tsx`).                                                                                                                                                                                                                                        |
| Recording QA Review | My Account (after _Call Logs_) | **The reference list page**, over a mock QA review queue (agent, reviewer, score, flags) — data the host does not have; playback stays in Call Logs. Everything — search, filter, columns, export, refresh, checkbox selection, master-detail and the pagination footer — comes from `DatagridTemplate`; the primary action ("Assign N selected to me") sits in `PageTemplate`'s header `actions`. Shows the /home tree can be extended too (`pages/RecordingQaReviewPage.tsx`). |

#### Choosing a menu — `parentPath`

`parentPath` is a **URL prefix**, not a menu name. Five prefixes are routable —
each has a splat route in the host that renders federated pages, and each maps
to one menu tree:

| `parentPath`      | Menu it appears in          | Host sitemap section id |
| ----------------- | --------------------------- | ----------------------- |
| `/apps`           | Apps                        | `apps`                  |
| `/manage`         | Manage                      | `manage`                |
| `/manage/:domain` | Manage, **inside a domain** | `manage`                |
| `/platform`       | Platform                    | `platform`              |
| `/home`           | **My Account**              | `myaccount`             |

`/home` is the one to watch. The menu is labelled _My Account_, its internal
section id is `myaccount`, and its URL prefix is `/home` — three different
strings for the same tree. Use `/home`; `/myaccount` is not a route and will
render a menu entry pointing at a URL that 404s.

Registering Recording QA Review under `/home` is what puts it in My Account:

```ts
sdk.registerRoute({
  id: 'ucaas-recording-qa-review',
  parentPath: '/home', // → My Account, at /home/recording-qa-review
  path: 'recording-qa-review',
  label: 'Recording QA Review',
  placement: { after: 'call-logs' },
  component: RecordingQaReviewPage,
});
```

**Only direct children of a routable prefix work.** The host resolves a URL one
segment at a time and every segment must itself be a registered dynamic route,
so nesting under a host page does not work even when that page exists:

```ts
parentPath: '/home'; // ✅ → /home/recording-qa-review
parentPath: '/home/settings'; // ❌ 'settings' is a static host page, not a
//    dynamic route — the URL cannot resolve
```

A nested `parentPath` fails in a confusing way: the menu entry renders (the host
matches it to the static parent) but the URL 404s. If you want a page to sit
visually beneath an existing item, register it at the prefix and position it
with `placement` instead.

`placement` anchors match on a **normalized** menu label, not a path. In the
example above `after: 'call-logs'` resolves the My Account item whose name is
`CALL_LOGS` — both normalize to `calllogs`. The match uses the item's name, not
its path (`/home/call-logs`). Unmatched anchors fall back to the end of the menu.

> **Host version:** menu entries for `/home` require the host-side fix that
> maps the `myaccount` section to the `/home` prefix. On earlier hosts the route
> still resolves — `/home/recording-qa-review` loads if entered directly — but no
> menu entry appears, and nothing is logged to say why. `/apps`, `/manage` and
> `/platform` are unaffected.

#### Following the domain being managed — `/manage/:domain`

A Reseller or Super User does not stay in their own domain: they drill into a
customer's domain and every page under `/manage/<that domain>/…` is about it.
`/manage/:domain` is how your page joins them there.

It is the **one exception** to the direct-children rule above, and the only
parent path that accepts a token:

```ts
sdk.registerRoute({
  id: 'ucaas-domain-crm-sync',
  parentPath: '/manage/:domain', // → /manage/acme.example.com/crm-sync
  path: 'crm-sync',
  label: 'CRM Sync',
  requiredScopes: 'DOMAIN_MANAGERS',
  component: DomainCrmSyncPage,
});
```

**You register once, for all domains.** `:domain` is a wildcard the host fills
from the URL — you never name a domain and never enumerate them. A Reseller with
400 customers gets one registration, not 400.

Read the current domain with `useManagingDomain()`, and be strict about which
field you use:

```tsx
function DomainCrmSyncPage() {
  const { managing } = useManagingDomain(); // the domain being managed
  const { api, user } = useFlowContext(); // user.domain = YOUR OWN domain

  useEffect(() => {
    if (!managing) return;
    api.get(`/domains/${managing}/users`).then(setUsers);
  }, [managing, api]);
}
```

`user.domain` is the domain the signed-in admin _belongs to_. It never changes
while they drill around, so a page that fetches against it shows the same data
under every domain — the bug this hook exists to prevent. `managing` is
reactive: switching domains re-renders the page and re-runs the effect, with no
remount and no reload. It returns `null` on a surface that is not domain-scoped,
and `undefined` on a host too old to report one.

Three rules the host enforces on the token, each rejecting the registration
outright rather than failing quietly later:

- `:domain` is the **only** token — no other name is accepted.
- It must sit at **position 1**, directly under `/manage`.
- **One** token per parent path.

Extension zones already took `:domain` in their route `pattern`s; this brings
full pages to parity. Compare the two CRM pages in this app: **CRM Integration**
sits at plain `/manage` and is the same page for everyone, while **CRM Sync**
sits at `/manage/:domain` and changes with the domain you pick.

### Zone extensions — `sdk.registerDynamicExtension()`

Each registration targets a **zone** plus one or more **route patterns**. The
host mounts these zones on its own pages; no pre-defined extension points are
required.

| Zone                    | Where it appears           | Demo component                                      |
| ----------------------- | -------------------------- | --------------------------------------------------- |
| `page-header-actions`   | Page header buttons        | Export Data (`ExportButton`)                        |
| `page-header-secondary` | Beside the page title      | “● Live” badge (`HeaderStatusBadge`)                |
| `page-content-after`    | Below the page body        | Call analytics (`AnalyticsWidget`)                  |
| `table-toolbar`         | Above a data table         | Triage tips (`TableToolbarInfo`)                    |
| `table-filter-bar`      | Beside host status filters | “● Recording” filter (`ActiveCallsRecordingFilter`) |
| `table-row-actions`     | Per-row in a table         | Open in CRM (`OpenInCrmAction`)                     |
| `form-section-before`   | Above a form's fields      | CRM banner (`ContactFormBanner`)                    |
| `form-section-after`    | Below a form's fields      | Consent checkboxes (`ComplianceCheckbox`)           |
| `inbound-call-content`  | Inbound-call widget        | Enriched caller card (`CallerInfoWidget`)           |
| `topbar-actions`        | Global top app bar         | CRM launcher → contact search (`TopbarCrmButton`)   |

### On-demand side panel — `sdk.openSidePanel()` / `useSidePanel()`

Opens Flow's shared `SidePanel` drawer (one instance mounted by the host) with
app-provided React content, from anywhere — an extension, a page, or a call
handler. The content component receives `{ context, close }`.

```tsx
const { open } = useSidePanel(context); // an extension's, widget's or column's own context
open({ title: 'Example CRM', width: 'sm', component: CrmSearchPanel });
```

On a host with `context.openSidePanel` the hook calls it directly; on an older
host it falls back, so the same call works on both. In a page, call
`useSidePanel()` with no argument under `FlowContextProvider`, or
`sdk.openSidePanel(config)`.

The demo opens it from a **Call Logs row action** (`CrmContactPanel` — the
caller's record in the example CRM, or Create contact on no match) and from the
**global topbar CRM launcher** (`CrmSearchPanel` — a contact search). Both show
the app's own data: the host already has a call-details drawer and a Help
Center, so an app panel that repeated either would only duplicate Flow.

### Dynamic column — `sdk.registerDynamicColumn()`

A sortable/filterable **CRM Status (SDK)** column merged into the host's domain
Contacts table (`columns/CrmStatusColumn.tsx`), zone `contacts-columns`, narrowed
to `requiredScopes: 'PLATFORM'`.

`renderCell` receives `(params, context)` — the second argument is the same
`ExtensionContext` a zone extension gets (`ui`, `theme`, `t`, and the
side-panel methods). This cell renders through `context.ui.Chip`, so it re-colours with
the host's light/dark toggle; its fallback branch shows the alternative for
app-owned colours (branch on `context.theme`, never on the `ui.theme` snapshot).
One-argument renderers stay valid — the context is purely additive.

### Dashboard widgets — `sdk.registerWidget()`

A widget is a card on a dashboard. The host owns the grid, the card, the heading
and the overflow menu; the app supplies the content. Native panels and an app's
widgets go through the same registry.

The nine here are chosen to cover the contract, not to fill a grid — read down
the table and every axis of `WidgetRegistration` appears at least once.

| Widget                   | Kind                              | Category   | What it is here to show                                                                                                                         | Component                            |
| ------------------------ | --------------------------------- | ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------ |
| **Recent activity**      | `panel`                           | `activity` | The baseline: `refreshPolicy: 'shared-range'`, `widget.pixel`, `actions`. Offered on two dashboards                                             | `widgets/RecentActivityWidget.tsx`   |
| **Call volume**          | `panel`                           | `charts`   | Full width, `height: 5`, and `metric` provenance — which the host frame draws as a tooltip beside the title                                     | `widgets/CallVolumeChart.tsx`        |
| **CRM sync queue**       | `panel`                           | `tables`   | `refreshPolicy: 'own-cadence'` — its own timer, no `widget.range` — and the one place `actions.refresh()` earns a button. Built from `ui.Table` | `widgets/SyncQueueTable.tsx`         |
| **Live calls**           | `panel`                           | `stats`    | `refreshPolicy: 'realtime'` fed by `sdk.streams.softphone`, plus `requiredPermissions` and a `condition`                                        | `widgets/LiveCallsWidget.tsx`        |
| **Integration health**   | `panel` + `acceptsLeaves`         | `other`    | A **container the app ships itself**: the host draws its body and the two leaves below reorder inside it                                        | `widgets/IntegrationHealthPanel.tsx` |
| **Contacts synced**      | `leaf` (`leafOf: 'demo-insight'`) | `stats`    | A leaf in the app's **own** container                                                                                                           | `widgets/SyncedContactsStat.tsx`     |
| **Sync failures**        | `leaf` (`leafOf: 'demo-insight'`) | `stats`    | The second leaf — one proves they land, two prove they reorder                                                                                  | `widgets/SyncFailuresStat.tsx`       |
| **Demo app links**       | `panel`                           | `other`    | **No** `refreshPolicy` at all, and a widget driving a host capability (it opens the side panel)                                                 | `widgets/PartnerLinksWidget.tsx`     |
| **Recordings processed** | `leaf` (`leafOf: 'stat'`)         | `stats`    | A leaf in the **host's** existing stat card, alongside the native stat blocks                                                                   | `widgets/RecordedCallsStat.tsx`      |

The two leaf rows are the interesting pair. _Recordings processed_ proves a
remote app can contribute _into_ a host container and reorder within it;
_Contacts synced_ and _Sync failures_ prove an app can ship a container of its
own and fill it. Namespace that container's category (`demo-insight`, not
`stat`): the host resolves a leaf's home by finding the first panel that accepts
its category, so reusing the host's would race its stat card.

`category` is also the cheapest correctness on offer — it picks the catalogue
section _and_ the shape of the loading wireframe, so all five of the host's
skeletons (stat, chart, table, list, panel) are visible across these nine.

They register inline in `App.tsx` §4 — not from `zones.manifest.json` like the
zone extensions, for the same reason routes and the column do not: `zones` has to
be a literal array at the call site.

```tsx
sdk.registerWidget({
  id: 'recent-activity', // a PLAIN name — the host stamps the app prefix
  kind: 'panel',
  zones: ['platform-admin-dashboard-widgets', 'manage-dashboard-widgets'],
  title: 'Recent activity',
  icon: 'mdi:pulse',
  category: 'activity', // catalogue section + the loading wireframe's shape
  size: { default: 'half', resizable: true }, // panels only
  placement: { after: 'health' }, // resolved on add and on every re-add
  refreshPolicy: 'shared-range', // → `widget.range` arrives as from/to timestamps
  requiredScopes: 'ADMINS', // narrows only, intersected with the route's floor
  component: RecentActivityWidget,
});
```

Five things this demo is shaped to make visible, each of which is easy to get
wrong:

- **`id` is a plain name.** `recent-activity`, never
  `flow-extension-demo:recent-activity`. The host stamps the prefix from your
  app's id, so two apps can both ship a `recent-activity`, an app
  cannot register a native id such as `stats`, and an id read back says which app
  it came from. The **stored** id is what lands in every saved layout, which
  makes this the one field that cannot be renamed later without losing every
  placement.
- **Zones are literal strings.** `zones: ['platform-admin-dashboard-widgets']`,
  written out. Bundle verification reviews an app by extracting string literals
  from its source, so a zone assembled by a helper — including the SDK's internal
  `widgetZoneFor(surface)`, which is deliberately **not exported** — extracts as
  nothing and can never be attributed to your app. The zone for a dashboard is
  its surface plus `-widgets`.
- **Do not draw a card, a heading or padding.** `chrome` defaults to `'host'`,
  and the frame draws all of it: the card, the title, the `description` beneath
  it as a subtitle, a window chip for a `shared-range` widget, a provenance
  tooltip from `metric`, the inner padding and the overflow menu. Not one of the
  nine components in `src/widgets/` contains a `<Paper>`, a heading or a `p:`.
  `chrome: 'self'` turns all of that off in exchange for hand-matching a type
  scale that is not yours to own; it exists for host panels that predate the
  widget frame, and an app that reaches for it almost always wants the default.
- **Registering makes a widget eligible, not placed.** A saved layout is
  authoritative, so both of these appear under **Customize** on the dashboard
  rather than on somebody's grid. That is the contract working, not a failure to
  appear. (`placement` decides where it lands _when the user adds it_, and every
  time they re-add it.)
- **A leaf is not a small panel.** It takes `leafOf` and no `size`, its container
  lays it out, and its `widget.pixel` is `{ width: 0, height: 0 }`. The panel
  uses its box to pick a row count; the leaf never reads one.

Your component receives `{ context, widget, actions }`. Every visible element
comes from `context.ui` — a remote app has no MUI of its own. What the frame
draws around you is worth knowing before you draw anything yourself:

| You declare                     | The host draws                                              |
| ------------------------------- | ----------------------------------------------------------- |
| `title`                         | The card heading, and the frame's accessible name           |
| `description`                   | The subtitle under it — the line every native panel carries |
| `refreshPolicy: 'shared-range'` | A window chip beside the title (`24h`, `7d`)                |
| `metric`                        | An info tooltip: formula, source, cadence, delay            |
| `category`                      | The catalogue section, and the loading wireframe's shape    |
| `icon`, `size`, `placement`     | The catalogue card, the grid span, where it lands           |

`widget.range` is
resolved timestamps and never a preset label; `widget.pixel` is the box the host
derived from the grid arithmetic, which a chart needs because ECharts sizes to
its container at init and does not observe resize. `actions` is
`remove` / `resize` / `refresh`; the Recent activity panel calls `resize()` from
an inline control and `remove()` from its empty state.

`refreshPolicy` is a declaration of where your data comes from, and the host acts
on it — all three appear here, plus the fourth case of declaring nothing:

| Policy           | What the host does                                       | Here                         |
| ---------------- | -------------------------------------------------------- | ---------------------------- |
| `'shared-range'` | Hands you `widget.range` as resolved from/to timestamps  | Recent activity, Call volume |
| `'own-cadence'`  | Hands you no range; you own the timer                    | CRM sync queue               |
| `'realtime'`     | Hands you no range; data arrives by push (`sdk.streams`) | Live calls                   |
| _omitted_        | Nothing — for a widget whose content does not go stale   | Demo app links               |

Declaring one you do not need is a claim the host acts on: it hands you a range
and invites a dependency on a control that has nothing to do with your card.

> **`actions.refresh()` is a remount.** The host holds no handle on your queries,
> so refresh is implemented by bumping a token in your component's key: React
> discards the subtree and whatever you do on mount runs again. That is the only
> refresh a host can honestly offer, and it is why the widget that calls it is
> the one on `'own-cadence'` — `SyncQueueTable.tsx` prints its poll count, and
> Refresh visibly restarts it from zero.

Check what you contributed under **Platform → UI SDK management → Registered
apps**, which lists your widget zones and whether each is enabled. A refused
registration logs the reason on the console; it never fails silently.

### Live data — `sdk.streams`

Live platform data comes through `sdk.streams`: one namespace per subject (`calls`,
`queues`, `agents`, `presence`, `contacts`, `notifications`, `subscribers`,
`devices`, `cdrs`, `softphone`) and one named method per feed. You pass handlers for the
events you want; you never name a socket room or an event list. Calling a method
_is_ the subscription, and every method returns a handle with `status`,
`onStatus()` and `unsubscribe()`.

**Live Operations** (`/apps/live-operations`, `pages/liveOperations/`) is the
worked example: a wallboard of eight feeds. `liveFeeds.ts` **retains** each one
when the app starts, so they keep collecting while the page is closed, and the
page attaches to them with `useStream(…, { retain })` (`liveState.tsx`):

```tsx
// App startup (liveFeeds.ts): open for the session; these handlers are called
// for every delivery (0.3.5+).
sdk.streams.retain('queue-stats', (streams) =>
  streams.queues.onDomainQueues({ stats: (q) => sample(q) }),
);

// The page (liveState.tsx): every kept record arrives at once on mount.
const status = useStream(
  sdk,
  (streams) => streams.queues.onDomainQueues({ stats: (q) => upsertQueue(q) }),
  [],
  { retain: 'queue-stats' },
);
```

| Card                | Call                                                                | Grant                |
| ------------------- | ------------------------------------------------------------------- | -------------------- |
| Queues              | `queues.onDomainQueues({ stats })`                                  | `queues`             |
| Agents              | `queues.onDomainQueues({ agentUpdated, agentAdded, agentRemoved })` | `queues`             |
| Live calls          | `calls.onDomainCalls({ updated, ended })`                           | `calls.domain`       |
| Presence            | `presence.onDomain(update)`                                         | `presence`           |
| Phones              | `devices.onDomain(update)`                                          | `devices`            |
| Notifications       | `notifications.onNotification(update)`                              | `notifications.read` |
| User record changes | `subscribers.onDomain(update)`                                      | `subscribers`        |
| Call records        | `cdrs.onDomain({ completed, updated })`                             | `cdrs`               |

What the page is there to show:

- **Status is part of the UI.** Each card prints its stream's status. A `refused`
  stream carries a `message` the host wrote for the user — the domain-calls card
  is refused for anyone below Office Manager, and says so instead of sitting empty.
- **Records change after the call.** A call record arrives on `completed` when
  the call ends, then again on `updated` as its recording, call quality (MOS),
  summary and disposition land. The Call records tab keeps the latest version
  of each record and lists every delivery with the fields that changed.
- **`live.snapshot`** says whether the host replayed what it already held. When
  it is `false` the feed sends changes only. Queue stats, agents and phones are
  like that, so `liveSeed.ts` reads their current state once from the API
  (`/domains/{domain}/callqueues`, `/agents`, `/devices`, where `domain` is
  `managing ?? '~'`) and the streams keep it
  current. On a domain too big to read every agent, it skips that read and the
  agent counts come from each stats event's `domainTotals`.
- **A session change clears the page.** When an admin switches domain or
  masquerades, every stream reports `pending` again; `useResetOnPending`
  (`liveState.tsx`) clears that feed's data, and the new session's follows.
- **Nothing names a permission.** The platform reads these calls out of the
  bundle when a version is submitted and derives the grants (`queues`,
  `calls.domain`, `presence`, `devices`, `notifications.read`, `subscribers`,
  `cdrs`, `softphone`); the host checks them, and the
  operator can switch any grant off platform-wide in SDK Settings.

The app's own softphone feeds the CRM enrichment: `App.tsx` subscribes to
`sdk.streams.softphone.onCallStarted / onCallAnswered / onCallMissed /
onCallEnded`, `services/callEnrichment.ts` looks the caller up in the mock CRM,
and the result reaches `CallerInfoWidget` and the Live Calls dashboard card.

The full reference — every method, its grant, who may see what, and the status
model — ships in the SDK package as `STREAMS.md`: `node_modules/@netsapiens/flow-sdk/STREAMS.md`, or the [Code tab on npm](https://www.npmjs.com/package/@netsapiens/flow-sdk?activeTab=code).

The enriched call reaches `CallerInfoWidget` and the Live Calls card through
`onCallChanges()` in `services/callEnrichment.ts`: a listener set in the app's
own bundle, beside the `activeCallsStore` it keeps. That is the pattern for an
app talking to its own components. The SDK has no event bus for it (it left the
public surface in flow-sdk 0.3.6), and none is needed: every component of an app
runs from the same bundle.

### Remote auth — `auth.requestRemoteAuth()`

When the app needs to call **your own backend** on behalf of the signed-in user,
the host relays a trusted identity handshake so the app never handles Flow
credentials. The **Remote Auth** tab on the demo page
(`pages/demo/RemoteAuthPanel.tsx`) exercises the full `flowContext.auth`
contract live — request a token, reuse the session-cached token, and clear it:

> **Changed in 0.2.x, and it changed silently.** `RemoteAuthRequest.callbackUrl` is
> **ignored** — where the webhook goes is registration data, set by an administrator in
> **Registered Apps**, and may be several endpoints tried in order. Code that passed a
> `callbackUrl` still compiles and still runs; the field simply has no effect. If you are
> migrating from 0.1.x, this is the one to check by hand — see
> [MIGRATION §6.2](MIGRATION-0.1.x-TO-0.2.x.md#62-callbackurl-is-no-longer-yours-to-choose-breaking-but-silent).

```tsx
const { auth } = flowContext;

// Authenticate on load — no button. `status`: idle | pending | ready | error.
const { token, status, error, retry } = useRemoteAuth(
  flowContext,
  'flow-demo-backend',
  { scopes: ['contacts:read'] },
);

// Or on demand, for a "Connect X" button. No callbackUrl: the destination is
// registration data, set by an administrator.
const onDemand = await auth.requestRemoteAuth(
  { vendorId: 'flow-demo-backend', scopes: ['contacts:read'] },
  { timeout: 60000 },
);
// token: { vendorId, accessToken, tokenType?, expiresAt?, refreshToken?, metadata? }

auth.getRemoteAuthToken('flow-demo-backend'); // cached for the session, or null
auth.clearRemoteAuthToken('flow-demo-backend'); // sign out of the vendor
```

The NetSapiens platform binds the identity to the caller's **trusted session**
(never the request's `user.uid`, which is attacker-controllable), checks the
signed-in user is entitled to the app, then POSTs a **single-use auth code** (not a
token) to the callback endpoint(s) **registered for the app** — never a URL from
the request. Your backend:

1. Verifies the `X-NS-Signature` HMAC — `sha256=<hex>` over
   `"<X-NS-Timestamp>." + the raw request body`, using the shared callback secret.
   Hash the bytes **before parsing**; `JSON.stringify(req.body)` will not match.
   (Two RS256 JWTs give secret-less proof against published JWKS:
   `X-NS-Platform-Assertion`, always present, says which cluster is calling;
   `X-NS-Cluster-Verification`, which may be absent, adds NetSapiens' own
   attestation.)
2. Exchanges the code (PKCE) at the `validation_endpoint` from the payload for a
   token that proves the user's identity — and uses the identity from **that
   response**, not the webhook body.
3. Mints its **own** vendor token and returns it — which resolves the promise as
   the `RemoteAuthResponse`.

The panel shows both the client call and the backend verification + exchange
snippet. A runnable reference backend lives in [`examples/vendor-backend/`](examples/vendor-backend/).

> This is the **client half** of the flow; the platform handles the signing,
> callback delivery, code exchange, and response shaping server-side. Two things
> to know: the response is mapped through an explicit allow-list (`access_token`,
> `token_type`, `expires_in`, `refresh_token` — no generic `metadata`
> pass-through today), and the platform sends the `X-NS-Signature` HMAC (the
> required gate) plus a best-effort `X-NS-Cluster-Verification` JWT the backend
> verifies when present. It
> also needs per-app admin config (remote auth enabled, allowed callback
> hostnames, signing secret). Against a host without it the request rejects/times
> out and the panel
> renders the error.

#### Admin config on the app registration

Three fields, and all three must be right or the request fails **before** your
backend is contacted — so an untouched backend log is the expected symptom, not
evidence your server is broken.

| Field                      | Value                                               |
| -------------------------- | --------------------------------------------------- |
| Remote auth enabled        | `yes`                                               |
| Allowed callback hostnames | the callback **origin** — `https://api.example.com` |
| Callback secret            | the same value your backend verifies the HMAC with  |

**Allowed hostnames is a comma-separated list, not JSON.** Write
`https://api.example.com`, or `https://a.example.com,https://b.example.com` for
several. A JSON array (`["https://api.example.com"]`) is read as a single
hostname _including the brackets and quotes_, matches nothing, and the request is
rejected with **403 "Callback URL not allowed"** — which reads like the origin
was wrong when the format was.

Match the **origin only**: scheme + host (+ port if non-standard). A full path
such as `https://api.example.com/flow/callback` will not match.

If a request fails with a **500** and your backend was never called, check
whether your portal session has expired — reload the host and retry before
looking at the registration.

## Route patterns

Patterns decide which host routes an extension applies to:

| Pattern                    | Type             | Example match              |
| -------------------------- | ---------------- | -------------------------- |
| `/manage/call-logs`        | Exact            | `/manage/call-logs`        |
| `/manage/*/call-logs`      | Wildcard segment | `/manage/acme/call-logs`   |
| `/manage/:domain/contacts` | Named param      | `/manage/acme/contacts`    |
| `/manage/*`                | Prefix           | any page under `/manage`   |
| `/*`                       | Global           | every page (use sparingly) |

## Getting started

### Prerequisites

- Node.js 18+ (this repo pins **22.8.0** via `.nvmrc`)
- Access to a Flow server where you can register an app (Platform → UI SDK
  Management)
- The [`@netsapiens/flow-sdk`](https://www.npmjs.com/package/@netsapiens/flow-sdk)
  package is published **publicly** to npm — `npm install` needs no auth.

### Install & develop

```bash
npm install
npm run dev      # or: npm start
```

The app serves at **http://localhost:5005/** and exposes its federated entry at
`http://localhost:5005/remoteEntry.js`. A Flow server loads a `localhost` entry
only when its `NsUISDKDevRemotes` API config is on and you have deployed that
URL; see **Local development** in the `create-flow-app` skill's README template.

### Build

```bash
npm run build    # emits dist/remoteEntry.js + chunks
```

The production build is published to GitHub Pages and served as a CDN for the
remote — see **Hosting on GitHub Pages** below.

## Module Federation

`webpack.config.js` exposes:

```js
exposes: {
  './App': './src/App',
  './pages/DemoPage': './src/pages/DemoPage',
}
```

`react`, `react-dom` and `loglevel` are shared as singletons so the host and
remote use one instance each. React and React DOM in particular **must** stay
singletons: your component renders inside the host's React tree, and a second
copy fails as an invalid-hook-call that names nothing useful.

> Do **not** add `@netsapiens/flow-sdk` to `shared`. The host registers
> `react`, `react-dom`, `react-dom/client`, `loglevel`, `i18next` and
> `react-i18next` and nothing else, so declaring the SDK shared cannot resolve to
> a host copy — and since SDK 0.2.x, bundle verification **rejects** a bundle
> that declares it. Let it bundle normally.

> Do **not** add `@mui/material` to `shared`. It is not registered by the host,
> and declaring a singleton the host does not provide fails at load. Use MUI via
> `flowContext.ui` / `context.ui` so extensions inherit the host theme.

> Do **not** add i18next either — not because it would fail, but because you
> should not be reaching for it. **Localization is owned by the host and the
> SDK**: the host holds the initialised i18next instance with every translation
> already loaded and hands your app a `t()` through the context. Use
> `useLocale()` / `context.t()`. The host's own registration of `i18next` and
> `react-i18next` exists to serve the host and the SDK, not partner `shared`
> blocks.

#### `react-dom/client` — only if your graph reaches it

This demo does **not** declare `react-dom/client`, and that is correct for it: a
Flow remote never mounts itself, so nothing here calls `createRoot`.

If your app is different — most often because
`@ant-design/v5-patch-for-react-19` imports it on your behalf — then sharing
`react-dom` does **not** cover it. `react-dom/client` is a separate build
carrying its own copy of the reconciler and its own baked-in React version, so
your bundle would keep that copy while `react` resolved to the host's, and fail
to load with React error #527. Declare the exact key, without a fallback:

```js
'react-dom/client': { singleton: true, requiredVersion: '^19.0.0', import: false },
```

`import: false` is deliberate and is the opposite of the rule for everything
else — keeping the fallback emits a chunk that makes the integrity build fail.
Full reasoning in the SDK reference under
"[`react-dom/client`: the deep entry that breaks everything, quietly](https://www.npmjs.com/package/@netsapiens/flow-sdk)".

### Bundle verification (SDK 0.2.x)

Flow verifies an extension bundle before it will load it: it fetches
`remoteEntry.js`, every chunk and every source map, hashes them, runs a content
analyser and records a verdict. A version that passes is promoted, and the host
pins a SHA-384 of the exact bytes it verified. `webpack.config.js` carries the
four settings that satisfy this:

| Setting                                                            | Why                                                                                                                                                                                |
| ------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `SubresourceIntegrityPlugin({ hashFuncNames: ['sha384'] })`        | Emits chunk integrity values — the platform pins the entry, and without these nothing the entry loads is covered                                                                   |
| `output.crossOriginLoading: 'anonymous'`                           | Required for the browser to verify those values at all; SRI cannot check an opaque cross-origin response                                                                           |
| `devtool: 'source-map'` (with `sourcesContent`, never `noSources`) | **A bundle with no source maps is rejected outright**, not warned about                                                                                                            |
| `@netsapiens/flow-sdk` absent from `shared`                        | See above                                                                                                                                                                          |
| `optimization.splitChunks.cacheGroups.default: false`              | Only needed once a bundle imports `react-dom`: webpack's default cache group can otherwise emit a chunk with no file, and the integrity plugin cannot resolve a placeholder for it |

Check a build before publishing — these are the same checks the platform runs:

```bash
npm run build
npm run verify     # flow-verify-bundle ./dist
```

⚠️ **The remote entry URL is stable, so the version field is load-bearing.** This
app republishes over the same
`https://netsapiens.github.io/flow-sdk-demo/remoteEntry.js` on every deploy.
Publish new bytes without changing the version and _nothing re-verifies_ — the
platform goes on enforcing the previous bytes' hash against the new ones at the
same URL, every host fails its integrity check, and the extension simply stops
appearing with no verdict and no finding to explain it. Because that failure is
silent, the deploy workflow guards it: it fails the build if `src`,
`webpack.config.js`, `package.json` or `package-lock.json` changed without a
version bump, and again if `package.json` and
`src/integration/zones.manifest.json` disagree on the version.

So: **bump `version` in both `package.json` and `zones.manifest.json` with every
change to the bundle**, and release in a maintenance window — between the deploy
and re-verification the CDN serves new bytes while the platform still pins the
old hash.

## FlowContext

The exposed `./App` component receives a `FlowContext` and initializes the SDK
via `useRemoteApp()`. Page components read the live context with
`useFlowContext()` (wrapped in `FlowContextProvider`). Key fields:

| Field              | Purpose                                                               |
| ------------------ | --------------------------------------------------------------------- |
| `user`             | Signed-in user (`displayName`, `domain`, `extension`, `scope`, …)     |
| `api`              | Authenticated NetSapiens v2 API client (`get`/`post`/`put`/`delete`)  |
| `theme` / `locale` | Host theme (`light`/`dark`) and i18next translation function          |
| `navigate`         | Navigate the host router                                              |
| `ui`               | Themed MUI Aurora components + templates (PageTemplate, SidePanel, …) |

## UI rule — never hand-roll a component

Every visible element in `src/` comes from the host component kit handed over as
`flowContext.ui` (`ui.*` components, `ui.templates.*`). Hand-rolled markup
styled from `ui.theme` / `ui.styles` is **not** allowed: those two objects are a
mount-time snapshot the host never rebuilds, so anything painted from them keeps
the colors of whichever mode was active when the page first mounted and stops
following the host's light/dark toggle. Colors go in `sx` as palette paths
(`color='text.secondary'`, `borderLeftColor='primary.main'`), which the host
resolves live.

The full rule, its three carve-outs, and the grep commands that check it are in
[CLAUDE.md](CLAUDE.md).

## Project structure

```
src/
  App.tsx                     # Orchestrator: registers all routes, extensions, column, widgets, softphone streams
  api/
    callsApi.ts               # NetSapiens v2 API helper (live recent-calls/CDR fetch via the proxy)
  columns/
    CrmStatusColumn.tsx       # CRM Status (SDK) column cell
  components/
  content/
    demoContent.ts            # Static content for DemoPage (capabilities, zones, patterns, snippets)
  extensions/                 # One component per zone extension
  widgets/                    # One component per dashboard widget (panels, leaves, a container)
  mocks/                      # Demo fixtures (people, CRM, recent calls, sample table) — see mocks/README.md
  panels/                     # Side-panel content (CallDetails, QuickLinks)
  services/
    callEnrichment.ts         # Call-event → CRM enrichment + shared active-calls store
  pages/
    DemoPage.tsx              # Tab shell for the overview/walkthrough tour
    demo/                     # One component per DemoPage tab (+ accents.ts palette paths)
    ComponentShowcasePage.tsx # Composes the showcase sections
    showcase/sections/        # One self-contained section per shared UI component
    CrmIntegrationPage.tsx    # Full page: remoteAuth connect + live API call + CRM matching
    DomainCrmSyncPage.tsx     # Full page, DOMAIN-SCOPED: registered at /manage/:domain, reads useManagingDomain()
```

## Hosting on GitHub Pages

A Module Federation remote is just static files (`remoteEntry.js` + chunks), so
**any** static host with permissive CORS works as the CDN. This repo uses
**GitHub Pages** — it's free, sends `Access-Control-Allow-Origin: *` by default,
and deploys straight from CI. The host loads this remote from:

```
https://netsapiens.github.io/flow-sdk-demo/remoteEntry.js
        └──── Pages origin ────┘└─ repo path ─┘
```

> Opening that URL in a browser shows a blank page — this is a **headless
> remote**. It renders nothing on its own; it only mounts inside the Flow host.

### How the build is wired for Pages

Two settings make a remote work from a Pages **subpath** (`/<repo>/`):

- **`webpack.config.js` → `output.publicPath: 'auto'`** (production). The remote
  resolves its own chunk URLs at runtime from wherever `remoteEntry.js` was
  loaded, so it doesn't care that Pages serves it under `/flow-sdk-demo/`.
  Never hard-code an absolute `publicPath` for a Pages-hosted remote.
- **`.nojekyll`** — added by the workflow. Without it, GitHub's Jekyll layer
  strips files/folders that start with `_`, which breaks some webpack output.

### Set up your own GitHub Pages CDN

To host your own SDK remote (replace `flow-sdk-demo` with your repo name):

1. **Create a repo** and push your app. A **public** repo gets Pages for free;
   private repos need GitHub Pro/Team/Enterprise.
2. **Enable Pages with the Actions source.** Repo **Settings → Pages → Build and
   deployment → Source: GitHub Actions**. (Or via CLI:
   `gh api -X POST repos/<owner>/<repo>/pages -f build_type=workflow`.)
3. **Add the deploy workflow.** Copy `.github/workflows/deploy-pages.yml`. It
   runs on every push to `main`: `npm ci` → `npm run build` → `touch
dist/.nojekyll` → upload `dist/` → `actions/deploy-pages`. Pushing a file
   under `.github/workflows/` requires your `gh`/git token to have the
   **`workflow`** scope (`gh auth refresh -s workflow`).
4. **Push to `main`.** Watch the run with `gh run watch` (or the Actions tab).
   First deploy can take a minute to go live.
5. **Verify the CDN** serves the remote with CORS:

   ```bash
   curl -sI https://<owner>.github.io/<repo>/remoteEntry.js \
     | grep -iE 'http/|content-type|access-control-allow-origin'
   # → 200, application/javascript, access-control-allow-origin: *
   ```

### Register the remote with a Flow host

Hosting the files is only half of it — the host won't load a remote it doesn't
know about. In the host's **Registered Apps** UI (or the platform API):

1. **`remote_entry_url`** → your `https://<owner>.github.io/<repo>/remoteEntry.js`.
2. **`webpack_module`** → must **exactly** match the `name` in your
   `ModuleFederationPlugin` config (`MODULE_FEDERATION_NAME` in
   `webpack.config.js`, here `flowExtensionDemo`). The host looks up
   `window[<webpack_module>]` after loading the script; a mismatch fails with
   `Container '<name>' not found`. This value is **immutable** — it's baked into
   the deployed bundle and is the root the server derives the app id from.
3. **`version`** → the `version` from `package.json`. Since SDK 0.2.x this is
   what tells the platform to re-verify the bytes at the (stable) remote entry
   URL. Registration alone verifies nothing: an app that has never had a version
   submitted sits at `verification_status: none`, and the host filters it out of
   `/ui-extensions?purpose=runtime` before the browser ever sees it — so it
   registers no routes and no zones while looking perfectly healthy in the list.
   Saving the **same** version again is a no-op; the platform refuses to
   re-verify a pair it has already judged. Bump it.

> **Do not send `integrity_hash`.** Earlier revisions of this README described it
> as an optional SRI hash you computed and registered yourself. That is
> withdrawn: the platform now computes the pin from the bytes it fetched at
> verification time, the field is ignored if sent, and accepting a caller-supplied
> value would make the pin self-attested.

Read the verdict after saving — **expand the row** to see the findings. Three
outcomes, and the middle one is not a failure: `approved` loads, `flagged` also
**loads** (findings were recorded, so read their _severity_ — an `info` finding
contributes nothing), and only `rejected` blocks. Expect a `size-delta` flag on
the first 0.2.x submission: taking the SDK out of `shared` moves it into the
bundle, and the analyser notes sharp size changes against the last approved
version. That is correct behaviour and needs no action.

The host also gates remotes by an **approved-domains** allowlist (defense in
depth, on top of registration), and it is an **operator** setting — not something
a partner controls.

⚠️ **`*.github.io` is not on it by default, and must not be seeded.** It is a
public multi-tenant host: anyone can publish there, so allowlisting it by default
would hand every GitHub user a foothold to serve JavaScript into the portal. The
default list covers only localhost and NetSapiens-owned domains.

GitHub Pages remains a perfectly good jump-off point — it is where this demo is
hosted — but an operator has to add the origin **deliberately**. Two consequences
worth knowing:

- The change is **non-retroactive**: a server that already had `*.github.io`
  saved keeps it. So this genuinely works on some installs and not on others,
  which is exactly why the opposite claim survived here for so long.
- "Publish to Pages and register it" is therefore **not** a complete answer for a
  partner on a fresh platform. If submission fails at the fetch stage, ask the
  operator to confirm the origin is allowed. The same warning is in
  [`MIGRATION-0.1.x-TO-0.2.x.md`](./MIGRATION-0.1.x-TO-0.2.x.md).

## Releasing a new version

The partner-facing contract is in the SDK README under **Managing your app**. What
follows is what this repo specifically requires — the parts CI enforces and a
person will otherwise forget.

**Two version fields must move together**, and the workflow fails the build if
either is wrong:

| File                                  | Why                                                                                                                                                                                                                                                                                                        |
| ------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `package.json`                        | The remote entry URL is stable, so this is the only thing that tells the platform to re-verify. New bytes under an unchanged version leave it enforcing the **old** hash at the same URL — every host fails its integrity check and the extension silently stops appearing, with no verdict to explain it. |
| `src/integration/zones.manifest.json` | Carries the app's version too; CI fails if it differs from `package.json`.                                                                                                                                                                                                                                 |

The steps, start to finish:

```bash
# 1. bump BOTH version fields (package.json + zones.manifest.json)
# 2. if the SDK dependency changed, install it
npm install

# 3. the same gates CI runs — fail here, not in Actions
npm run build
npm run verify        # expect PASS; version-bump / cors / submit are `note` by design
npm run typecheck     # must be clean — 0 errors, and CI gates it
npm run lint
npm run format

# 4. commit and merge to main. Pushing main triggers the Pages deploy.
```

Then, on the platform:

5. Wait for the Pages deploy to finish — the platform fetches the bytes at
   submission time, so submitting before Pages has published verifies the _old_
   bundle.
6. In **Platform → UI SDK Management → Registered Apps**, press **Deploy** on the
   app's row. Nothing else needs changing — that is the point of this action, and
   it assigns the next free version itself. (Saving the app form also deploys, for
   when you have edited the Remote Entry URL or Version by hand.) Submission,
   verification and promotion are one step: it fetches, analyses and hashes the
   bundle, then promotes on `approved` or `flagged`.

   If the published bytes are identical to the verified ones you get "already up
   to date" — a success, not a no-op.

7. If it comes back `rejected`, fix the bundle and save again. The rejected version
   keeps its number and the auto-bump skips it.

⚠️ **Between the Pages deploy and the Deploy press**, the CDN serves new bytes
while the platform still pins the old hash. Anyone starting a fresh session in
that window will not see the extension. Keep the gap short.

## Notes

- **Live data on the CRM Integration page.** On load it calls
  `GET /domains/{domain}/users/{user}/cdrs` for the signed-in user via
  `flowContext.api`, tags those rows **● Live**, and shows sample calls
  alongside them so the page is never empty. Caller matching reuses the same mock
  CRM directory that powers the inbound-call widget. (Authenticating to a real CRM
  backend on behalf of the user — the `auth.requestRemoteAuth` flow — is
  demonstrated standalone on the **Remote Auth** tab and can gate this page later.)
- **The on-demand side panel** is Flow's own right-hand drawer, mounted once by
  the host. Open it with `useSidePanel(context)` / `context.openSidePanel` in
  host-rendered components, or `useSidePanel()` / `sdk.openSidePanel()` in a
  page.
