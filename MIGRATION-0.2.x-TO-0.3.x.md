# Flow SDK 0.2.x → 0.3.x

The guide for partners moving an app built on `@netsapiens/horizon-sdk` 0.2.x to
**`@netsapiens/flow-sdk` 0.3.x**: what changed, what you must do, and where this
demo shows each change working. Use the latest 0.3.x release (`^0.3.6`); 0.3.6
is the minimum, and the code here is written against it.

```bash
npm uninstall @netsapiens/horizon-sdk
npm install @netsapiens/flow-sdk@^0.3.6
```

The SDK's own **Migration** section (`node_modules/@netsapiens/flow-sdk/README.md`)
and **`STREAMS.md`** are the references; this guide puts them in order and adds
what moving a real app taught us. The earlier upgrade is in
[MIGRATION-0.1.x-TO-0.2.x.md](./MIGRATION-0.1.x-TO-0.2.x.md), and everything it
says about bundle verification still holds.

---

## In one minute

> **⚠️ Rebuild on `@netsapiens/flow-sdk` ^0.3.6 (the latest 0.3.x) and deploy
> the new version before 2026-10-31.** Today's Flow hosts still run apps built on
> older SDKs. After 2026-10-31, Flow hosts give an app built on an SDK older than
> 0.3.6 (all of `@netsapiens/horizon-sdk` 0.2.x and `@netsapiens/flow-sdk`
> 0.3.0–0.3.5) no event bus: it loads but adds nothing to Flow (no pages, zones,
> columns or widgets), and the browser console says why. A new version built on
> an older SDK is rejected when you submit it.

1. **The package is renamed.** `@netsapiens/horizon-sdk` → `@netsapiens/flow-sdk`,
   and every `Horizon*` name → `Flow*`. The rename itself changes no behaviour;
   the changes that do are the next three.
2. **Live data moved to `sdk.streams`.** `subscribeToCallEvents` and
   `subscribeToStream` are removed, and a 0.2.x app's stream subscriptions
   report nothing on a host that serves `sdk.streams`.
3. **Grants are no longer declared.** The platform reads your `sdk.streams`
   calls out of your bundle when you submit a version. `call-events:listen` and
   the other `*:listen` capabilities are gone.
4. **The event bus is not an app API any more.** The host features it carried
   have methods (sending a notification gets its method,
   `sdk.sendNotification()`, in the release after 0.3.6; see
   [Part 4](#part-4--the-event-bus-leaves-the-public-surface)), and your own
   components talk through a module in your bundle.
5. **New, optional:** call records (`cdrs`), retained streams that outlive a
   page, and `rounded` cards.

Your build and release process does not change: the same build configuration,
the same bundle verification, the same "bump the version on every release"
rule.

---

## Do I have to move now?

**Yes: before 2026-10-31.** Until then your app keeps loading as it is, except
that a 0.2.x app's `subscribeToCallEvents` / `subscribeToStream` feeds already
report nothing on hosts that serve `sdk.streams`. After that date, an app built
on an SDK older than 0.3.6 loads but adds nothing to Flow, and a new version
built on one is rejected at submission.

The order that avoids trouble: rebuild on `@netsapiens/flow-sdk` ^0.3.6,
publish, and submit the new version on every server you are registered on,
well before 2026-10-31.

---

## Part 1 — The rename

The SDK is renamed with the product. Replace the dependency and update every
import; the behaviour behind each name is unchanged.

| 0.2.x (`@netsapiens/horizon-sdk`)                                 | 0.3.x (`@netsapiens/flow-sdk`)                                             |
| ----------------------------------------------------------------- | -------------------------------------------------------------------------- |
| `HorizonContext`, `HorizonContextProvider`, `useHorizonContext`   | `FlowContext`, `FlowContextProvider`, `useFlowContext`                     |
| `HorizonUser`, `HorizonAuth`, `HorizonApiClient`                  | `FlowUser`, `FlowAuth`, `FlowApiClient`                                    |
| `HorizonUI`, `HorizonUITemplates`, `HorizonScopeVocabulary`       | `FlowUI`, `FlowUITemplates`, `FlowScopeVocabulary`                         |
| `HorizonSDKError`, `createHorizonSDKError`, `HorizonSDKErrorCode` | `FlowSDKError`, `createFlowSDKError`, `FlowSDKErrorCode`                   |
| `horizon-verify-bundle`                                           | `flow-verify-bundle`                                                       |
| `HorizonEventBus`                                                 | Not public; see [Part 4](#part-4--the-event-bus-leaves-the-public-surface) |

By convention the context variable is now `flowContext`:

```tsx
// 0.2.x
export default function App(horizonContext: HorizonContext) {
  const { sdk } = useRemoteApp(horizonContext, __MF_NAME__);

// 0.3.x
export default function App(flowContext: FlowContext) {
  const { sdk } = useRemoteApp(flowContext, __MF_NAME__);
```

> **Do not rename your own Module Federation container because the SDK was
> renamed.** Your `webpack_module` (the `ModuleFederationPlugin` `name`) is your
> app's identity: the platform derives your app id from it. Change it and the
> platform sees a **new app**: it needs registering, verifying and enabling
> again, and dashboards that saved your widgets lose them. This demo did rename
> its container (`horizonExtensionDemo` → `flowExtensionDemo`) because it is the
> reference app; yours does not need to.

---

## Part 2 — Live data is `sdk.streams`

### 2.1 Old call, new call

`sdk.subscribeToStream()`, `sdk.subscribeToCallEvents()`, their `unsubscribe…`
pairs, and the `StreamId`, `StreamEvent` and `CallEventType` types are removed.
Each subject is now a namespace and each feed a named method:

| 0.2.x                                                | 0.3.x                                                                                                     |
| ---------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| `sdk.subscribeToCallEvents(['call-started', …], cb)` | `sdk.streams.softphone.onCallStarted(cb)`, `onCallAnswered`, `onCallMissed`, `onCallEnded`: one per event |
| `sdk.subscribeToStream('subscriber', …)`             | `sdk.streams.subscribers.onDomain(cb)` or `.onUser(user, cb)`                                             |
| `sdk.subscribeToStream('device', …)`                 | `sdk.streams.devices.onDomain(cb)`                                                                        |
| `sdk.subscribeToStream('registration', …)`           | `sdk.streams.devices.onDomain(cb)`, reading `registered`                                                  |

### The catalogue

Everything `sdk.streams` offers today. Each method returns a `Subscription` and
takes an optional last argument `{ onStatus?, requiredScopes? }`. The full
reference, with every handler, payload and rule, is **Method reference** and
**Who can see what** in `STREAMS.md`
(`node_modules/@netsapiens/flow-sdk/STREAMS.md`).

| Subject         | Methods                                                          | What it carries                                                                                                              | Grant                                           | Who may use it                                                                                                                                                                 |
| --------------- | ---------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `calls`         | `onDomainCalls(handlers)`, `onExtension(ext, handlers)`          | Calls in progress: `updated`, `ended`                                                                                        | `calls.domain`, `calls.user`                    | Domain calls: Office Manager and Call Center Supervisor; Super User and Reseller in their own domain. An extension: anyone for their own; the same admins for others.          |
| `queues`        | `onQueue(queue, handlers)`, `onDomainQueues(handlers)`           | `stats`; waiting callers (`waiting`, `left`); calls through the queue; agents (`agentUpdated`, `agentAdded`, `agentRemoved`) | `queues`, plus `calls.queue` for caller details | Office Manager, Call Center Supervisor, Super User, Reseller. A Call Center Agent: `onQueue` for their own queues only, without caller details. `onDomainQueues`: admins only. |
| `agents`        | `onAgent(agent, handlers)`                                       | One agent across every queue they belong to                                                                                  | `queues`                                        | The admins above for any agent; an agent for themselves.                                                                                                                       |
| `presence`      | `onDomain(handler)`                                              | Presence changes (changes only)                                                                                              | `presence`                                      | Everyone, in their own domain.                                                                                                                                                 |
| `contacts`      | `onDomain(handler)`, `onUser(user, handler)`                     | Contact records                                                                                                              | `contacts`                                      | Everyone, in their own domain.                                                                                                                                                 |
| `notifications` | `onNotification(handler)`                                        | The user's own notifications and the domain's                                                                                | `notifications.read`                            | Everyone, their own.                                                                                                                                                           |
| `subscribers`   | `onDomain(handler)`, `onUser(user, handler)`                     | User record changes                                                                                                          | `subscribers`                                   | Domain: the admins above. A user: those admins, or the user themselves.                                                                                                        |
| `devices`       | `onDomain(handler)`                                              | Phone registration                                                                                                           | `devices`                                       | Office Manager, Call Center Supervisor, Super User: the whole domain. Basic and Advanced Users: their own devices only.                                                        |
| `cdrs`          | `onDomain(handlers)`, `onUser(user, handlers)`                   | Call records: `completed`, then `updated` as recording, call quality, summary and disposition land                           | `cdrs`                                          | The same users as domain calls.                                                                                                                                                |
| `softphone`     | `onCallStarted`, `onCallAnswered`, `onCallMissed`, `onCallEnded` | The signed-in user's own softphone calls                                                                                     | `softphone`                                     | Everyone, their own.                                                                                                                                                           |

```tsx
// 0.2.x
const stop = sdk.subscribeToCallEvents(
  ['call-started', 'call-ended'],
  (event) => handle(event),
);
// …
stop();

// 0.3.x
const started = sdk.streams.softphone.onCallStarted(handle);
const ended = sdk.streams.softphone.onCallEnded(handle);
// …
started.unsubscribe();
ended.unsubscribe(); // sdk.cleanup() also closes everything
```

**The softphone payload changed shape.** `from` / `to` are replaced by `remote`
(the other party) plus `direction`. Work out which side your user was on from
`direction`:

```tsx
sdk.streams.softphone.onCallStarted((event) => {
  const inbound = event.direction === 'inbound';
  const from = inbound ? event.remote.number : myExtension;
  const to = inbound ? myExtension : event.remote.number;
});
```

The demo's version is `createCallEventHandler` in `src/services/callEnrichment.ts`,
wired up in `src/App.tsx`.

### 2.2 In a component: `useStream`

`useStream` opens the subscription on mount, closes it on unmount, and returns
its status:

```tsx
const status = useStream(
  sdk,
  (streams) => streams.queues.onDomainQueues({ stats: (q) => upsert(q) }),
  [],
);
if (status.state === 'refused') return <Alert>{status.message}</Alert>;
```

### 2.3 Status is part of your UI

Every subscription has a `status` (and `onStatus` to watch it):

| `status.state` | Meaning                                                                             | What to do                                                                                                                            |
| -------------- | ----------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| `pending`      | Asked for; not answered yet. Also sent again on a session change.                   | Show a quiet loading state. **After `live`, it means clear what you hold** ([Part 3](#part-3--retained-streams-and-session-changes)). |
| `live`         | Data is flowing. `snapshot: true` means the host replayed what it held.             | When `snapshot` is `false` and you need the current state, read it from the API ([Part 5](#part-5--feeds-with-no-starting-snapshot)). |
| `refused`      | The host will not serve this, with a `reason` and a `message` written for the user. | Show the `message`. Do not retry in a loop.                                                                                           |
| `unavailable`  | The live connection dropped. `retrying: true` means it resumes by itself.           | Show that the data may be stale.                                                                                                      |
| `unconfirmed`  | No answer within 5 seconds: almost always a host that predates `sdk.streams`.       | Explain that live data is not available here.                                                                                         |

A `refused` card that says why ("Your user scope does not allow call records for
the whole domain") is correct behaviour, not an error. Every card in the demo's
**Live Operations** page shows its stream's status this way (`parts.tsx`,
`StreamNote`).

### 2.4 Grants come from your source, not a declaration

There are no `*:listen` capabilities to declare. When you submit a version, the
platform reads the `sdk.streams` calls in your bundle and derives the grants
(`calls.domain`, `queues`, `presence`, `devices`, `cdrs`, `softphone`, …). When
that version is promoted, the grants go live with it. An operator can switch any
grant off platform-wide in SDK Settings.

What follows from that:

- **Write the calls plainly.** Detection looks for `.<subject>.<method>(` in your
  source. `streams[subject][method](…)` is not detected and is refused at runtime
  as `not-granted`.
- **Keep `sourcesContent` in your source maps.** Detection reads your source
  from them; bundle verification already requires it.
- **A new stream call needs a new version.** Add one, publish, and submit the
  version so it is analysed.
- **Widget gates change name:**

  ```tsx
  // 0.2.x
  requiredPermissions: ['call-events:listen'],
  // 0.3.x: the streams:<grant> the widget depends on
  requiredPermissions: ['streams:softphone'],
  ```

### 2.5 The user's scope still applies

Your app sees only what the signed-in user may see. For example, domain calls
and call records are for Office Managers and Call Center Supervisors in their
domain, and for Super Users and Resellers in their own domain only. The full
table is **Who can see what** in `STREAMS.md`. You can narrow it further, never
widen it, with `requiredScopes` in a method's last argument:

```tsx
sdk.streams.calls.onDomainCalls(
  { updated: upsertCall, ended: dropCall },
  { requiredScopes: 'DOMAIN_MANAGERS' },
);
```

---

## Part 3 — Retained streams and session changes

Optional, and worth it for any page that should show what happened while it was
closed.

**Retain at startup, attach in the page.** `useStream` closes with its
component, so a page left and reopened starts empty. `sdk.streams.retain(key, …)`
opens the subscription for the session instead, and the SDK keeps the latest
copy of each record. The page attaches with `{ retain: key }` and gets every
kept record in one batch on mount:

```tsx
// At startup, beside registerRoute: these handlers run for every delivery.
sdk.streams.retain('domain-calls', (streams) =>
  streams.calls.onDomainCalls({ updated: countCall, ended: uncountCall }),
);

// In the page:
const status = useStream(
  sdk,
  (streams) => streams.calls.onDomainCalls({ updated: upsert, ended: drop }),
  [],
  { retain: 'domain-calls' },
);
```

- **`retain`'s own handlers run for every delivery**, whether or not a page is
  attached, so a counter or a history built in them stays current.
- **`pending` after `live` means start again.** When the session changes
  (a different user, scope or managed domain, for example an admin switching
  domain), each stream reports `pending` before the new `live`. Retained streams
  drop what they kept; clear your own state on it too, or the previous domain's
  data stays on screen.

  ```tsx
  // demo: useResetOnPending in src/pages/liveOperations/liveState.tsx
  const wasLive = useRef(false);
  useEffect(() => {
    if (status.state === 'live') wasLive.current = true;
    else if (status.state === 'pending' && wasLive.current) {
      wasLive.current = false;
      clearMyState();
    }
  }, [status.state]);
  ```

The demo retains eight feeds in `src/pages/liveOperations/liveFeeds.ts` and
attaches to them in `liveState.tsx`.

---

## Part 4 — The event bus leaves the public surface

The bus is how the SDK talks to the host, not an app API. `eventBus` is gone
from `FlowContext` and `ExtensionContext`, and `FlowEventBus` is no longer
exported, so code that used it stops compiling. Each use has a replacement:

| 0.2.x                                                                                                                              | 0.3.x                                                                                                                                                                                                                                                             |
| ---------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `useSidePanel(context.eventBus)` / `useSidePanel(eventBus, appId)`                                                                 | In a widget, extension or column: `useSidePanel(context)` or `context.openSidePanel?.(config)` / `context.closeSidePanel?.()`. In a page: `useSidePanel()` with no argument under `FlowContextProvider`, or `sdk.openSidePanel(config)` / `sdk.closeSidePanel()`. |
| `useTheme(context.eventBus, context.theme)`                                                                                        | `useTheme(context)`, or read `context.theme`                                                                                                                                                                                                                      |
| `useManagingDomain(context.eventBus, …)`                                                                                           | `useManagingDomain(context)`, or read `context.managing`                                                                                                                                                                                                          |
| `useRoute(eventBus, …)`, `useRouteFromModule`, `useDynamicExtension`, `useDynamicColumn`, `createRemoteAppSDK`, `new RemoteAppSDK` | Pass `flowContext` instead of the bus                                                                                                                                                                                                                             |
| `eventBus.emit('my-app:thing', …)` / `.on(…)` between your own components                                                          | A module-level emitter or store in your bundle (below)                                                                                                                                                                                                            |
| `condition: (context) => Boolean(context.eventBus)` on a widget                                                                    | Test what the widget really needs, e.g. `Boolean(context.user?.username)`                                                                                                                                                                                         |
| `eventBus.emit('notification:send', …)` to raise a notification                                                                    | `sdk.sendNotification({ title, body?, severity?, link?, id? })`, in **the release after 0.3.6** (see below). The 0.2.x event had already stopped working once hosts scoped the bus, so no existing app depends on it.                                             |

`useSidePanel(context)` calls `context.openSidePanel` on hosts that have it and
falls back on older ones, so the same call works on both. `context` here is a
host-rendered component's own context; a page's `flowContext` has no side-panel
methods, so a page uses `useSidePanel()` or `sdk.openSidePanel()`.

**What each host event on the bus became.** Nothing an app could do over the
bus is lost. Sending a notification gets its method in the release after 0.3.6:

| On the bus in 0.2.x                                                      | In 0.3.x                                                                                                                          |
| ------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------- |
| `theme:changed`, `locale:changed`, `domain:changed`                      | `useTheme()` / `context.theme`, `useLocale()`, `useManagingDomain()` / `context.managing`                                         |
| `stream:subscribe`, `call-events:*`                                      | `sdk.streams` ([Part 2](#part-2--live-data-is-sdkstreams))                                                                        |
| `route:*`, `dynamic-extension:*`, `dynamic-column:*`, `dynamic-widget:*` | `sdk.registerRoute()`, `registerDynamicExtension()`, `registerDynamicColumn()`, `registerWidget()` and their `unregister…` pairs  |
| `side-panel:open`, `side-panel:close`                                    | `useSidePanel(context)` / `context.openSidePanel` in host-rendered components; `useSidePanel()` / `sdk.openSidePanel()` in a page |
| `call-control:request`                                                   | `sdk.placeCall()`, `hangupCall()` and the mute methods                                                                            |
| `capability:declare-scopes`                                              | `sdk.declareCapabilityScopes()`                                                                                                   |
| `notification:send`                                                      | `sdk.sendNotification()` (the release after 0.3.6)                                                                                |
| Your own `my-app:*` events                                               | A module in your bundle (below)                                                                                                   |

**Sending a notification** (the release after 0.3.6). `sdk.sendNotification()`
creates a real platform notification for the signed-in user: it shows in the
notification center, persists, and arrives on `sdk.streams.notifications`.

```tsx
sdk.sendNotification({
  title: 'Contact synced', // required, at most 120 characters
  body: 'Jane Doe was added to your CRM.', // optional, at most 1000
  severity: 'success', // 'info' | 'success' | 'warning' | 'error'
  link: '/apps/my-app/contacts', // a path inside Flow, never a URL
  id: 'sync-1042', // optional: the same id again raises nothing new
});
```

It is granted the way streams are, from the `sendNotification(` call in your
source; there is nothing to declare. It is fire-and-forget: a refusal (the
capability switched off, nobody signed in) is logged to the console, not thrown.

**Messages between your own components.** Your pages, extensions and widgets
all ship in one bundle, so share a module. A small listener set beside the state
it describes is enough:

```tsx
// src/services/callEnrichment.ts (the demo's version)
const listeners = new Set<CallListener>();

export function onCallChanges(listener: CallListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

// where calls change:
listeners.forEach((l) => l.updated?.(call));

// in a component:
useEffect(() => onCallChanges({ updated: sync, removed: sync }), []);
```

There is no generic event hook, and you never subscribe to host events yourself:
`useTheme()` / `context.theme`, `useLocale()`, `useManagingDomain()` /
`context.managing`, `sdk.streams` and the side-panel methods cover them.

---

## Part 5 — Feeds with no starting snapshot

Some feeds send **changes only**: queue stats, agent events, presence, device
registration and call records report what changes, not what is. Subscribe to `queues` on a quiet
domain and you see nothing until a caller joins or an agent's state changes.
`status.snapshot === false` tells you which feeds started empty.

Read the current state from the API once, then let the stream keep it current:

```tsx
// demo: src/pages/liveOperations/liveSeed.ts
const queues = await api.get(`/domains/${domain}/callqueues`);
const agents = await api.get(`/domains/${domain}/agents`);
// put these UNDER what the stream has delivered: a streamed record wins
```

Two things we learned doing this in the demo:

- **Read the same domain the streams run on.** Streams run against the
  session's working domain: the user's own, or, for a Super User or Reseller,
  the domain they are managing (where queue stats and agents are served, but
  caller details are not). So read `managing ?? '~'`: the managed domain from
  `useManagingDomain()` when there is one, otherwise `/domains/~/…`, which the
  API resolves to the signed-in session's domain. Do not use
  `flowContext.user.domain`: Flow does not reload apps after a masquerade, so it
  can still be the original user's domain.
- **Keep it proportionate.** A domain with thousands of agents returns one
  `/agents` row per queue membership. The demo checks the queue list first and
  skips the per-agent read on a big domain, taking the agent counts from each
  stats event's `domainTotals` instead (the platform's own figure, counting each
  person once).

---

## Part 6 — Small additions

All optional; nothing to change in an existing app.

- **`rounded` on `ui.Paper` and `ui.Card`.** Both are square by default
  to match the platform. `rounded` gives your own page cards the host's radius.
  Dashboard cards and `ui.WidgetCard` are always square.
- **Call records:** `sdk.streams.cdrs.onDomain(handlers)` and
  `.onUser(user, handlers)`. A record arrives on `completed` when the call ends,
  then again on `updated` as the recording, call quality, summary and disposition
  land. Key records by `recordId` and replace the one you hold.

---

## Part 7 — Ship it

Unchanged from 0.2.x, and as important as ever:

1. **Bump `version` on every release**, and submit that version. Your remote
   entry URL stays the same; the version is what makes the platform fetch,
   verify and pin the new bytes. Publish new bytes without a new version and
   every host refuses to run them (the integrity pin no longer matches), so your
   app silently disappears.
2. **Run `npx flow-verify-bundle ./dist`** before publishing.
3. **Deploy the new version** in Platform → UI SDK Management → Registered Apps
   (**Deploy** assigns the next version if you don't). Grants derived from your
   new `sdk.streams` calls go live when that version is promoted (`approved` or
   `flagged`).
4. **After a masquerade, reload** before testing as the other user: Flow does
   not reload apps in place.

---

## Checklist

- [ ] `@netsapiens/horizon-sdk` removed; `@netsapiens/flow-sdk` ^0.3.6 installed
- [ ] Every `Horizon*` import is the `Flow*` name; `horizon-verify-bundle` is `flow-verify-bundle`
- [ ] Your `webpack_module` is unchanged (unless you mean to become a new app)
- [ ] No `subscribeToCallEvents` / `subscribeToStream`; each feed is an `sdk.streams` method, written plainly
- [ ] Softphone handlers read `remote` + `direction`, not `from` / `to`
- [ ] Widget gates use `streams:<grant>`, not `call-events:listen`
- [ ] Every stream's `refused` status shows its `message`
- [ ] State held from a stream is cleared on `pending` after `live`
- [ ] Change-only feeds are read from the API first, on the streams' domain: `managing ?? '~'`
- [ ] No `eventBus` / `FlowEventBus` anywhere; side panels use `useSidePanel(context)` (host-rendered components) or `useSidePanel()` / `sdk.openSidePanel()` (pages); your own messages go through a module
- [ ] Version bumped, bundle verified, new version submitted

## Where the demo does each of these

| Change                                   | File                                                                                                                        |
| ---------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| `sdk.streams.softphone`, the new payload | `src/App.tsx`, `src/services/callEnrichment.ts`                                                                             |
| `useStream`, status in the UI            | `src/pages/liveOperations/liveState.tsx`, `parts.tsx`                                                                       |
| Retained streams                         | `src/pages/liveOperations/liveFeeds.ts`                                                                                     |
| Clearing on `pending`                    | `useResetOnPending` in `liveState.tsx`                                                                                      |
| Seeding from the API                     | `src/pages/liveOperations/liveSeed.ts`                                                                                      |
| Side panels without the bus              | `src/extensions/QuickActionButton.tsx`, `TopbarHelpButton.tsx`, `src/widgets/LiveCallsWidget.tsx`, `PartnerLinksWidget.tsx` |
| Your own messages                        | `onCallChanges` in `src/services/callEnrichment.ts`                                                                         |
| `rounded` cards                          | `src/pages/liveOperations/parts.tsx` (`Panel`, `Tile`)                                                                      |
