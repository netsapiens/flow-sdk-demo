# Horizon SDK 0.1.x → 0.2.x

> **Historical.** This guide records the Horizon-era 0.1.x → 0.2.x upgrade and keeps
> the names of that time. Since 0.3.0 the SDK is **Flow SDK**
> (`@netsapiens/flow-sdk`, `flowContext`), and this demo is `flow-sdk-demo`.

The single reference for partners maintaining a Horizon extension built against
`@netsapiens/horizon-sdk` 0.1.x: what changed, why it had to, what you must do, and
enough background on how integration works for the rest to make sense.

```bash
npm install @netsapiens/horizon-sdk@^0.2.5
```

0.2.5 is `latest` and the whole 0.2.x line is published. The last 0.1.x release was
**0.1.13**.

> **Where we are.** Horizon extensions are pre-alpha. Nothing here has shipped to a
> public audience yet, and you are among the first partners building against the SDK
> — feeling out the process, giving feedback, and preparing apps for a future
> release. Some of what follows corrects earlier guidance that turned out to be
> wrong, and it says so where that happens. Breaking changes are cheap right now and
> expensive later, which is why they are landing now.

**Contents**

- [How a Horizon extension actually works](#how-a-horizon-extension-actually-works) — background; read once
- [Why 0.2.x happened](#why-02x-happened) — the throughline
- [Part 1 — Already affecting your deployed app](#part-1--already-affecting-your-deployed-app) — **no rebuild needed to bite you**
- [Part 2 — The bundle-verification contract](#part-2--the-bundle-verification-contract-020) — 0.2.0
- [Part 3 — Corrections](#part-3--corrections-in-021-and-022) — 0.2.1, 0.2.2
- [Part 4 — New UI surfaces](#part-4--new-ui-surfaces-023) — 0.2.3
- [Part 5 — Scope declarations](#part-5--scope-declarations-024) — 0.2.4
- [Publishing through the API](#publishing-through-the-api)
- [Troubleshooting](#troubleshooting)
- [Version summary](#version-summary)

---

# How a Horizon extension actually works

Worth reading even if you have been building against 0.1.x for a while, because
most of 0.2.x is a consequence of one fact: **your bundle executes inside the host's
page, in the host's React tree, with the signed-in user's session.** It is not an
iframe.

## Your app is a headless Module Federation remote

You publish a `remoteEntry.js`. The host loads it, asks the container for one
module, and renders it. Your entry component typically renders nothing visible —
it registers surfaces and the host mounts them:

```tsx
export default function App(horizonContext: HorizonContext) {
  const { sdk } = useRemoteApp(horizonContext, __MF_NAME__);
  useEffect(() => {
    sdk.registerRoute({ … });              // a full page in the host's nav
    sdk.registerDynamicExtension({ … });   // a widget in a named host zone
    sdk.registerDynamicColumn({ … });      // a column in a host table
  }, [sdk]);
  return null;
}
```

The host requests **`'./App'` and nothing else**, so that name in `exposes` is part
of the contract, not a convention.

## The publish → load lifecycle

**At publish time**, you push bytes to your CDN and tell the platform a version
changed. The platform then fetches your `remoteEntry.js`, every chunk and every
source map; hashes them; runs a content analyser over the sources; and records a
verdict. A passing version is _promoted_, which pins a SHA-384 of the exact bytes
it verified.

**At page load**, the host runs roughly this:

| Step | What happens                                         | Why it matters to you                                                                                                                                 |
| ---- | ---------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1    | Rate limit — 10 attempts per URL per minute          | A flapping CDN backs off rather than hammering                                                                                                        |
| 2    | Approved-origin check on the URL hostname            | Your CDN origin must be on the platform's `approved-cdn-origins` list. `localhost` and `127.0.0.1` are a built-in dev floor; nothing else is implicit |
| 3    | Decide SRI attributes from the pin and the URL       | `crossorigin` is derived from whether the URL is cross-origin, not stored                                                                             |
| 4    | Append a `<script>` with `integrity` + `crossOrigin` | **The browser enforces the hash. The host never re-checks it**                                                                                        |
| 5    | `container.init(sharedDependencies)`                 | Seeds the federation share scope — see [2.2 §3](#3-take-the-sdk-out-of-shared)                                                                        |
| 6    | `container.get('./App')` → factory → your component  | Wrong `exposes` name fails here, after a clean verification                                                                                           |

Step 4 is worth dwelling on. There is deliberately **no host-side hash comparison**,
because hashing a separate `fetch` proves nothing about the bytes the script tag
goes on to execute. Enforcement is the browser's, which means it is real — and also
means the host cannot give you a nice error message, because an SRI failure fires
the same generic `error` event as a 404 and does not fire
`securitypolicyviolation`. That single browser behaviour is why the failure in
[2.1](#21-bump-the-version-every-time-the-bytes-change) is as invisible as it is.

A pinned load is **not retried** — a hash mismatch is deterministic, so retrying
only delays the failure.

## At runtime, the host gates what you registered

Registration is a request, not a grant. Every surface you register is filtered
before it renders, against three independent things:

- **Capabilities your app was granted** (`requiredPermissions`, e.g.
  `call-events:listen`) — what the _app_ may do. Also subject to a platform-global
  toggle an operator controls, re-checked on every stream delivery so a disable
  takes effect immediately rather than at next subscribe.
- **The signed-in user's scope** — who the _person_ is. This is what
  [Part 5](#part-5--scope-declarations-024) is about.
- **Your app's identity**, which the host stamps from the bound app rather than
  reading from your payload. That is what makes reservations like
  [`/marketplace`](#13-marketplace-is-reserved) enforceable rather than advisory.

---

# Why 0.2.x happened

0.1.x trusted two things it should not have.

**It trusted the bundle.** The platform recorded a URL and loaded whatever was
there, whenever it was there. Nothing tied the bytes an administrator approved to
the bytes a user's browser executed. Partner code running in the host's page with
the user's session is a meaningful amount of trust to extend on the strength of a
URL. [Part 2](#part-2--the-bundle-verification-contract-020) closes that: the
platform verifies specific bytes and the browser refuses anything else.

**It trusted the navigation entry to be the gate.** Menu visibility and route
access were computed separately, so hiding a menu item from a user was purely
cosmetic — the page still opened for anyone who typed the URL. That is not a
partner-facing feature so much as a defect, and
[Part 1](#part-1--already-affecting-your-deployed-app) is the fix landing on apps
that were relying on the old behaviour without knowing it.
[Part 5](#part-5--scope-declarations-024) then gives you a supported way to say who
a surface is for, since the old implicit way is gone.

The rest — [0.2.1 and 0.2.2](#part-3--corrections-in-021-and-022) — are corrections
to 0.2.0, and [0.2.3](#part-4--new-ui-surfaces-023) is unrelated additive work.

---

# Part 1 — Already affecting your deployed app

Nothing here requires a rebuild. It is already true of whatever bundle you have
registered right now, so read it before you conclude something broke on your side.

## 1.1 Pages under `/manage` and `/platform` are enforced on the URL

Both sections carry an audience of **Admin, Super User and Reseller**. That was
always true of the _navigation entry_. It was not true of the _page_: the URL
opened for anyone signed in.

Menu visibility and route access are now derived from one source, so they cannot
disagree. A user outside that set who types the URL is redirected away.

**Why it changed.** A hidden menu item that still serves the page to anyone with
the link is not access control, and the two halves drifting apart is exactly how a
page ends up advertised to users who are then bounced out of it.

**What it looks like if it bites you.** You registered a page under `/manage`
intending it for office managers. They never saw the menu item, so you sent them a
link, or they bookmarked it. That link now bounces them.

**Two remedies:**

- **Move the page to `/apps`** — no audience floor, so it opens for any signed-in
  user. Changing `parentPath` is a rebuild and a republish.
- **Keep it and declare the audience** with
  [`requiredScopes`](#part-5--scope-declarations-024). This can only ever _narrow_;
  you cannot declare your way to a wider audience than the section allows. If you
  genuinely need office managers under `/manage`, you need `/apps` instead.

`/home` (the "My Account" tree) has no floor either, and is unaffected.

## 1.2 `parentPath` is an allowlist

A page may be registered under exactly these top-level prefixes:

```
/apps        /manage        /platform        /home
```

plus any path nested beneath one your app already registered — `/apps/<your-app>`
then `/apps/<your-app>/settings` works, because each segment is itself registered.
Only the _top_ segment is checked, so legitimate nesting keeps working.

Anything else is **refused**, with an error on the host console.

**Why it changed, and why this is good news.** Registering under an invented prefix
used to appear to succeed: the route was accepted and a navigation entry was built
for it. But no route in the host could serve that URL, so the entry pointed at
nothing. If your app did this, it has been broken all along and merely failed to
say so. The new error is the old bug surfacing.

## 1.3 `/marketplace` is reserved

It is a real, routable section, but it belongs to Horizon's built-in marketplace
app. A registration from any other app is refused. **There is no opt-in.**

The check is against the app id the host derives server-side and re-stamps on every
registration, not anything your bundle sends — so it is not something a
registration can talk its way past.

## 1.4 A malformed `requiredScopes` refuses the registration

Only reachable if you adopt the new field, but worth knowing before you do. See
[5.6](#56-a-malformed-declaration-refuses-the-registration).

---

# Part 2 — The bundle-verification contract (0.2.0)

A bundle produced by an 0.1.x-era **build config** does not satisfy this, and you
cannot publish again without the three build changes in
[2.2](#22-the-build-changes).

> **What is actually enforced is the BUILD OUTPUT, not your SDK version.** The
> verifier inspects the bytes: chunk integrity, source maps, whether the SDK was
> federated as `shared`. It has no view of your `package.json`, so a bundle still
> depending on `@netsapiens/horizon-sdk` 0.1.x can and does pass every check once
> the build config is fixed.
>
> That is deliberate, not an oversight — but it means upgrading the dependency is
> separable work you can schedule independently of getting verified again. Do
> upgrade it (0.2.x is where `requiredScopes`, `declareCapabilityScopes` and
> `useRemoteAuth` live), just not because verification demands it.

## 2.1 Bump the version every time the bytes change

⚠️ **Read this before the build changes.** It is the one rule whose breach produces
a failure that nothing in the portal explains.

Your remote entry URL is **stable** — it does not carry the version — and the
platform pins a hash of the bytes at that URL. So:

- **New bytes with a version bump.** You update the version field, verification
  re-runs, a new hash is pinned. Everything works.
- **New bytes without one.** Nothing re-verifies. The platform goes on enforcing
  the hash of the _previous_ bytes against the _new_ ones at the same URL. Every
  host fails its integrity check on the next page load and your extension **simply
  does not appear** — no verdict, no finding, nothing in Registered Apps to explain
  it, and a healthy-looking verification chip the whole time.

The invisibility is not an oversight; it falls out of
[how the browser reports SRI failures](#the-publish--load-lifecycle). The host
cannot distinguish it from a network error at the point of failure.

**It is not invisible everywhere, though.** After a pinned load fails, the host
re-fetches the URL purely to diagnose it, hashes the served bytes, and reports to
Sentry with an `sdk.integrity_mismatch` tag plus both the expected and served
hashes. That is diagnostic only — it can never re-permit the load — but it is the
thing to ask your operator for when your extension vanishes after a deploy. It
separates "deployed without submitting" from "the CDN was down" definitively.

Since you cannot rely on noticing, guard it in CI:

```yaml
- uses: actions/checkout@v4
  with:
    fetch-depth: 2 # the guard diffs against the previous commit

# ... build ...

- name: Refuse to ship changed bytes under an unchanged version
  run: |
    PREV=$(git show HEAD~1:package.json 2>/dev/null | node -p "try{JSON.parse(require('fs').readFileSync(0,'utf8')).version}catch(e){''}" || echo "")
    THIS=$(node -p "require('./package.json').version")
    [ -z "$PREV" ] && exit 0
    [ "$PREV" != "$THIS" ] && exit 0
    git diff --quiet HEAD~1 HEAD -- src webpack.config.js package.json package-lock.json && exit 0
    echo "::error::Bundle inputs changed but the version is still $THIS. Bump it."
    exit 1
```

A push that touches only documentation passes untouched.

### What counts as "the bytes changing"

Narrower than you might think, and wider than you might hope. The test is always
"did `dist/` change" — the platform pins a hash of output, not a version string.

- **A genuinely types-only edit is byte-neutral.** Deleting a local `.d.ts` that
  augmented an SDK type, or tightening an annotation, emits identical output.
  Measured: same `remoteEntry.js` SHA-384 before and after. Nothing to republish.
- **Upgrading the SDK package is _not_ byte-neutral**, even when you only wanted
  the types. The SDK is bundled into your app rather than provided by the host, so
  its runtime code is part of your output. Measured on this repo with byte-identical
  application source, only the SDK version differing:

  ```
  SDK 0.2.1 → remoteEntry.js  e5be3de2a90810c700c63658ee88b3ba…
  SDK 0.2.4 → remoteEntry.js  730f1ff11d81ae8348835154793bbb7b…
  ```

  **Bump and resubmit after any SDK upgrade.**

When in doubt, hash `dist/remoteEntry.js` before and after and compare.

## 2.2 The build changes

Four, plus the dependency bump. Everything else about how you build stays as it is.

### 1. Chunk integrity

```bash
npm i -D webpack-subresource-integrity@^5.1.0
```

```js
output: {
  crossOriginLoading: 'anonymous',   // REQUIRED
},
plugins: [
  new SubresourceIntegrityPlugin({ hashFuncNames: ['sha384'] }),
],
```

**Why:** the platform pins your _entry_. Everything the entry pulls in afterwards is
uncovered unless the entry carries integrity values for its chunks.

Both halves are required. Without `crossOriginLoading: 'anonymous'` the browser
cannot verify the values webpack emitted, because SRI cannot check an opaque
cross-origin response — leaving a security control silently absent while everything
appears to work. Apply the plugin in production builds only; it warns under
`mode: development` and gives you nothing useful there.

### 2. Source maps

```js
devtool: 'source-map',
```

Do **not** set `noSources`, and do not strip `.map` files from what you publish.
The maps must carry `sourcesContent`.

**Why:** the analyser attributes what it finds to specific source files, which it
cannot do without the sources. So this is the requirement most likely to catch you
out: **missing source maps are a rejection, not a warning**, and no operator can
relax it. No maps, no verdict, no load.

### 3. Take the SDK out of `shared`

> **The error you will actually see**, which names neither the SDK nor `shared`:
>
> ```
> ERROR in webpack-subresource-integrity: Asset remoteEntry.js
>        contains unresolved integrity placeholders
> ```
>
> Quoted here because it is what you will paste into a search box — and because the
> message names neither its cause nor the offending chunk.
>
> **Removing the SDK from `shared` fixes _this_ cause. It is not the only one**, so if
> you have already done that and still see this error, you are looking at a different
> problem with the same message. The two others we have reproduced:
>
> 1. **A shared module that keeps its local fallback.** The fallback copy webpack emits
>    can be the chunk that cannot be resolved — this is why `react-dom/client` must be
>    declared with `import: false` (step 4 below).
> 2. **An empty split chunk.** Importing `react-dom` at all is enough: webpack's default
>    cache group can emit a chunk that is present in the manifest with **no file**, and
>    the integrity plugin writes a placeholder for every manifest entry, so one with no
>    bytes can never resolve. Fix with:
>
>    ```js
>    optimization: { splitChunks: { cacheGroups: { default: false } } },
>    ```
>
>    Vendor splitting is unaffected. `chunks: 'async'` and `minSize: 0` do **not** fix it,
>    and neither does upgrading the plugin — measured on 5.1.0 and 5.2.0-rc.1.
>
> `webpack --json` is what tells the three apart: look for a chunk whose `files` array is
> empty.

```js
shared: {
  react:       { singleton: true, requiredVersion: '^19.0.0' },
  'react-dom': { singleton: true, requiredVersion: '^19.0.0' },
  loglevel:    { singleton: true, requiredVersion: '^1.9.2' },
  // '@netsapiens/horizon-sdk' must NOT appear here — bundle it normally.
},
```

The host registers exactly six modules in its share scope:

```
react   react-dom   react-dom/client   loglevel   i18next   react-i18next
```

`react-dom/client` is there because sharing `react-dom` does **not** cover it —
see [step 4](#4-declare-react-domclient-if-anything-in-your-graph-calls-createroot) below.

**Why:** the SDK is not among them, so a shared declaration never resolved to a host
copy — it always fell back to your own bundled copy anyway, while emitting exactly
the chunk that makes the integrity build fail. Removing it changes nothing at
runtime. Remove it entirely; do **not** try to neutralise it with `import: false`.

`import: false` deserves its own warning here, because it looks like a tidier fix for
_this_ problem and is a worse one. It removes your local fallback copy, which changes
the failure mode for every module you declare shared: a module the host does not
provide degrades to your own bundled copy, but without a fallback it **throws at load**
(`Shared module X doesn't exist in shared scope default`). For a module the host does
not register — the SDK, MUI, emotion — that is strictly worse. Keep your fallbacks.

> **One exception, and it is the reverse rule: `react-dom/client`.** For a key the host
> _does_ register, `import: false` is correct and required — see
> [step 4](#4-declare-react-domclient-if-anything-in-your-graph-calls-createroot).
>
> ⚠️ An earlier revision of this guide said `import: false` "buys nothing for integrity —
> fallback chunks get integrity values like any other chunk, and in fact yield better
> coverage, not worse." **That is wrong, and measurably so.** For a shared module whose
> fallback webpack emits as its own chunk, the fallback is precisely what leaves an
> unresolvable integrity placeholder and fails the build. Disregard that sentence.

That distinction is worth internalising generally, because the two failure modes are
easy to confuse:

| Situation                                        | What webpack does                         | Severity                     |
| ------------------------------------------------ | ----------------------------------------- | ---------------------------- |
| Module **absent** from the host's share scope    | throws                                    | **Fatal at load**            |
| Module present but **version range unsatisfied** | warns, then proceeds with the host's copy | Degrades loudly, still loads |

Only the first is fatal. It is also why declaring MUI shared has always crashed —
the host never registers it, so it is the _absent_ case, not a version problem.

Two related rules while you are in this block:

- **Never declare MUI as shared** — `@mui/material`, `@emotion/react`,
  `@emotion/styled`, `@mui/x-data-grid-pro`. The host does not register them, so
  `singleton: true` with a `requiredVersion` resolves against nothing and fails at
  load with a cryptic minified error. Consume MUI exclusively through
  `horizonContext.ui.*` and `horizonContext.ui.templates.*`, which also carry the
  host theme and dark mode for free.
- **Keep `react` and `react-dom` as singletons.** Your component renders inside the
  host's React tree; a second copy fails as an invalid-hook-call naming nothing
  useful.

> **Correction to earlier guidance.** Earlier revisions grouped `i18next` with MUI
> as "not registered by the host". That was wrong — `i18next` and `react-i18next` > _are_ host-provided singletons, which is how `useLocale()` reaches the host's
> already-initialised instance with every translation loaded. Declaring them shared
> is legitimate; you just do not need to, because `useLocale()` is the supported
> path.

### 4. Declare `react-dom/client` if anything in your graph calls `createRoot`

**Most apps do not need this, and should check before acting on it.** A Horizon remote
does not mount itself — the host renders your component inside its own React tree — so a
normal extension never calls `createRoot`. This demo does not, and does not declare the
key.

You need it when something in your dependency graph reaches it on your behalf. The
common case is **`@ant-design/v5-patch-for-react-19`**, which imports `react-dom/client`
to reimplement the React 18 APIs antd v5 was written against. If you can drop that shim,
that is the cleaner fix.

**Sharing `react-dom` does not cover it.** They are different builds:

| Specifier          | Resolves to                          | Contains                                                                |
| ------------------ | ------------------------------------ | ----------------------------------------------------------------------- |
| `react-dom`        | `cjs/react-dom.production.js`        | `createPortal`, `flushSync`, `preload`, `version`                       |
| `react-dom/client` | `cjs/react-dom-client.production.js` | **the entire reconciler**, plus the React version as a baked-in literal |

Webpack matches share keys literally. Undeclared, your bundle keeps its own reconciler
while `react` resolves to the host's, and the literal is compared at module evaluation:

```js
if ('19.2.8' !== React.version) throw Error('Incompatible React versions: ...');
```

The result is **React error #527**, reporting a `react-dom` version that exists nowhere
in the host, and presenting as _"Failed to load &lt;your-app&gt;"_ rather than a render
error.

```js
shared: {
  react:       { singleton: true, requiredVersion: '^19.0.0' },
  'react-dom':  { singleton: true, requiredVersion: '^19.0.0' },
  'react-dom/client': { singleton: true, requiredVersion: '^19.0.0', import: false },
},
```

**`import: false` here, and only here.** It contradicts the rule two sections up, so it
is worth knowing why both are right:

- Keeping the fallback **breaks the build**. The fallback copy emits a chunk that leaves
  `webpack-subresource-integrity` with a placeholder it cannot resolve. Measured on
  plugin 5.1.0 and 5.2.0-rc.1 — upgrading does not help.
- Dropping it **completes the fix**: no local copy means no second reconciler, and code
  splitting stays on.

**Use the exact key, not `react-dom/`.** The prefix form behaves identically in webpack,
but with `import: false` it would require the host to provide every `react-dom/*`
subpath your graph touches. Only `react-dom/client` is shared.

**The trade, stated plainly.** `import: false` makes the host a hard dependency for this
key: against a host too old to register it, your app throws at load instead of falling
back. Confirm what a platform shares with `window.__horizonSDKDebug__` before shipping.

What it does **not** cost you is host React upgrades. Once both halves come from the
host they are installed together and cannot disagree, so host patch and minor bumps stop
being able to produce #527 here. Leaving the key undeclared is what makes host upgrades
risky, because your baked-in literal is frozen at your build time while the host's moves
on.

### 5. Guard the version field in CI

See [2.1](#21-bump-the-version-every-time-the-bytes-change).

## 2.3 `exposes` must be exactly `./App`

```js
exposes: { './App': './src/App' },
```

**This is not hypothetical.** An earlier version of our reference test app exposed
`'./mod'`, passed every verification check cleanly, was promoted, and could never
render — the host asks the container for `'./App'` and nothing else. A bundle can be
perfectly verified and still be unloadable. Exposing _additional_ modules alongside
`./App` is fine; omitting or renaming it is not.

## 2.4 Check your work before publishing

```bash
npm run build
npx horizon-verify-bundle ./dist
```

Seven checks run locally:

```
chunk-integrity        cross-origin-loading   source-maps        sources-content
content-rules          sdk-not-shared         shared-host-provided
```

Three further items are reported as **notes**, because they cannot be determined
from a local build: the version bump, CDN CORS, and submitting through the API.

Worth adding as a script:

```json
"verify": "horizon-verify-bundle ./dist"
```

A pass is not a guarantee of acceptance. CORS is probed at submission time, and an
operator may run stricter analysis rules than the shipped defaults.

## 2.5 Publishing and submitting

1. Bump the version in `package.json` and publish your bundle as you normally do.
2. Confirm the URL serves `HTTP 200`, `content-type: application/javascript`, and an
   `Access-Control-Allow-Origin` header covering the portal origin.
3. In Horizon → Registered Apps, update the app's **version** field and save.
   Submission happens automatically — there is no button, and the remote entry URL
   does not change.
4. The verification chip shows a verdict within seconds. **Expand the row** to read
   the findings.

Your CDN origin must be on the platform's approved-origins list — an operator
setting, not something you control. If submission fails at the fetch stage, ask
your operator to confirm your origin is allowed. Note that `*.github.io` is **not**
seeded by default and has to be added deliberately.

⚠️ **Between steps 1 and 3 the CDN serves new bytes while the platform still pins
the old hash.** Anyone starting a fresh session in that window will not see your
extension; a reload after step 3 fixes it. Sessions already running are unaffected,
because a loaded bundle is never re-fetched. **Release in a maintenance window.**

The window is bounded by how long verification takes, and verification fetches the
remote entry, every chunk and every source map. The per-fetch timeout (60s by
default) applies **per fetch, not in total**, so a slow CDN stretches it.

**Rolling back** means re-publishing the previous bytes and submitting under a _new_
version. The platform refuses to re-verify an `(extension, version)` pair it has
already judged, so you cannot roll back by re-submitting the old number.

### Where the button is

In **Platform → UI SDK Management → Registered Apps**, each row has a **Deploy**
action. That is the submission: it fetches your bundle, verifies it, and promotes
it on `approved` or `flagged`. There is no separate promote step, and you do not
have to touch the version — Deploy assigns the next free one.

Saving the app form **also** deploys. Use that when you have edited the Remote
Entry URL or the Version by hand, so the edit and its submission go together.
Use Deploy when only the bytes moved, which is the usual case.

## 2.6 Reading a verdict

Three outcomes, and the middle one is not a failure:

| Verdict    | Loads?  | Meaning                                                                            |
| ---------- | ------- | ---------------------------------------------------------------------------------- |
| `approved` | yes     | No findings, or only informational ones                                            |
| `flagged`  | **yes** | Findings were recorded. It loads normally                                          |
| `rejected` | no      | Something disqualifying — a failed fetch, absent source maps, a disqualifying rule |

Read the **severity** of each finding, not merely its presence. A finding at `info`
contributes nothing to the verdict.

Expect a `size-delta` flag on your first 0.2.x submission. Taking the SDK out of
`shared` moves it into your bundle, and the analyser notes sharp size changes
against your last approved version. That is correct behaviour and needs no action.

---

# Part 3 — Corrections in 0.2.1 and 0.2.2

## 3.1 `verify-bundle` never ran under its own name (0.2.1)

In 0.2.0 the packaged CLI silently no-opped: its main-module guard compared the
basename of `argv[1]` against `verify-bundle`, which is false when npm links the
binary as `horizon-verify-bundle`. It exited 0 without running a single check.

**If you wired `npx horizon-verify-bundle` into CI against 0.2.0, it has been
passing without checking anything.** Upgrade and re-run it against your current
`dist` before assuming you are compliant.

0.2.1 also reconciled the checker with the platform's own checks, where the two had
diverged. If you worked around the bin bug by invoking the script directly, that
still works and can now become the plain `npx horizon-verify-bundle ./dist`.

## 3.2 The remote-entry URL policy was reversed (0.2.2)

**If you followed the 0.2.0/0.2.1 docs, you did work you did not need to do.** Those
revisions said to publish every release to its own immutable
`/v1.2.0/remoteEntry.js` path and never overwrite a submitted path.

That is not the supported pattern. **A stable remote entry URL that each release
republishes over is what the platform expects**, and the version field is what
drives re-verification.

**Why it was reversed.** Immutable paths meant an administrator hand-editing the
remote entry URL in the portal on every single release — a manual step on a
security-relevant field, one typo away from an outage. That was not hypothetical: a
stray character survived a copy-paste and the bundle came back `rejected` with
`fetch-failed`. The scheme also buried the requirement that actually bites
([2.1](#21-bump-the-version-every-time-the-bytes-change)).

Nothing you already built needs undoing — versioned paths still work, because the
platform pins whatever URL you submit. You then own the URL update on each release.

> If your installed SDK is older than 0.2.2, `horizon-verify-bundle` prints an
> `immutable-url` note describing the _superseded_ policy. On 0.2.2+ that note is
> replaced by `version-bump` and says the opposite. Check which you are seeing.

---

# Part 4 — New UI surfaces (0.2.3)

Additive; your app keeps working unchanged. `horizonContext.ui` gained typed
surfaces the host already provided but the SDK could not describe:

`SearchField` · `Autocomplete` · `CarouselTemplate` · `Tabs` · `Card` — plus the
shared `KitOption` option shape and `HostDataset`, which lets `Autocomplete` search
host-side datasets without your app knowing the endpoint:

```tsx
<ui.Autocomplete source={{ host: 'user', api, domain: user.domain }} … />
<ui.Autocomplete source={{ options: myRows }} value={v} onChange={setV} />
```

**Every member of `horizonContext.ui` is optional in the type.** That is the
compatibility hedge — an older host will not have the newer components, and the
optional marker forces you to notice. Guard rather than assert:

```tsx
const { SearchField } = horizonContext.ui;
if (!SearchField) return <FallbackInput … />;
```

Taking 0.2.3 "just for the types" still moves your SDK dependency, and the SDK is
bundled into your output — so your bytes change and you owe a version bump and a
resubmit. See [What counts as "the bytes changing"](#what-counts-as-the-bytes-changing).

---

# Part 5 — Scope declarations (0.2.4)

Additive, and the supported replacement for the implicit gating
[Part 1](#part-1--already-affecting-your-deployed-app) removed.

`requiredScopes` is available on `registerRoute`, `registerDynamicExtension` and
`registerDynamicColumn`; `declareCapabilityScopes` is a new SDK method.

```ts
sdk.registerRoute({
  id: 'my-app.approvals',
  parentPath: '/apps',
  path: 'approvals',
  label: 'Approvals',
  requiredScopes: 'ADMINS', // ← a tier name, resolved by the host
  component: Approvals,
});
```

It governs the navigation entry and the URL together, so a page a user may not open
is never advertised to them.

## 5.1 The vocabulary

| Tier              | Members                                                   |
| ----------------- | --------------------------------------------------------- |
| `PLATFORM`        | Admin, Super User                                         |
| `ADMINS`          | Admin, Super User, Reseller                               |
| `DOMAIN_MANAGERS` | Admin, Super User, Reseller, Office Manager, Site Manager |
| `DOMAIN_ONLY`     | Office Manager, Site Manager                              |
| `CALL_CENTER`     | Call Center Supervisor, Call Center Agent                 |
| `END_USERS`       | Basic User, Advanced User, Simple User                    |

Exported for type-checking: `UserScope`, `ScopeGroupName`, `ScopeRequirement`,
`HorizonScopeVocabulary`, plus `SCOPE_GROUPS` and `ALL_USER_SCOPES`, and the
validators `isUserScope`, `isScopeGroupName` and
`describeScopeRequirementProblem`.

A typo'd scope is a compile error, which matters more here than usual: a scope
matching nothing reads as "restricted" and behaves as "nobody". **This only helps if
you actually run `tsc`** — Babel and most bundler pipelines strip types without
checking them. Add a `typecheck` script and run it in CI, or the safety is
theoretical.

## 5.2 It narrows. It never widens.

The host intersects your declaration with the **floor** it enforces for the section
your surface attaches to:

| Section        | Floor                                          |
| -------------- | ---------------------------------------------- |
| `/manage`      | ADMINS                                         |
| `/platform`    | ADMINS                                         |
| `/marketplace` | DOMAIN_MANAGERS (reserved to the built-in app) |
| `/apps`        | none                                           |
| `/home`        | none                                           |

So:

- Declaring a **narrower** audience than the floor restricts your surface further.
  This works.
- Declaring a **broader** audience grants nothing. `END_USERS` on a `/manage` page
  intersects to the empty set — reachable by _nobody_, not by everybody.
- Under **`/apps` and `/home` there is no floor**, so your declaration is the only
  gate. That is where it does the most work.

**Why the intersection runs in that order:** a remote bundle is partner code. If a
declaration could add scopes back, `requiredScopes` would be a way in rather than a
way to restrict yourself. Treat it as "narrow this for me", never "let me in".

## 5.3 Prefer a tier name to a scope list

`'ADMINS'` is resolved by the host, at the moment access is checked, against the
host's current membership for that tier.

`['Admin', 'Super User', 'Reseller']` is a **snapshot**: correct the day you wrote
it, silently wrong the day the platform widens or narrows the tier. And because the
host intersects, a stale list quietly _loses_ access rather than failing loudly.

Name the tier and your app follows platform changes with no rebuild. Use a literal
list only when you genuinely mean those exact scopes regardless of how tiers evolve.

## 5.4 Write the value as an inline literal

The platform analyser extracts your app's declared surface — routes, nav,
capabilities — by reading **string literals out of your submitted source**. It is a
static read; it cannot follow a constant or a loop.

Registrations built from a `PARENT_PATH` constant, or emitted in a loop over a
config array, extract as **nothing**: the Registered Apps page shows empty Routes
and Capabilities columns, so an administrator reviewing your app cannot see what it
claims to contribute. That transparency is the point of those columns.

So write `parentPath`, `path` and `requiredScopes` inline at each call site, even
when it duplicates a value you hold elsewhere. It looks like sloppiness; it is
deliberate, and Horizon's own marketplace app does exactly this for exactly this
reason.

## 5.5 Columns deserve this more than "a column is just data" suggests

A column's `renderCell` is where action buttons live. An approve or delete control
reaches a user through a column exactly as it would through a zone extension, so
gate it the same way.

The demo app in this repo shows both shapes:

- `/apps/component-showcase` declares `'DOMAIN_MANAGERS'` — no floor under `/apps`,
  so the declaration is the whole gate.
- the `call-priority` column on `/manage/call-logs` declares `'PLATFORM'` — the page
  admits ADMINS, so a Reseller opens Call Logs and sees every native column but not
  that one.

## 5.6 A malformed declaration refuses the registration

`registerRoute`, `registerDynamicExtension`, `registerDynamicColumn` and
`declareCapabilityScopes` all validate before emitting anything. A bad value logs
what is wrong and how to fix it, and **the surface is not registered at all.**

**Why refusing is safer than proceeding.** The host _drops_ a gate it cannot resolve
and falls back to the section's own floor. On an `/apps` page, where there is no
floor, that means a typo'd tier would render your restricted surface to everyone,
silently — the exact opposite of what declaring it asked for. Failing to register is
the louder failure, and the safer one.

## 5.7 `declareCapabilityScopes` is weaker, and you should know why

```ts
sdk.declareCapabilityScopes({
  'notifications:send': 'ADMINS',
  'call-events:listen': ['Call Center Supervisor'],
});
```

Several capabilities produce UI or act on the user's behalf — `notifications:send`
raises a notification, `side-panel:open` opens a panel. Without this, an app could
scope-gate its page and still fire a notification at a user who should never have
seen the feature.

**But it is not the same kind of thing as the other three.** Those are intersected
with a floor the host derives from its own sitemap, so they can only narrow. A
capability has no page to floor against — it may be exercised from a background
stream with no route in context — so there is nothing to intersect and **your
declaration stands alone.** It is a self-restriction an honest app opts into, not a
boundary against a hostile one: declaring nothing leaves the capability
unrestricted.

What it buys you is consistency, honest intent enforced once stated, and visibility
to an administrator reviewing what your app claims. The capability gate an app
cannot influence remains the platform-global toggle.

Call it once during setup, before the capability is first exercised. Later calls
merge, so a second call cannot silently drop an earlier restriction.

## 5.8 `horizonContext.scopes` — the live vocabulary

Every scope the host recognises, the current membership of each tier, and the host's
own `resolve()`.

Read this rather than the SDK's bundled `SCOPE_GROUPS` whenever your UI lists or
reasons about scopes. The bundled constants are a **build-time fallback** — a
snapshot from whenever your SDK version was published. `horizonContext.scopes` is
what the host enforces right now, so a host that adds a scope or re-members a tier
reaches your app without a republish.

---

# Part 6 — Remote authentication changed shape

Two breaking changes, and one is **server-side** — it affects your deployed
backend regardless of which SDK version you built against.

## 6.1 The webhook signature now covers the whole body (BREAKING, server-side)

`X-NS-Signature` used to be an HMAC over the string
`request_id + code + timestamp`. It is now an HMAC over:

```
"<X-NS-Timestamp>." + <the exact raw request body>
```

**A verifier written against the old scheme rejects every webhook.** There is no
dual-send period and no version negotiation — the header
`X-NS-Signature-Version: 2` tells you which scheme produced it.

Why it changed: the old signed string covered neither the PKCE verifier, nor the
user identity, nor the scopes. A backend that verified it had verified almost
nothing about the request it was about to act on.

Two things break this silently, so check both:

```js
// ✅ capture the RAW bytes — before parsing
app.use(
  express.json({
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    },
  }),
);

const expected = crypto
  .createHmac('sha256', SECRET)
  .update(`${req.get('X-NS-Timestamp')}.`)
  .update(req.rawBody) // ❌ NOT JSON.stringify(req.body)
  .digest('hex');
```

- **Hash the bytes as received.** `JSON.stringify(req.body)` re-serializes — key
  order, whitespace and unicode escaping can all differ — and will not match.
- **There is no `signature` field in the body any more.** A signature cannot cover
  a body that contains it, which is why it moved to a header.

Also reject a stale `X-NS-Timestamp` (a 5-minute window is reasonable). The
timestamp is inside the signed string, so it cannot be altered without breaking
the signature — checking it is what makes a captured webhook unusable later.

### Anything between us and your verifier must preserve the bytes

The rule above is about your own handler. It has a second half that is easy to miss
because the failure looks identical to a wrong secret.

**v2 signs the exact body as sent, so every hop has to leave it alone.** Under v0.1 this
could not bite you — only three scalar fields were signed, so a re-serialized body still
verified. Now, anything that parses and re-emits the JSON on the way to your verifier
invalidates the signature:

- an API gateway or service mesh that normalizes or re-encodes JSON;
- a backend that **relays** the webhook to another service for verification;
- logging or tracing middleware that parses the body and re-emits it;
- anything that pretty-prints, reorders keys, changes separators, or re-escapes unicode.

None of those change the _meaning_ of the payload, and all of them change its bytes.

**Two ways to be safe**, and the choice is architectural rather than a setting:

1. **Verify at the edge** — check the signature at the first hop that receives it, before
   anything can touch the body.
2. **Forward the original bytes** — if verification has to happen deeper in, pass the raw
   body through unmodified along with the original `X-NS-Signature` and `X-NS-Timestamp`
   headers. A relay that re-serializes has already destroyed the evidence.

> ⚠️ **The reason this is worth its own section: a 401 here is indistinguishable from a
> wrong secret.** There is no signal in the failure that says "your bytes changed in
> transit", so the natural response is to rotate the secret, which does nothing, twice.
> If verification fails and the secret is definitely right, hash the bytes at each hop and
> find the one where the digest changes.

A working implementation, with the raw-body capture wired up, is in
[`examples/vendor-backend`](examples/vendor-backend). `npm run sign` posts a
correctly-signed v2 webhook at it.

## 6.2 `callbackUrl` is no longer yours to choose (BREAKING, but silent)

`RemoteAuthRequest.callbackUrl` is ignored. Where the webhook is sent is
registration data — an administrator sets it in **Registered Apps**, and it may be
several endpoints, tried in order for redundancy.

Nothing errors if you keep passing it, which is the trap: your app looks fine and
the webhook goes somewhere you did not specify in the request. Set the real
destination in the app's registration, and drop the property.

It moved because that field decided where a redeemable authorization code — plus
its PKCE verifier — was POSTed. That made the destination of a credential a
browser-side choice.

**If you register several endpoints:** each attempt carries its own code, and a
failed attempt's code is revoked immediately, so no two of your servers receive
the same credential. Only "no answer" fails over — connection, TLS, timeout, or
`5xx`. **A `4xx` stops the attempt**, because it is read as your considered
rejection. Do not return `4xx` for a transient fault, or you will suppress your
own redundancy.

## 6.3 Two more headers, and one that can be absent

| Header                      | Answers                                                                                                                                  | Availability                                  |
| --------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------- |
| `X-NS-Platform-Assertion`   | Which cluster is calling. RS256, signed by the instance, verified against its published JWKS. `aud` is your vendor id, `sub` the app id. | Always, for a configured cluster              |
| `X-NS-Cluster-Verification` | Whether that cluster is entitled to this app. Issued by NetSapiens Insight.                                                              | Needs a live Insight call — **may be absent** |

Previously only the second existed, and because it can legitimately be missing, a
backend could neither require it nor safely ignore it. If you want a public-key
check that is always there, verify the platform assertion.

The same cluster identity (`client_id`, `client`, `cluster_id`, `cluster_name`,
`tenant`, `hostname`) is also in the signed body under `platform`, so an
HMAC-only backend receives it verifiably too.

⚠️ **Key your records on `(platform.cluster_id, user.uid)`, not `uid` alone.**
`uid` is unique only within one Horizon instance.

## 6.4 New: authenticate on load

`useRemoteAuth` runs the handshake as soon as your app mounts — no button:

```tsx
const { token, status, error, retry } = useRemoteAuth(
  horizonContext,
  'my-backend',
);
```

Once per mount, and skipped when a valid token is already stored. Both are
correctness rather than caching: each run mints an authorization code and posts it
to your backend. `auth.requestRemoteAuth()` remains for apps that broker several
vendors and need the user to pick one.

---

# Publishing through the API

Only relevant if you call `/ui-extensions` directly rather than using the admin UI.
Two response fields are easy to misread.

**`enabled` is derived per caller, not the stored column.** It is a three-state
overload: `yes` (master on, nothing denies you), `no` (**master kill** — the stored
column is `no`), `restricted` (master on, but a granular rule denies _this_ caller).
`restricted` is never stored, and the same row reads differently to two callers.
Non-admin tokens only receive rows whose effective value is `yes`, so a missing row
does not mean a missing registration.

**`promoted: true` means the write was accepted, not that it landed.** Replication
is asynchronous and the controller deliberately does not read back to confirm — an
earlier version did, and reported failure on every successful promotion because the
read preceded the write. Re-fetch if you need certainty, and expect a short stale
window.

**Promotion writes three fields** — the active version id, the integrity hash and
the verification status. It does **not** advance the display `version` column, and
it never enables or disables anything. So write the row first, then submit:

1. `PUT /ui-extensions/{id}` with the new `version` (and `enabled`, if changing).
2. `POST /ui-extensions/{id}/versions` to verify and promote.
3. Re-fetch if you need to confirm.

**Never send `integrity_hash`.** The platform computes it from the bytes it fetched;
a caller-supplied value is ignored, and accepting one would make the pin
self-attested.

---

# Troubleshooting

**Verified, but nothing appears.** Check the app is **Enabled** first. A disabled app
is filtered out before it is ever loaded, so it registers no routes and no zones
while still showing a healthy verification chip.

**It worked yesterday and vanished after a deploy.** You published new bytes without
bumping the version ([2.1](#21-bump-the-version-every-time-the-bytes-change)). Ask
your operator to check Sentry for an `sdk.integrity_mismatch` tag on your URL — that
confirms it rather than leaving you guessing.

**`rejected` with `fetch-failed`.** The platform could not read the URL. Three
causes, in the order worth checking:

1. **The URL.** Check the stored remote entry URL character by character — a stray
   character from a copy-paste produces a 404, and nothing readable means nothing
   pinnable.
2. **The origin.** Confirm it is on the approved-origins list.
3. **The resolved address.** The platform refuses a host that resolves to a
   private, reserved or link-local address. On a **single-box install this
   includes the portal's own FQDN**: `/etc/hosts` maps it to loopback, so the API
   resolves its own portal name to `127.0.1.1` even though public DNS answers with
   the WAN address. The finding carries `resolved_ip`, which tells you this
   immediately.

   Serving from the portal's own origin is supported — the guard exempts an exact
   scheme+host+port match on the portal origin. If you are serving from a
   _different_ private-resolving name, give it a name that resolves publicly.

**Submitting the same version again returns 409.** The platform refuses to
re-verify a version already on file for the extension: `This version has already
been submitted; publish a new version instead`.

Note this includes versions **burned by a rejection** — a version row is written
for every verdict. The auto-bump skips those, so deploying again after a rejection
picks the next free number rather than colliding with the rejected one. On an
older build it collided and 409'd, and the recovery was to type a version two
ahead of the one displayed.

**Nothing happened when I pressed Deploy, and no version appeared.** Look for
"already up to date". The deploy endpoint is idempotent at the byte level: a
published bundle that hashes to the pin already in force writes nothing and
promotes nothing, and reports that as a success. If you expected a new version,
your CDN is still serving the old bytes — check the deploy that publishes them
finished before you submitted.

**The app loads but renders nothing.** Check `exposes` includes `'./App'` exactly
([2.3](#23-exposes-must-be-exactly-app)).

**A route registration is refused on the console.** Check `parentPath` against the
allowlist ([1.2](#12-parentpath-is-an-allowlist)).

**A scope-gated surface never appears, even to an admin.** Either the declaration
failed validation and the surface was not registered at all — check the console for
the SDK's error — or you declared a tier disjoint from the section floor and it
intersected to the empty set ([5.2](#52-it-narrows-it-never-widens)).

**"Unsatisfied version" at load, or a cryptic minified error.** Something is declared
`shared` that the host does not provide. Only `react`, `react-dom`, `loglevel`,
`i18next` and `react-i18next` are.

**Works locally, fails when deployed.** `localhost` and `127.0.0.1` are a built-in
dev floor on the approved-origins check. Your real CDN origin is not implicit and
has to be added by an operator.

---

# Version summary

| Version | What landed                                                                                                                | Action needed                                                                                                       |
| ------- | -------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| 0.2.0   | Bundle-verification contract — SRI pinning, chunk integrity, source-map requirements, SDK must not be `shared`             | **Required.** [Part 2](#part-2--the-bundle-verification-contract-020)                                               |
| 0.2.1   | `verify-bundle` CLI fixes — it never ran under its own bin name, and disagreed with the platform                           | **Required if you used the 0.2.0 CLI.** [3.1](#31-verify-bundle-never-ran-under-its-own-name-021)                   |
| 0.2.2   | Remote-entry URL policy corrected — stable URL, not immutable paths (docs + one CLI note)                                  | Read it; may undo work. [3.2](#32-the-remote-entry-url-policy-was-reversed-022)                                     |
| 0.2.3   | New `horizonContext.ui` types — SearchField, Autocomplete, CarouselTemplate, HostDataset, Tabs, Card, KitOption            | Optional. [Part 4](#part-4--new-ui-surfaces-023)                                                                    |
| 0.2.4   | Scope-declaration contract — `requiredScopes`, `declareCapabilityScopes`, `horizonContext.scopes`, the exported vocabulary | Optional, but see [Part 1](#part-1--already-affecting-your-deployed-app). [Part 5](#part-5--scope-declarations-024) |
| —       | Remote auth: webhook signature v2, `callbackUrl` moved to registration, two new headers, `useRemoteAuth` (0.2.5)           | **Required if you use remote auth.** [Part 6](#part-6--remote-authentication-changed-shape)                         |

Host-side changes in [Part 1](#part-1--already-affecting-your-deployed-app) are not
tied to an SDK version — they apply to every app on the server regardless of what it
was built against.

---

# What this does not change

Nothing here requires changes to your app's features, its zone extensions, or its
event handling. Parts 1–3 are the build and publish contract plus host-side access
enforcement; Parts 4–5 are additive.

**Part 6 is the exception** — if your app uses remote authentication, your
_backend_ must change, and it is not tied to an SDK version: the signature change
is server-side and applies to your deployed app now.

If one of your app's behaviours appears to conflict with a requirement here, raise it
rather than removing the behaviour.
