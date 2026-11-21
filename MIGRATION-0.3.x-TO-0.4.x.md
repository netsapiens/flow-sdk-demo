# Flow SDK 0.3.x → 0.4.x

The guide for partners moving an app built on `@netsapiens/flow-sdk` 0.3.x to
**0.4.x**: what changed, what to do, in what order, and where this demo does
each step. The demo's code is written against `^0.4.0`; install 0.4.1, the
current release.

```bash
npm install @netsapiens/flow-sdk@^0.4.1
```

Most of the work is in your **build and publish setup**, not your app code.
Every step except the log-level option also works on SDK 0.3.8 and on older Flow
hosts, so you can do the work first and move the dependency last. The earlier
upgrade is in [MIGRATION-0.2.x-TO-0.3.x.md](./MIGRATION-0.2.x-TO-0.3.x.md), and
what it says still holds.

Every step below was run on a real 0.3.8 app (this demo, as it was before the
move) and checked with the 0.4.0 bundle verifier. The output quoted here is
what that run printed. Use the 0.4.1 verifier: it also reads typed calls such as
`api.get<User[]>(…)` and warns about an API client with another name, so on
those two points its output differs from the 0.4.0 output quoted here (Part 3).

---

## In one minute

1. **Stamp your build.** The platform reads the app's name, version and author
   from the first line of `remoteEntry.js`. Nobody types them into Flow any more.
2. **Build an ES-module entry.** Three webpack lines, and your container is
   the module's own exports instead of a `window` global that every other app
   on the page can reach. Optional, and the step that gives your app a
   container of its own.
3. **Write API paths so the platform can read them.** It records which API
   resources your app uses from the paths in your `api.get/post/put/delete`
   calls, and will enforce that list. A path in a variable or a client not
   named `api` hides the call.
4. **Keep the previous releases' chunks on your CDN**, or sessions open during
   a release break.
5. **Move your data to `context.storage`.** `localStorage`, `sessionStorage`
   and IndexedDB are shared with every other app on the page.
6. **Set the SDK log level in code.** The SDK no longer reads it from storage,
   and production now defaults to `WARN`.
7. **Expect copies, not shared objects.** Event payloads are frozen, each stream
   subscriber gets its own copy of each frame, and query strings in API paths
   are refused.

---

## Do I have to move now?

**Not by a date, unlike 0.3.** An app on 0.3.6–0.3.8 keeps loading. What you
get from moving now:

- The two new verifier warnings (`app-manifest`, `api-path-not-literal`) go
  away before they become enforcement.
- Sessions survive your releases.
- Your data stops sitting where every other app can read it.
- Your container stops being a `window` global that another app can define
  first or read later (Part 2).

An app on an SDK **older than 0.3.6** loads but registers nothing (since
2026-11-01). Move it now.

---

## What your Flow server needs

If you test on your own sandbox, it needs these versions or later. Older
servers still load a 0.4.x app, but without what is listed here.

| Component                   | Minimum              | What it adds                                                                                                                                                                                                        |
| --------------------------- | -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| NS API v2                   | `46.0.0-alpha.902`   | Records the entry format of a deployed version, so a module entry (Part 2) loads. Bundle analyser 11: typed calls (`api.get<User[]>(…)`) are read and declared, and a client with another name is flagged (Part 3). |
| Flow (`netsapiens-horizon`) | `46.0.0-staging.697` | Loads an ES-module entry (Part 2). `params` values are sent as checked text; an older host sends a key whose value is `undefined` as the text `undefined`.                                                          |

On an older API, the platform still doesn't see a typed call even though the
0.4.1 verifier on your machine does. Until your server is upgraded, type the
result instead (Part 3, step 3).

---

## Part 0 — See your work list before you change anything

The 0.4.1 verifier runs against a build made with 0.3.x. Build as you do today,
then run the new verifier **without changing your dependency**:

```bash
npm run build
npx -p @netsapiens/flow-sdk@0.4.1 flow-verify-bundle ./dist
```

On this demo, still on 0.3.8, the 0.4.0 verifier printed:

```
[ warn ] app-manifest       the entry carries no `/*! flow-app {…} */` build stamp
[ warn ] undeclared-files   1 .js file(s) in dist that remoteEntry.js does not load … main.6141ef1232f0bf87e35d.js
[ note ] raw-web-storage    … in a bundled dependency
                            node_modules/loglevel/lib/loglevel.js, node_modules/@netsapiens/flow-sdk/dist/index.js
[ note ] api-resources      declared API resources: none (this bundle calls context.api nowhere)
PASS — required checks satisfied (2 warnings).
```

How to read it:

- **`app-manifest`** is Part 1.
- **`api-resources: none`** on an app that does call the API means the
  analyser can't see your calls. That's Part 3, and it's the one most worth
  fixing early. Here, all of the demo's calls were typed (`api.get<T>(…)`) or
  made on a client not named `api`. 0.4.0 saw neither and printed no warning.
  0.4.1 reads the typed calls and prints `api-path-not-literal` for the others.
- **`raw-web-storage` in `@netsapiens/flow-sdk`** is 0.3.x reading its old
  log-level key. It goes away when you upgrade (Part 6). If it names **your**
  files, that's Part 5.
- **`undeclared-files`** for an extra entry chunk such as `main.*.js` is
  harmless: the platform never fetches it.

---

## Part 1 — The build stamp

The platform reads `/*! flow-app {"name":…,"version":…,"author":…} */` from
line one of `remoteEntry.js`. Generate it from `package.json` so it can't
drift:

```js
// webpack.config.js
const webpack = require('webpack');
const pkg = require('./package.json');

const stamp = { name: pkg.name, version: pkg.version, author: pkg.author };
// JSON.stringify silently drops an undefined field, so fail the build instead.
for (const [field, value] of Object.entries(stamp)) {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`package.json "${field}" is required for the build stamp`);
  }
}

// in plugins, beside the subresource-integrity plugin:
new webpack.BannerPlugin({
  banner: `/*! flow-app ${JSON.stringify(stamp)} */`,
  raw: true,
  test: /remoteEntry\.js$/,
  stage: webpack.Compilation.PROCESS_ASSETS_STAGE_OPTIMIZE_SIZE + 1,
}),
```

**The `stage` line is not optional.**

| `stage`                                  | Result                                                                                         |
| ---------------------------------------- | ---------------------------------------------------------------------------------------------- |
| default                                  | The minifier moves the `/*!` comment into `remoteEntry.js.LICENSE.txt`; the stamp never ships. |
| `PROCESS_ASSETS_STAGE_SUMMARIZE`         | The banner is added after the source map is written, so every mapping is one line off.         |
| `PROCESS_ASSETS_STAGE_OPTIMIZE_SIZE + 1` | After minification, before the source map. Both come out right.                                |

This demo shipped with `SUMMARIZE` for a while. The verifier passes it, so
check the map yourself (below).

**Rules**

- `version` is plain `x.y.z`, at most 50 characters. Bump it whenever the
  bytes change. If you forget, the platform moves the patch number on by itself:
  the app keeps working, but under a number you didn't choose.
- `author` is at most 255 characters. Add `"author"` to `package.json` if it's
  missing. This demo's was, and the guard above stopped the build with
  `package.json "author" is required for the build stamp`.
- You no longer type a version or author into Registered Apps, and a deploy
  request no longer needs a `version`.

**Check it**

```bash
head -c 120 dist/remoteEntry.js   # /*! flow-app {"name":"…","version":"…","author":"…"} */
node -p "JSON.parse(require('fs').readFileSync('dist/remoteEntry.js.map', 'utf8')).mappings.slice(0, 3)"   # starts with ;
```

The map's `mappings` string must start with `;`, which means the banner line
maps to nothing. If it starts with a letter, your `stage` is wrong.

---

## Part 2 — The ES-module entry

A classic remote entry hands its container to the host through a `window`
global named after your `webpack_module`. Anything else on the page can define
that name before your code runs, or read your container after it, and the host
has to take the container off the window and clear the name behind it. In 0.4
the entry can be an ES module instead: the container is the module's own `get`
and `init` exports, nothing is written to `window`, and the host pins the entry
through an import-map integrity entry rather than a script tag. Classic script
entries keep working, so this step is optional; it is the one that gives your
app a container of its own.

Three config lines, no source change:

```js
// webpack.config.js
module.exports = {
  experiments: { outputModule: true },
  output: {
    // Keep script-tag chunk loading. Webpack's default for module output loads
    // chunks with import(), which cannot carry an integrity value, and the
    // verifier rejects that build (module-chunk-loading, below).
    chunkFormat: 'array-push',
    chunkLoading: 'jsonp',
    // publicPath, filenames, crossOriginLoading: unchanged
  },
  plugins: [
    new ModuleFederationPlugin({
      name: MODULE_FEDERATION_NAME,
      filename: 'remoteEntry.js',
      library: { type: 'module' },
      // exposes, shared: unchanged
    }),
  ],
};
```

`remoteEntry.js` still starts with the build stamp (Part 1) and now ends with
`export{H as get,O as init}`. The chunks are the same script-tag chunks with
the same integrity values, so Part 4 applies unchanged.

**Check it**

```bash
npm run build
npx flow-verify-bundle ./dist
```

This demo, after the three lines:

```
[  ok  ] sri-applied        chunk loader assigns script.integrity from sriHashes
[ note ] entry-format       ES-module entry (library.type module): the host pins it through an import map and reads no window global
PASS — required checks satisfied (1 warning).
```

Without the two `output` lines, the same build fails three required checks,
because webpack switched the chunks to `import()`:

```
[ FAIL ] cross-origin-loading  chunk loader never sets `crossOrigin` — cross-origin chunk responses will be opaque and unverifiable …
[ FAIL ] sri-applied           sriHashes is present but the chunk loader never assigns script.integrity from it
[ FAIL ] module-chunk-loading  remoteEntry.js is an ES-module entry whose chunks load with import(), which carries no integrity
                               | Keep script-tag chunk loading: set output.chunkFormat: 'array-push' and output.chunkLoading: 'jsonp' beside experiments.outputModule, and rebuild.
FAIL — 3 required checks did not pass. Submitting now would be rejected.
```

**Rules**

- Deploy as before (Part 10). There is no field to set: the platform reads the
  entry format from the bytes it verified and records it with the pin, and the
  host loads a module entry only under that pin.
- `localhost` is the one exception: a Flow server with dev remotes on tries an
  unpinned localhost entry as a script first and, finding no container,
  imports it. The first attempt leaves one line in the host console,
  `SyntaxError: Unexpected token 'export'`, and nothing else. `npm run dev`
  needs no change; the CORS and private-network headers the dev server already
  sends cover the import.
- A browser keeps the module it imported until the page reloads. A new pin
  for the same entry URL is refused on an open session (the host console says
  `already pinned on this page under a different integrity`) and takes effect
  on the next load, so bump the version and keep the previous release's
  chunks (Part 4), as you would anyway.
- It needs the server versions under
  [What your Flow server needs](#what-your-flow-server-needs). An older host
  finds no container and loads nothing; an older API does not record the entry
  format, so the host would not try. Update your sandbox first, then ship the
  module entry.

---

## Part 3 — API paths the platform can read

When you submit a version, the platform reads the paths your code passes to the
API client and records which resources (`users`, `devices`, `callqueues`…) your
app reads and writes. Administrators see that list, and the platform will
enforce it: a call outside the list will be refused.

It finds a call by a **plain pattern in your source**: the name `api`, a dot,
the method, an optional type argument, an opening parenthesis, then a string or
template literal. The table shows the 0.4.1 verifier and a platform on NS API v2
`46.0.0-alpha.902` or later:

| You wrote                                                     | What the platform sees                                |
| ------------------------------------------------------------- | ----------------------------------------------------- |
| `api.get(path)`                                               | Warning `api-path-not-literal`: a call it can't scope |
| ``api.get<User[]>(`/domains/${d}/users`)``                    | `domains (read), users (read)`                        |
| ``apiClient.get(`/domains/${d}/users`)``                      | Warning `api-path-not-literal`. Declares nothing.     |
| ``api.get(`/domains/${d}/users`)``                            | `domains (read), users (read)`                        |
| ``flowContext.api.post(`/domains/~/users/~/contacts`, body)`` | `contacts (write), domains (write), users (write)`    |

So, for every call:

1. **Write the path inline**, as a string or template literal, with `${…}`
   only where an id goes. Repeating the path at each call is correct; moving it
   into a helper function undoes the declaration.
2. **Call it on something named `api`**: `api.get(…)`, `context.api.get(…)`,
   `flowContext.api.get(…)`. Rename a parameter such as `apiClient` to `api`.
3. **A type argument on the call is fine** with the 0.4.1 verifier and a
   platform on NS API v2 `46.0.0-alpha.902` or later. On an older platform the
   type argument hides the call, so type the result instead. These forms are
   read by every version:

   ```ts
   const users: User[] = await api.get(`/domains/${d}/users`);

   const users = await(api.get(`/domains/${d}/users`) as Promise<User[]>);
   ```

4. **No query string in the path.** A path containing `?` or `#` is
   **refused** at runtime, not stripped: the path is what the platform checks
   against your declared resources, so it carries the resource and nothing
   else. Options travel separately:

   | Call                   | Where the options go                                                                                                                                                             |
   | ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
   | `api.get`              | The second argument, `params`, sent as the query string: ``api.get(`/domains/${d}/cdrs`, { start: 0, limit: 50, 'datetime-start': from })``. Leave out a key with no value.      |
   | `api.post` / `api.put` | The request body. The API reads a write's options from the body, so ``api.post(`/domains/${d}/users`, { ...user, synchronous: 'yes' })``. Flow sends `synchronous` the same way. |
   | `api.delete`           | Nothing yet: the call takes only a path.                                                                                                                                         |

On this demo, fixing two calls this way took the verifier from
`declared API resources: none` to `domains (read), users (read)`. The full app
now declares seven resources.

Also new at runtime:

- The proxy sends a snapshot of the request body it validated. Changing the
  object after the call has no effect.
- Your app's scope is checked on every call, so an administrator's change
  applies on the next call, without a reload.
- Encoded slashes, `/../` and double encoding in a path are refused.

---

## Part 4 — Keep the previous releases' chunks

Your remote entry URL is stable, and each release overwrites it. A session that
loaded the **old** `remoteEntry.js` keeps it in memory, and the next time it
needs a lazy chunk it asks for that chunk's **old** hashed filename. If your
release deleted that file, the load fails and the session is broken until the
user reloads.

- **Add the missing files, never overwrite one.** Use `rsync
--ignore-existing` or the equivalent. An overwrite puts old bytes under a
  name the new entry pins.
- **Hosts that replace the whole site** on each deploy (GitHub Pages through
  `actions/deploy-pages`, for example) need the previous releases' chunks
  downloaded and added to each new upload. This repository does that with
  [`scripts/carry-forward-chunks.mjs`](./scripts/carry-forward-chunks.mjs): it
  reads the live `release-files.json`, downloads the last two releases' chunks
  that `dist/` lacks, and writes the new list. Copy it; the workflow step is in
  [`.github/workflows/deploy-pages.yml`](./.github/workflows/deploy-pages.yml).
- **Keeping the last two or three releases is enough.** Source maps don't need
  to be kept: the platform reads maps only from the release being deployed.
- Old `.js` files the new entry doesn't load produce only an
  `undeclared-files` warning. The platform never fetches them.

The first deploy with the script carries nothing (there's no
`release-files.json` online yet). Every deploy after that carries the previous
ones.

---

## Part 5 — Your data goes in `context.storage`

The page's `localStorage`, `sessionStorage` and IndexedDB are shared with the
host and with every other app on it. A key prefix is a convention another app
can ignore. On Flow host 46.0 and later, the host keeps storage **for each app
and each signed-in user**:

```tsx
// React: the value, a setter that persists it, and the first read's state
const [prefs, setPrefs, { loading, error }] = useAppStorage(context, 'prefs', {
  dense: false,
});

// Imperative. `storage` is absent on an older host, so feature-detect.
await context.storage?.set('last-tab', 'calls');
const tab = await context.storage?.get<string>('last-tab');

// Memory only, synchronous, gone on reload: for anything you don't want on disk
context.storage?.session.set('draft', text);
```

**Where it lives, and how long**

- In the user's browser, in the host's own IndexedDB database. Not on a server.
- It survives reloads and restarts in that browser. It doesn't follow the user
  to another browser or device.
- It's cleared on sign-out, when the signed-in user changes, and when an
  administrator clears your app.
- In a private window, where IndexedDB isn't available, the host keeps it in
  memory and logs a warning.
- It separates honest apps from each other, but it isn't a sandbox: code on the
  page could open that database directly. Keep anything sensitive, such as
  tokens, on your own server or in `storage.session`.

**Limits**: 64 KB per value, 500 keys and 2 MB per user. Going over one rejects
with an error whose `code` is `STORAGE_QUOTA_EXCEEDED`. Values must be
JSON-serialisable. `useAppStorage` rolls a failed write back. On a host without
storage it keeps the value in memory and warns once.

**If the old code read storage synchronously**, load once at startup into a
module-level cache and keep the lookups synchronous. This demo's presenter
caller-ID aliases used to be read from `localStorage` on every lookup. Now:

- `src/App.tsx` loads them once with `flowContext.storage?.get(…)`;
- `src/mocks/crm.ts` keeps them in a cache that the lookups read;
- the editor on **Manage › CRM Integration** saves them with `useAppStorage`
  and updates the cache.

Before the move the verifier printed
`raw-web-storage … in your own source … src/mocks/crm.ts:190`. After it, only
the `loglevel` line is left (Part 10).

---

## Part 6 — Set the log level in code

0.3.x read the host's `ns_log_level` and `ns_ext_diag` keys from
`localStorage`, which put a raw storage read into every app's bundle. In 0.4 the
app sets the level, and the SDK reads nothing else for it:

```tsx
const { sdk } = useRemoteApp(flowContext, __MF_NAME__, { logLevel: 'INFO' });
// The same option on createRemoteAppSDK(ctx, name, { logLevel })
// and new RemoteAppSDK(ctx, name, { logLevel })

sdk.setLogLevel('DEBUG'); // at runtime, for example behind your own settings toggle
sdk.getLogLevel();
```

- The default is **`WARN` in production** (0.3.x was effectively `INFO`) and
  `DEBUG` in a development build. If you relied on seeing registrations logged
  in production, pass `logLevel: 'INFO'`.
- **Add the option with the upgrade, not before**, if you use TypeScript. 0.3.8's
  types don't have it, and the build fails with `TS2353: … 'logLevel' does not
exist in type 'UseRemoteAppOptions'`. In plain JavaScript, 0.3.8 ignores it.
- `window.__flowSDKLogger__` and `window.__setFlowSDKLogLevel__` are gone.
  `__flowSDKDebug__` is gated and returns counts, not objects.

---

## Part 7 — What the host no longer shares

Everything your app receives from the host is now a copy, or has passed a
check. Code that relied on sharing more will notice:

| Area                   | What changed                                                                                                                  | What to do                                                               |
| ---------------------- | ----------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| Event payloads         | Frozen copies. Your app sees only its own events.                                                                             | Copy a payload before changing it. Writing to one throws in strict mode. |
| Stream frames          | Each subscriber, and the replay cache, gets its own `structuredClone` of each frame. A frame that can't be cloned is dropped. | Don't share or change frames between handlers.                           |
| A disabled app         | When an administrator disables your app, the API calls already in flight fail with 403 `App "<id>" is no longer enabled`.     | Handle `PERMISSION_DENIED` without retrying.                             |
| Direct `/ns-api` calls | The host marks its own calls. Where the platform requires that marker, a cookie-authenticated call without it is refused.     | Always go through `context.api`.                                         |
| Call control           | Answer, reject, transfer and DTMF need a grant, are rate-limited and are audited.                                             | Request the grant. Replies come back only under your own app id.         |
| `api.getBaseUrl()`     | Still in 0.4.x, but it's being removed.                                                                                       | Stop calling it. Paths are relative to the API base already.             |

---

## Part 8 — Registration and routes

- **`requiredPermissions`** must be an array of strings, or the manifest is
  refused.
- **Route slots:** a `(parentPath, path)` slot belongs to the first app that
  registers it. A child route under another app's page is refused, at any
  depth, and so is a page under which another app already has a child. You
  can't withdraw a route the host owns.
- **Literal pages** take precedence only over their own concrete prefix. A
  `/manage/:domain` page can't hide another app's `/manage/acme` page.
- **`registerRouteFromModule(routeConfig, moduleConfig)`** keeps its
  signature, but it no longer looks your container up on `window`. It sends the
  module name, and the host loads that module from the container registered
  for your app, so an ES-module entry (Part 2) works too.
  - The promise resolves once the registration is sent.
  - A module your container doesn't expose is refused **on the host**: look in
    the host console and SDK Diagnostics, not in a `catch` in your app.
  - It needs a Flow host with 0.4 module-route support. Confirm with your
    NetSapiens contact before shipping an app that relies on it.
- **Zones** pass your components data, not live host objects.

---

## Part 9 — Remote authentication

Only if your app signs users in to a third party.

- **The NetSapiens token your vendor receives is identity-only.** Exchanging
  the code at the signed `validation_endpoint` returns a token whose `token_use`
  is `remote_auth_identity`. It lives 60–600 seconds (600 by default) and can't
  be refreshed. Your vendor uses it to confirm who the user is, not to call the
  NetSapiens API.
- **Read the user's role from `user_scope` in that exchange response.** The
  token's own `scope` is `Remote Auth Identity`, and the identity endpoint
  reports that, not the role.
- **Only the identity endpoint accepts it:** `GET /ns-api/oauth2/me` with a
  `Bearer` header (newer API builds also answer at `/ns-api/v2/oauth2/me`,
  beside the token endpoint). Anywhere else returns 403 `[RA017]`; once it has
  expired, 401 `[APP011]`.
- **Your own requests are unchanged.** The token your vendor returns to your app
  is yours: call your own backend with `fetch` as before. 0.4 checks only calls
  made through `context.api` and to `/ns-api`, and the host doesn't restrict
  where an app may send requests. The host keeps that token in memory, per app,
  and passes it straight to your handler. Keep it in memory or in
  `context.storage?.session`, never in `localStorage`.
- **Callback:** a public `https` URL, unless the platform has opted your URL
  in. The webhook is signed (`X-NS-Signature`, HMAC-SHA256) with your app's
  callback secret, at most 128 characters. If a callback is refused, `RA010`
  says why.
- **Vendor side:** refuse replays by the signed `request_id`, and pin the
  cluster's token endpoint (its configured callback name, not a single node).
  [`examples/vendor-backend/`](./examples/vendor-backend/) does both.
- **Limits:** starting a sign-in is rate-limited per user and app, and per app.
  If the user changes before the sign-in completes, the late result is
  discarded.
- **503 `[RA018]`** when you start a sign-in means the cluster has no public
  hostname configured for remote authentication (older builds reported this as
  `[RA017]`). The cluster operator sets it; nothing in your app changes.

---

## Part 10 — Upgrade, verify, ship

```bash
npm install @netsapiens/flow-sdk@^0.4.1
npm run build
npx flow-verify-bundle ./dist
```

This demo after the move:

```
[ warn ] undeclared-files   1 .js file(s) in dist that remoteEntry.js does not load … main.4b23818820cc2f5857cc.js
[ note ] react-internals    … node_modules/react/cjs/react.production.js
[ note ] raw-web-storage    … node_modules/loglevel/lib/loglevel.js
[ note ] entry-format       ES-module entry (library.type module): the host pins it through an import map and reads no window global
[ note ] api-resources      declared API resources: agents (read), avatar (read), callqueues (read),
                            contacts (write), devices (read), domains (read/write), users (read/write)
PASS — required checks satisfied (1 warning).
```

Those four lines are expected on a clean 0.4.x build and aren't about your
code:

| Line                    | Why                                                                                                       |
| ----------------------- | --------------------------------------------------------------------------------------------------------- |
| `note raw-web-storage`  | Inside the `loglevel` dependency. If it names `@netsapiens/flow-sdk`, you're still on 0.3.x.              |
| `note react-internals`  | Inside React's production build.                                                                          |
| `note entry-format`     | You built the ES-module entry (Part 2). Absent on a classic script entry.                                 |
| `warn undeclared-files` | Only when `dist/` holds a `.js` file your entry never loads, such as an extra entry chunk. Never fetched. |

Then release:

1. **Bump `version`** in `package.json` (and anywhere you mirror it). The
   stamp carries it to the platform. Publishing new bytes under an unchanged
   version leaves the platform pinning the old hash, and every host stops
   loading your app.
2. **Publish** with the previous releases' chunks kept (Part 4).
3. **Deploy the version** in Platform › UI SDK Management › Registered Apps,
   or through the API. The version and author come from the stamp.

---

## Checklist

- [ ] Ran the 0.4.1 verifier against the 0.3.x build and noted what it found (Part 0)
- [ ] `package.json` has `name`, `version` and `author`
- [ ] Line one of `dist/remoteEntry.js` is the `flow-app` stamp, and the map's `mappings` starts with `;`
- [ ] If you moved to the ES-module entry: `dist/remoteEntry.js` ends with `export{… as get,… as init}` and the verifier prints `entry-format`, not `module-chunk-loading`
- [ ] Every API call is `api.<method>(` + an inline path: no variable path, no other client name (and no type argument if your server's API is older than `46.0.0-alpha.902`)
- [ ] `api-resources` lists every resource your app reads or writes
- [ ] No `?` or `#` in an API path; query values are `params`
- [ ] Your publish step keeps the previous releases' chunks and never overwrites a file
- [ ] No app code calls `localStorage`, `sessionStorage`, `indexedDB`, `fetch('/ns-api…')`, `getBaseUrl()` or `__flowSDKLogger__`
- [ ] No handler writes to an event payload or a stream frame
- [ ] `@netsapiens/flow-sdk` is `^0.4.1`, and `logLevel` is set if you want more than warnings
- [ ] `flow-verify-bundle` prints PASS with no `app-manifest` or `api-path-not-literal` warning
- [ ] Version bumped and deployed

## Where the demo does each of these

| Change                                | File                                                                                                                                              |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| Build stamp, its guard and `stage`    | `webpack.config.js`                                                                                                                               |
| The ES-module entry                   | `webpack.config.js` (`experiments`, the two `output` lines, `library`)                                                                            |
| Typed API reads the analyser sees     | `src/pages/liveOperations/liveSeed.ts`, `src/pages/DomainCrmSyncPage.tsx`, `src/pages/showcase/sections/AvatarSection.tsx`, `src/api/callsApi.ts` |
| Keeping previous releases' chunks     | `scripts/carry-forward-chunks.mjs`, `.github/workflows/deploy-pages.yml`                                                                          |
| Version guard against the last push   | `.github/workflows/deploy-pages.yml`                                                                                                              |
| `context.storage` and `useAppStorage` | `PresenterAliasesSection` in `src/pages/CrmIntegrationPage.tsx`; the startup load in `src/App.tsx`; the cache in `src/mocks/crm.ts`               |
| `logLevel`                            | `useRemoteApp(…, { logLevel: 'INFO' })` in `src/App.tsx`                                                                                          |
| Remote auth vendor backend            | `examples/vendor-backend/`                                                                                                                        |
| Scaffolding a new 0.4 app             | `.claude/skills/create-flow-app/SKILL.md`                                                                                                         |
