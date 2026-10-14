---
name: create-flow-app
description: Scaffold a NetSapiens Flow remote app that passes platform bundle verification — chunk SRI, source maps, correct webpack `shared` config — with the current SDK shape: API client, scope declarations, capability-gated data streams, scoped event bus, and theme-correct UI. Use when asked to "create a Flow app", "scaffold a Flow extension" (or the older "Horizon app" / "Horizon extension"), or to start a new partner integration.
---

# create-flow-app

Scaffolds a new remote app for NetSapiens Flow.

> **A scaffolded app must pass platform bundle verification.** Since SDK 0.2.x the platform
> fetches the bundle itself, hashes it, and analyses it before it may load. Three things in the
> build are **hard rejects** if missing or wrong, and all three are handled by the templates
> below — do not "simplify" them away:
>
> 1. **Chunk Subresource Integrity** (`webpack-subresource-integrity` + `crossOriginLoading`)
> 2. **Source maps with `sourcesContent`** (`devtool: 'source-map'`, and `dist/*.map` must ship)
> 3. **`@netsapiens/flow-sdk` must NOT be in webpack `shared`**
>
> And one that only bites once the app grows past the template:
>
> 4. **`react-dom/client` must be declared `import: false`** if anything in the
>    dependency graph calls `createRoot`. Sharing `react-dom` does not cover it, and
>    the failure is a hard load error (React #527) naming a version that appears
>    nowhere in the host. See the `shared` block below — it also explains why
>    `import: false` is right there and wrong everywhere else.
>
> Run `npm run verify` before submitting. A pass locally is a pass on the platform.

> **RULE 1 — never hand-roll a UI component.** Every visible element comes from
> `flowContext.ui` (`ui.*` components and `ui.templates.*`). No styled DOM
> elements: no `<div style={…}>`, `<button style={…}>`, `<h2>`, `<table>`, `<pre>`.
>
> This is not a style preference. Kit components render inside the host's MUI
> `ThemeProvider`, so they re-colour the instant a user toggles dark mode. Markup
> painted from `ui.theme.colors` or `ui.styles` **cannot** — those are per-mode
> snapshots, so a hand-rolled card keeps its original colours forever while the
> page around it changes. An app built this way looks correct in whichever mode
> you developed in and broken in the other.
>
> Colours belong in `sx` as palette paths (`color='text.secondary'`,
> `borderLeftColor='primary.main'`, `bgcolor='background.elevation1'`), which the
> host resolves per render. `useTheme() → { theme }` is for _picking_ a value, not
> for rebuilding styling the kit already does.
>
> Three carve-outs, and nothing else: the bare fallback when the kit is
> unavailable (`if (!Paper) return …`), the hidden root of the headless `App`, and
> inline text semantics inside a `Typography` (`<strong>`, `<em>`, `<code>`).
>
> Missing a component? Do not fill the gap with styled markup — pick the nearest
> kit primitive and record it in `KIT-GAPS.md`.

**Reference material in this repository.** The app in `src/` is a working extension with every
requirement below already applied — read it when a template here is ambiguous.
[`MIGRATION-0.1.x-TO-0.2.x.md`](../../../MIGRATION-0.1.x-TO-0.2.x.md) is the full contract and
explains _why_ each requirement exists; `examples/vendor-backend` is a correct remote-auth
webhook verifier.

## Inputs to gather

Ask the user (and validate) before generating:

| Field        | Format                               | Example               |
| ------------ | ------------------------------------ | --------------------- |
| App ID       | `^[a-z0-9]+(-[a-z0-9]+)*$`           | `analytics-dashboard` |
| Display name | free-form                            | `Analytics Dashboard` |
| Module scope | `^[a-zA-Z][a-zA-Z0-9]*$` (camelCase) | `analyticsDashboard`  |
| Dev port     | 1024–65535 (recommend 5005–5099)     | `5005`                |
| Author       | free-form, optional                  | `Acme Corp`           |

If the target directory exists, ask before overwriting.

## Output structure

```
<app-id>/
├── src/
│   ├── App.tsx
│   ├── pages/MainPage.tsx
│   └── extensions/HeaderButton.tsx
├── index.html
├── webpack.config.js
├── tsconfig.json
├── package.json
├── .gitignore
├── KIT-GAPS.md
└── README.md
```

## File templates

### `package.json`

```json
{
  "name": "<app-id>",
  "version": "1.0.0",
  "description": "<display-name>",
  "author": "<author>",
  "private": true,
  "scripts": {
    "dev": "webpack serve --mode development",
    "build": "webpack --mode production",
    "start": "webpack serve --mode development",
    "verify": "flow-verify-bundle ./dist"
  },
  "engines": { "node": ">=18" },
  "dependencies": {
    "@netsapiens/flow-sdk": "^0.2.11",
    "loglevel": "^1.9.2",
    "react": "^19.2.0",
    "react-dom": "^19.2.0"
  },
  "devDependencies": {
    "@babel/core": "^7.23.0",
    "@babel/preset-env": "^7.23.0",
    "@babel/preset-react": "^7.22.0",
    "@babel/preset-typescript": "^7.23.0",
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0",
    "babel-loader": "^9.1.3",
    "html-webpack-plugin": "^5.5.3",
    "typescript": "^5.5.3",
    "webpack": "^5.89.0",
    "webpack-cli": "^5.1.4",
    "webpack-dev-server": "^5.2.1",
    "webpack-subresource-integrity": "^5.1.0"
  }
}
```

### `webpack.config.js`

```js
const HtmlWebpackPlugin = require('html-webpack-plugin');
const ModuleFederationPlugin = require('webpack/lib/container/ModuleFederationPlugin');
const { SubresourceIntegrityPlugin } = require('webpack-subresource-integrity');
const webpack = require('webpack');
const path = require('path');

// The ONE identifier you maintain — the Module Federation container name in
// camelCase (must be a valid JS identifier). It is the federation `name`, it is
// injected into the bundle as `__MF_NAME__` for `useRemoteApp(...)` (so the two
// can never drift), and it is the registration's `webpack_module`. The host/SDK
// derive the kebab-case registry `id` from it (analyticsDashboard → analytics-dashboard).
//
// `MF_NAME` overrides it for a LOCAL run against a shared server, e.g.
//   MF_NAME=<module-scope>Local npm run dev
// That build is registered as its own app (`<app-id>-local`) beside the
// published one, instead of pointing the published app at your localhost for
// everyone. It must match that registration's `webpack_module` exactly.
const MODULE_NAME = process.env.MF_NAME || '<module-scope>';
if (!/^[A-Za-z_$][\w$]*$/.test(MODULE_NAME)) {
  throw new Error(`MF_NAME must be a JavaScript identifier, got "${MODULE_NAME}"`);
}

module.exports = (_env, argv) => {
  const isProduction = argv.mode === 'production';

  return {
  mode: argv.mode || 'development',
  entry: './src/App.tsx',
  // REQUIRED. Bundle verification rejects a bundle with no source maps, and the
  // maps must carry `sourcesContent` — so never `noSources`, and `dist/*.map`
  // must be published alongside the JS. The analyser reads your original source
  // through these; without them it cannot attribute findings and rejects.
  devtool: 'source-map',
  output: {
    path: path.resolve(__dirname, 'dist'),
    publicPath: isProduction ? 'auto' : 'http://localhost:<dev-port>/',
    filename: isProduction ? '[name].[contenthash].js' : '[name].js',
    chunkFilename: isProduction ? '[id].[contenthash].js' : '[id].js',
    // REQUIRED for SRI to actually be enforced. A browser cannot verify an
    // integrity value against an opaque cross-origin response, so without this
    // the integrity attributes are emitted but never checked.
    crossOriginLoading: 'anonymous',
    clean: true,
  },
  // Needed as soon as your bundle imports react-dom at all — directly, or through
  // a UI library that renders portals. Without it webpack's default cache group can
  // emit a chunk that is present in the manifest with NO FILE, and the integrity
  // plugin writes a placeholder for every manifest entry, so one with no bytes can
  // never resolve: the build fails with "contains unresolved integrity
  // placeholders" and names neither react-dom nor `shared`. Vendor splitting is
  // unaffected. `webpack --json`, looking for a chunk with an empty `files` array,
  // is how you confirm it.
  //
  // `nodeEnv: 'production'` in EVERY mode, the dev server included. `react` is
  // shared, so at runtime it is the host's PRODUCTION React — but
  // `react/jsx-runtime` is not shared and gets bundled. Under `--mode development`
  // that is React's development JSX runtime, which calls `dispatcher.getOwner()`
  // on the host's production internals: the page loads, then dies on first render
  // with "dispatcher.getOwner is not a function". Forcing production library
  // branches keeps the bundled runtime matched to the host's React. Your own code
  // is still built in development mode, with source maps.
  optimization: {
    nodeEnv: 'production',
    splitChunks: { cacheGroups: { default: false } },
  },

  resolve: { extensions: ['.tsx', '.ts', '.js', '.jsx'] },
  module: {
    rules: [
      {
        test: /\.(ts|tsx)$/,
        exclude: /node_modules/,
        use: {
          loader: 'babel-loader',
          options: {
            presets: [
              '@babel/preset-env',
              ['@babel/preset-react', { runtime: 'automatic' }],
              '@babel/preset-typescript',
            ],
          },
        },
      },
    ],
  },
  plugins: [
    new ModuleFederationPlugin({
      name: MODULE_NAME,
      filename: 'remoteEntry.js',
      exposes: { './App': './src/App' },
      // Host-provided singletons only. Do NOT add `@netsapiens/flow-sdk` here:
      // sharing it fails the build outright with "contains unresolved integrity
      // placeholders", and the verifier rejects on `sdk-not-shared`. Removing it
      // entirely is the fix — do not try `import: false` for the SDK.
      //
      // Keep webpack's default local fallback for the three below. `react-dom/client`
      // is the ONE exception and takes `import: false` — see the note under it.
      shared: {
        react: { singleton: true, requiredVersion: '^19.2.0', eager: false },
        'react-dom': { singleton: true, requiredVersion: '^19.2.0', eager: false },
        loglevel: { singleton: true, requiredVersion: '^1.9.2', eager: false },

        // ⚠️ ONLY IF something in your graph calls createRoot — and you may not
        // have written that import. `@ant-design/v5-patch-for-react-19` does it,
        // so anyone porting an antd UI has it whether they know or not. A Flow
        // remote is mounted by the host inside the host's React tree, so a normal
        // extension never calls createRoot: check before adding this.
        //
        // Sharing 'react-dom' does NOT cover it. They are separate builds —
        // `react-dom` is createPortal/flushSync/version, while `react-dom/client`
        // is the entire reconciler, carrying the React version as a literal baked
        // in at publish time and checked at module evaluation. Undeclared, your
        // bundle keeps its own reconciler while `react` resolves to the host's,
        // the literals differ, and it fails to load with React error #527 naming a
        // react-dom version that appears nowhere in the host.
        //
        // `import: false` is required, not optional, and it is the opposite of the
        // rule above: keeping the fallback emits a chunk that leaves the integrity
        // plugin with a placeholder it cannot resolve. Use the exact key, never the
        // `react-dom/` prefix — the prefix would demand the host provide every
        // react-dom subpath your graph touches, and only `react-dom/client` is shared.
        //
        // 'react-dom/client': { singleton: true, requiredVersion: '^19.2.0', import: false },
      },
    }),
    // REQUIRED in production. Emits the per-chunk integrity map the platform
    // needs: it pins remoteEntry.js with a hash it computes itself, and that one
    // pin transitively covers your whole chunk graph through these values.
    ...(isProduction
      ? [new SubresourceIntegrityPlugin({ hashFuncNames: ['sha384'] })]
      : []),
    // Inject the federation name so the app reads it at runtime instead of
    // hardcoding it a second time (see src/App.tsx).
    new webpack.DefinePlugin({
      __MF_NAME__: JSON.stringify(MODULE_NAME),
    }),
    new HtmlWebpackPlugin({ template: './index.html' }),
  ],
  // `*` is fine for local dev. In production the CDN must return
  // Access-Control-Allow-Origin covering the portal origin — CORS is probed when
  // a version is submitted, and a bundle that fails the probe cannot be verified.
  devServer: {
    port: <dev-port>,
    headers: {
      'Access-Control-Allow-Origin': '*',
      // REQUIRED for an HTTPS Flow to load from localhost. Chrome's Private
      // Network Access preflights that script load and refuses it unless the
      // preflight allows the private network; Flow then reports only
      // "Script load error".
      'Access-Control-Allow-Private-Network': 'true',
    },
    // REQUIRED to load the dev server from Flow. webpack-dev-server ≥5.2
    // answers a cross-site <script> load (Sec-Fetch-Site: cross-site +
    // Sec-Fetch-Mode: no-cors) with 403 "Cross-Origin request blocked" unless
    // the Host is explicitly allowed — and that is exactly how Flow fetches a
    // dev remote. The CORS header above does not help: the guard runs first.
    // List only the loopback names (not 'all') so the DNS-rebinding Host check
    // still holds for every other name. `127.0.0.1` must be listed explicitly:
    // this guard does not exempt IP addresses the way the ordinary check does.
    allowedHosts: ['localhost', '127.0.0.1'],
    // No live-reload client. Inside Flow its socket comes from the portal's
    // origin, which the Host/Origin check above refuses ("Invalid Host/Origin
    // header"), so it floods the console with reconnect errors. Pointing it at
    // localhost (`client.webSocketURL`) does not help. Reload the page by hand.
    client: false,
    webSocketServer: false,
  },
  };
};
```

### `tsconfig.json`

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "jsx": "react-jsx",
    "module": "ESNext",
    "moduleResolution": "node",
    "resolveJsonModule": true,
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true
  },
  "include": ["src"]
}
```

### `src/App.tsx`

```tsx
import type { FlowContext } from '@netsapiens/flow-sdk';
import { useEffect, useMemo, useRef } from 'react';
import { FlowContextProvider, useRemoteApp } from '@netsapiens/flow-sdk';

import HeaderButton from './extensions/HeaderButton';
import MainPage from './pages/MainPage';

// Injected by webpack's DefinePlugin from the ModuleFederationPlugin `name`
// (see webpack.config.js) — the single identifier you maintain. The SDK derives
// the kebab-case registry id from it, so this always matches the webpack name.
declare const __MF_NAME__: string;

export default function App(flowContext: FlowContext) {
  const { sdk } = useRemoteApp(flowContext, __MF_NAME__);

  // The host rebuilds `flowContext` on every colour-mode change, `ui`
  // included — it keeps one frozen surface per mode. This ref is what lets the
  // wrapper below see that: read the LATEST context at render instead of closing
  // over the first one.
  //
  // Do not drop it. The wrapper is memoized with empty deps to keep a STABLE
  // component identity (re-creating it would unmount the page on every render),
  // and a closure over `flowContext` would therefore pin the page to the
  // context captured on first paint — `theme` would keep updating while
  // `ui.theme`/`ui.styles` stayed on the mode active when the app loaded. That
  // combination is the single most common theming bug in a Flow remote.
  const contextRef = useRef(flowContext);
  contextRef.current = flowContext;

  // Wrap the page once in FlowContextProvider so it reads a live, reactive
  // context (theme/locale/ui) via useFlowContext() — no prop drilling.
  const MainPageRoute = useMemo(
    () =>
      function MainPageRoute() {
        return (
          <FlowContextProvider context={contextRef.current}>
            <MainPage />
          </FlowContextProvider>
        );
      },
    [],
  );

  useEffect(() => {
    // registerRoute is async; surface failures rather than dropping them.
    sdk
      .registerRoute({
        id: '<app-id>.main',
        parentPath: '/apps',
        path: '<app-id>',
        label: '<display-name>',
        icon: 'mdi:application',
        placement: { last: true },
        // Who this page is for. The host enforces it on the route AND hides the
        // menu entry — declaring nothing means every signed-in user can open it.
        // A tier name is resolved by the host; a literal array pins the scopes.
        requiredScopes: 'ADMINS',
        component: MainPageRoute,
      })
      .catch((error) =>
        console.error('[<app-id>] route registration failed:', error),
      );

    // Contributing a BUTTON to an action zone: declare it, don't render it.
    // State the intent and the host draws it exactly as it draws its own header
    // buttons, so it cannot drift from the page it sits on. `onClick` receives
    // the live page state, so an action can work on the current rows or the
    // user's selection without owning a component.
    sdk.registerDynamicExtension({
      id: '<app-id>.header-button',
      zone: 'page-header-actions',
      // Admins above the domain reach this page under /manage/<domain>/…; the
      // domain's own Office/Site Manager gets /home/domain/… (no :domain — use
      // `user.domain`). List both or those managers never see the button.
      routes: [
        { pattern: '/manage/:domain/users' },
        { pattern: '/home/domain/users' },
      ],
      priority: 10,
      requiredScopes: 'DOMAIN_MANAGERS',
      actions: [
        {
          id: 'export',
          label: 'Export data',
          icon: 'material-symbols:download',
          intent: 'secondary', // 'primary' | 'secondary' (default) | 'danger'
          onClick: ({ pageContext, route }) => {
            const { rows, selectedRows } = (pageContext ?? {}) as {
              rows?: unknown[];
              selectedRows?: unknown[];
            };
            // Your app's own function — the SDK does not supply one. Define
            // or import it alongside this registration.
            exportRows(selectedRows?.length ? selectedRows : rows, route);
          },
        },
        // Several buttons: add entries. Several apps in one zone: the host
        // orders by `priority`, then array order.
      ],
    });

    // Use `component` only for something that is NOT a button — a badge, a
    // banner, a widget, a filter control. `component` and `actions` are mutually
    // exclusive; a registration with both, or neither, is rejected and logged.
    // `src/extensions/ExportButton.tsx` in this repository is the declared form;
    // the other files in that directory are components, correctly.

    // Host data streams are capability-gated and delivered through the SDK —
    // never the raw event bus. See "Host events & data streams" below. Requires
    // the `call-events:listen` capability in your registration's `permissions`.
    // subscribeToCallEvents RETURNS its unsubscribe function — call it to tear
    // the subscription down (here, on effect cleanup / unmount).
    const unsubscribeCallEvents = sdk.subscribeToCallEvents(
      ['call-started', 'call-answered', 'call-ended', 'call-missed'],
      (event) => console.log('[<app-id>] call event', event),
    );

    return () => unsubscribeCallEvents();
  }, [sdk]);

  return null;
}
```

### `src/pages/MainPage.tsx`

```tsx
import { useState } from 'react';
import { useFlowContext, useTheme } from '@netsapiens/flow-sdk';

export default function MainPage() {
  // Read the live, reactive context from the provider — not via props.
  const { ui, user } = useFlowContext();
  // `theme` is the REACTIVE color scheme: it flips the instant the user toggles
  // dark/light. Use it to PICK something (an icon, a branch), never to rebuild
  // styling — the `ui.*` components already re-theme themselves. See
  // "Theming & dark/light mode" below.
  const { theme } = useTheme();
  const [count, setCount] = useState(0);

  const { PageTemplate } = ui?.templates ?? {};
  const { Paper, Stack, Typography, Button, Chip, Code } = ui ?? {};

  if (!PageTemplate || !Paper || !Stack || !Typography || !Button) {
    return (
      <div style={{ padding: 24 }}>
        <h1><display-name></h1>
      </div>
    );
  }

  return (
    <PageTemplate
      title="<display-name>"
      breadcrumbs={[{ label: 'Apps', url: '/apps' }, { label: '<display-name>' }]}
      // `actions` is an ARRAY OF DESCRIPTORS the host renders into buttons — not
      // JSX. Passing a node throws "actions.map is not a function". For arbitrary
      // header JSX (chips/badges) use the `headerStatus` prop instead.
      actions={[
        {
          label: 'Refresh',
          icon: 'mdi:refresh',
          variant: 'secondary', // 'primary' | 'secondary' | 'danger'
          onClick: () => setCount(0),
        },
      ]}
    >
      <Stack spacing={3}>
        {/* No `sx` — `Paper` arrives as the platform's surface with 24px of
            padding. `rounded` asks for the host's corner radius. Reach for `sx`
            only to depart from that; it merges as an array, so an override
            wins per-property and leaves the other defaults alone. */}
        <Paper rounded>
          <Stack direction="row" spacing={2} alignItems="center" justifyContent="space-between">
            <Typography variant="h6">Welcome, {user.displayName}</Typography>
            {/* Re-labels on every toggle — proof the theme signal is reactive. */}
            {Chip ? <Chip size="small" label={`${theme} mode`} /> : null}
          </Stack>
          <Typography variant="body2">Domain: {user.domain}</Typography>
        </Paper>
        <Paper rounded>
          <Stack direction="row" spacing={2} alignItems="center">
            <Button onClick={() => setCount(count - 1)}>−</Button>
            {/* A monospace readout without hand-rolling one. `Code inline` is a
                kit component, so its surface follows the light/dark toggle. The
                alternative — a <span> styled from ui.theme tokens — is what the
                rule at the top of this skill exists to prevent. */}
            {Code ? (
              <Code inline>{String(count)}</Code>
            ) : (
              <Typography variant="h6">{count}</Typography>
            )}
            <Button onClick={() => setCount(count + 1)}>+</Button>
          </Stack>
        </Paper>
      </Stack>
    </PageTemplate>
  );
}
```

### `src/extensions/HeaderButton.tsx`

```tsx
import { type ExtensionComponentProps, useTheme } from '@netsapiens/flow-sdk';

export default function HeaderButton({ context }: ExtensionComponentProps) {
  // Extensions read the host UI components off `context.ui` (a prop, not a hook).
  const { Button, Icon } = context.ui || {};

  // Extensions render OUTSIDE FlowContextProvider, so `useTheme()` can't read
  // a provider — pass `context.eventBus` (subscribe for live updates) and
  // `context.theme` (correct value on first paint, before the first toggle).
  const { theme } = useTheme(context.eventBus, context.theme);

  const handleClick = () =>
    console.log('[<app-id>] header button clicked', context.params);

  // Graceful fallback if the host UI kit isn't available.
  if (!Button || !Icon) {
    return <button onClick={handleClick}><display-name></button>;
  }

  // The themed Button re-colors itself on toggle; we only use `theme` to pick a
  // mode-appropriate glyph. Never hardcode colors here.
  return (
    <Button
      variant="text"
      sx={{ px: 1 }}
      onClick={handleClick}
      startIcon={
        <Icon
          icon={theme === 'dark' ? 'mdi:weather-night' : 'mdi:weather-sunny'}
          sx={{ fontSize: 20 }}
        />
      }
    >
      <display-name>
    </Button>
  );
}
```

### `index.html`

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <title><display-name></title>
  </head>
  <body>
    <div id="root"></div>
  </body>
</html>
```

### `.gitignore`

```
node_modules/
dist/
*.log
.DS_Store
.env*
```

### `KIT-GAPS.md`

Seed the file empty, then **append to it while you build** — every time you reach
for a component that `flowContext.ui` does not have and use something else
instead. See the agent note at the bottom; this is not a scaffold-time artefact,
it is a running log.

```md
# Kit gaps — `flowContext.ui`

Components this app reached for and did not find, what it used instead, and what
that cost. Recorded while building, when the reasoning was still live.

**Please share this file** with the Flow SDK team — it is the input that
decides what gets added to the host UI kit. Add an entry whenever you work
around a missing component rather than fixing it silently.

<!-- No gaps recorded yet. Use the format below.

## <what was needed>

- **Reached for:** `ui.Thing`
- **Used instead:** what you actually did, with the file path
- **Cost:** lines of code, behaviour lost, risk taken on
- **Would have been solved by:** the component/prop shape that would have fit
-->
```

### `README.md`

````md
# <display-name>

Federated remote app for NetSapiens Flow.

## Develop

    npm install
    npm run dev

Serves `remoteEntry.js` from `http://localhost:<dev-port>/remoteEntry.js`.

## Register with Flow

Use **Platform → UI SDK Management → Registered Apps → Add App** in the host UI, or the API:

    curl -X POST "https://your-flow.example.com/ns-api/v2/ui-extensions/registry" \
      -H "Authorization: Bearer YOUR_TOKEN" \
      -H "Content-Type: application/json" \
      -d '{
        "name": "<display-name>",
        "description": "<display-name>",
        "author": "<author>",
        "version": "1.0.0",
        "remote_entry_url": "http://localhost:<dev-port>/remoteEntry.js",
        "webpack_module": "<module-scope>",
        "enabled": "yes"
      }'

The app `id` is derived server-side as the kebab-case of `webpack_module` (so `<module-scope>` → `<app-id>`). `webpack_module` must be unique platform-wide — a duplicate returns **409** — and is immutable once registered.

There is deliberately **no `permissions` or `capabilities` field**. The platform analyser extracts what your bundle declares (`requiredPermissions` on your extension configs) from the submitted source; the Capabilities column in Registered Apps is a read-only view of that. Capabilities are enabled or disabled **platform-wide** by an administrator, not per app.

Your origin must be in the operator's **approved CDN origins** allowlist or the bundle is refused before it is fetched. It is an allowlist of bare hostnames or single-label wildcards (`cdn.example.com`, `*.example.com`) and defaults to _nothing approved_. `localhost` and `127.0.0.1` are seeded, but that alone does not make a local bundle load — see **Local development** below. Failure is silent in the UI — check the console for `[FlowAppsLoader]` errors.

**Registration alone does not make the app load.** A newly registered app sits at verification status `none` and renders nowhere. Deploy a version — the platform fetches the bundle itself, verifies it, and promotes it:

    curl -X POST "https://your-flow.example.com/ns-api/v2/ui-extensions/registry/<app-id>/deploy" \
      -H "Authorization: Bearer YOUR_TOKEN" \
      -H "Content-Type: application/json" \
      -d '{ "remote_entry_url": "https://cdn.example.com/remoteEntry.js", "synchronous": "yes" }'

`version` is optional: omitted, the patch component advances; supplied, it must be **greater** than the current one. Never send an `integrity_hash` — the platform computes it from the bytes it fetched, and the field is no longer accepted. The response carries `status` (`approved` / `flagged` / `rejected` / `dev` / `unchanged`), `has_chunk_sri`, `promoted`, and `report.findings[]`. **`approved` and `flagged` both load**; `rejected`, `pending` and `none` do not. A `409` means two deploys raced for the same version — retry. Deploys are rate-limited to 10 per minute per app.

## Local development

You can run the app on your own machine and have Flow load it straight from `localhost`, with no scan and no publishing — then it's just code and refresh. This needs Flow (Flow) **46.0.0-staging.320** or newer and NS API v2 **46.0.0-alpha.598** or newer.

1.  **Switch it on once per dev server.** A Super User adds an **API config** (not a UI config) under **Platform › API › API configs › Add API config**: name `NsUISDKDevRemotes`, value type boolean, value `true`, target your API server(s). It is for development servers, so it is not in the populated list.
2.  **Run `npm run dev`** and check that `http://localhost:<dev-port>/remoteEntry.js` opens in your browser. The `devServer` block in `webpack.config.js` (`allowedHosts`, `client: false`, the `Access-Control-Allow-Private-Network` header) and `optimization.nodeEnv` are what make this work inside Flow — keep them.

    On a server other people use, run it under its own name instead — `MF_NAME=<module-scope>Local npm run dev` — and use that name in step 3. Deploying a localhost URL to the published app points it at localhost for **everyone**: each of them then loads nothing.

3.  **Register and deploy with the localhost URL.** Registering (above) with `remote_entry_url: http://localhost:<dev-port>/remoteEntry.js` is not enough by itself: the registration stays at `none`. Deploy it, with that same URL:

        curl -X POST "https://your-flow.example.com/ns-api/v2/ui-extensions/registry/<app-id>/deploy" \
          -H "Authorization: Bearer YOUR_TOKEN" \
          -H "Content-Type: application/json" \
          -d '{ "remote_entry_url": "http://localhost:<dev-port>/remoteEntry.js", "synchronous": "yes" }'

    For a run under `MF_NAME`, register a separate app with `"webpack_module": "<module-scope>Local"` (its id is `<app-id>-local`) and deploy that id; the published app is untouched.

    It answers `"status": "dev"` with no findings, and **Registered Apps** shows it as a **Development build**. (Without the API config, the same call is `rejected` with `fetch-failed: host resolves to a private, reserved or link-local address` — the platform's own fetch refuses localhost.)

4.  **Reload Flow** in Chrome or Edge. Chrome asks whether the site may access devices on your local network — allow it, or the bundle cannot be fetched. Newer Chrome keeps **loopback** (`localhost`) as its own permission, separate from the wider local network: if the load is still refused, open the site's settings, allow every local-network/loopback entry (or **Reset permissions** and reload to be asked again). As a last resort on a development machine, `chrome://flags/#local-network-access-check` → **Disabled** turns the check off browser-wide; switch it back afterwards. Safari cannot load a development build: it blocks an `http://` script on an `https://` page, localhost included.

A development build is fetched by **each viewer's own browser from its own `localhost`**, so it only renders for someone running the dev server on that machine; everyone else gets a console load error. Development builds load only from `localhost` / `127.0.0.1` URLs. When you are done, deploy a real build from your CDN URL, which runs the full verification.

If the app is listed but does not render, the console tells you which piece is missing: a `403` on `remoteEntry.js` is the dev server's cross-site guard (`allowedHosts`); "Script load error" with no response at all is Chrome's local-network check — the `Access-Control-Allow-Private-Network` header, or a denied local-network/loopback permission (step 4); "dispatcher.getOwner is not a function" is the development JSX runtime (`optimization.nodeEnv`); repeated "Invalid Host/Origin header" or `/ws` reconnect errors are the live-reload client (`client: false`). After a masquerade, Flow does not reload remote apps: reload the page before testing as the masqueraded user.

## Build for production

    npm run build
    npm run verify

`verify` runs `flow-verify-bundle` against `dist/`, the same checks the platform runs. A pass here is a pass there. Fix anything it reports before publishing — in particular `chunk-integrity`, `source-maps`, `sources-content` and `sdk-not-shared`, which are hard rejects.

Publish `dist/` — **including `dist/*.map`** — to your CDN at a **stable URL**. The remote entry URL does not change between releases: bump `version` in `package.json`, rebuild, publish over the same path, then submit the new version. The version field is what tells Flow to re-verify the bytes at that URL.

> Between publishing and the platform promoting the new version, the CDN serves new bytes while the platform still pins the old hash, so loads fail SRI. **Release in a maintenance window**, and keep the registered version and `package.json` version in lockstep (worth a CI guard).

### Deploying: build in CI from `main`

Do not hand-publish, and **do not commit `dist/`** — not to `main`, and not to a `gh-pages` branch. Built output in git produces diff noise on every change and lets the published bytes drift from the source they claim to come from. Build in CI from `main` so the only way to publish is to push source that builds.

For GitHub Pages, that means `build_type: workflow` (Settings → Pages → Source: GitHub Actions), not a branch source:

```yaml
# .github/workflows/deploy.yml
name: Deploy to GitHub Pages
on:
  push:
    branches: [main]
  workflow_dispatch:
permissions: { contents: read, pages: write, id-token: write }
# Never let two deploys race — a half-overwritten publish is what makes every
# host fail its integrity check at once.
concurrency: { group: pages, cancel-in-progress: false }
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '20', cache: npm }
      - run: npm ci
      - run: npm run build
      # The same checks the platform runs on submission. Failing here is much
      # cheaper than failing after publish, when the CDN is already serving
      # bytes the platform will refuse.
      - run: npm run verify
      - uses: actions/configure-pages@v5
      - uses: actions/upload-pages-artifact@v3
        with: { path: dist }
  deploy:
    needs: build
    runs-on: ubuntu-latest
    environment:
      { name: github-pages, url: '${{ steps.deployment.outputs.page_url }}' }
    steps:
      - id: deployment
        uses: actions/deploy-pages@v4
```
````

A **private repo can serve a public Pages site** on GitHub Enterprise Cloud (`PUT /repos/{owner}/{repo}/pages` with `public: true`). Use that: the platform must fetch `remoteEntry.js` unauthenticated, but the source does not have to be public. A private-visibility Pages site gets a randomised `*.pages.github.io` URL that the platform cannot reach.

GitHub Pages already sends `Access-Control-Allow-Origin: *`, which satisfies the CORS probe on submission.

### Code patterns the analyser rejects

Keep these out of `src/` — they are content rules, and most are hard rejects:

| Pattern                                                            | Verdict |
| ------------------------------------------------------------------ | ------- |
| `eval(...)`, `setTimeout('string')`                                | reject  |
| the literal string `/ns-api/` (call the API through `context.api`) | reject  |
| `document.cookie`                                                  | reject  |
| `credentials: 'include'` on `fetch`                                | reject  |
| `localStorage` keys prefixed `ns_`                                 | reject  |
| frame-escape (`window.top`, `parent.location`)                     | reject  |
| `new Function(...)`                                                | flag    |

A `size-delta` flag on your first 0.2.x submission is expected and needs no action. Note the analyser's rule policy is operator-tunable, so a local pass is not a guarantee of acceptance.

````

## Declaring who a surface is for (contract)

Menu visibility and route access used to be computed separately, so hiding a menu
entry was cosmetic — the page still opened for anyone who typed the URL. Access is
enforced on the route now, and `requiredScopes` is how a surface says who it is for.

Put it on **`registerRoute`, `registerDynamicExtension`, and column configs**. Two
forms, and prefer the first:

```tsx
requiredScopes: 'ADMINS'                    // host-resolved tier — survives a re-membered tier
requiredScopes: ['Admin', 'Super User']     // pinned literally — only when no tier fits
```

The tiers are `PLATFORM`, `ADMINS`, `DOMAIN_MANAGERS`, `DOMAIN_ONLY`, `CALL_CENTER`,
`END_USERS`. `SCOPE_GROUPS` in the SDK is a **fallback snapshot for local dev and
tests**, not the enforcement path — read `useScopes()` / `flowContext.scopes` for
the live vocabulary.

Three things that catch people out:

- **It narrows, it never widens.** The host intersects your declaration with what
  the user actually has. You cannot grant yourself reach by declaring it.
- **A malformed declaration refuses the whole registration** — a typo'd tier name
  is not ignored, it drops the surface. Write the value as an inline literal so
  TypeScript catches it at compile time rather than at load.
- **Columns deserve this more than they look like they do.** A column added to a
  host table is data on someone else's page; the scopes that page requires say
  nothing about who should see your column.

For capabilities (streams and the like), `sdk.declareCapabilityScopes({ 'call-events:listen': 'CALL_CENTER' })`
declares who *within* the app may exercise a granted capability. It is weaker than
`requiredScopes` — the platform grant is still what enables the capability at all —
so treat it as intent, not enforcement.

## Remote authentication (contract, only if your backend needs it)

Skip this unless the app authenticates the Flow user against **your own**
service. Where a webhook is sent is registration data, set by an administrator —
the app does not choose it.

```tsx
const { token, status, error } = useRemoteAuth(flowContext, '<your-vendor-id>', {
  scopes: ['profile'],
});
```

The hook authenticates on load; there is no button to wire up. Your backend
receives a signed webhook and must verify it:

- `X-NS-Signature` is an HMAC over `"<X-NS-Timestamp>." + <the exact raw request body>`.
  Hash the **raw bytes** — `JSON.stringify(req.body)` re-serializes and will not match.
- Reject a stale `X-NS-Timestamp` (5 minutes is reasonable). It is inside the signed
  string, so it cannot be altered without breaking the signature.
- `X-NS-Signature-Version: 2` identifies the scheme.

`examples/vendor-backend` in this repository is a working implementation with the
raw-body capture wired up correctly; Part 6 of the migration guide explains the
rest.

## Calling the NetSapiens API (contract)

Read/write platform data through `flowContext.api` — the host-brokered,
audited proxy. The app never sees the user's token.

```tsx
const { api, user } = useFlowContext(); // (or destructure from useRemoteApp in App.tsx)

const devices = await api.get<Device[]>(`/domains/${user.domain}/users/${user.extension}/devices`);
await api.post(`/domains/${user.domain}/users/${user.extension}/contacts`, {
  /* … */
});
// also: api.put<T>(path, data), api.delete<T>(path)
````

- **Paths are relative to `/ns-api/v2`** (`api.getBaseUrl()` returns that). Pass
  only the relative path; the host prepends the base and injects credentials.
- **v2 REST only.** The proxy does not expose the host JWT, so the legacy
  `/ns-api/?object=…&action=…` endpoints are **not reachable** from a remote app.
  If a capability only exists on legacy, a v2 route has to be added server-side.
- Calls are permission-gated, rate-limited, and audited per app — surface
  failures (`.catch`) rather than assuming success.

## What's in the kit (inventory)

Check here before building anything yourself — RULE 1 is only followable if you
know what exists. Everything below hangs off `flowContext.ui`.

**Whole shells** — `ui.templates.*`: `PageTemplate`,
`PageTemplateWithExtensions`, `FormTemplate`, `FormPanel`, `SidePanel`,
`DatagridTemplate`, `DashboardTemplate` _(0.2.11 — a dashboard page you own, with
the host's grid and card frames, minus reorder and Customize)_,
`CarouselTemplate`, `SideTrayComponents`, `Icon`, `ExtensionZone` (mount a zone
in your own page so other apps can contribute).

**Actions & input**: `Button`, `IconButton` (icon-name prop, never children),
`TextField` (`multiline` for a textarea — there is no `TextArea`), `SearchField`
(debounced; pass `debounceMs={0}` to opt out), `Autocomplete` (host datasets or
your own `options`; deliberately no `fetchOptions`), `Select` (`options`, never
`MenuItem` children), `Checkbox`, `Radio`, `RadioGroup`, `Switch`,
`ToggleButton`, `ToggleButtonGroup`, `FormLabel`, `FormControlLabel`.

**Navigation & surfaces**: `Tabs` (owns the strip; you render the panels),
`Card`, `CardContent`, `Paper` (pre-styled card — see below).

**Display**: `Typography`, `Chip`, `Avatar`, `Divider`, `Tooltip`, `Alert`,
`Icon`, `Code` _(0.2.7)_.

**Layout**: `Stack` (column by default), `Box` (the one deliberately bare
primitive), `Grid` _(0.2.7 — MUI v7 API: `size={{ xs: 12, md: 6 }}`, not
`xs={12}`)_.

**Static tables** _(0.2.7)_: `Table`, `TableHead`, `TableBody`, `TableRow`,
`TableCell`. For anything with sorting, filtering, search, export or pagination
use `DatagridTemplate` instead — these are for short fixed tables only.

**Lists** _(0.2.7)_: `List`, `ListItem`, `ListItemText`. `component='ol'`/`'li'`
gives you the semantics; the markers need asking for —
`sx={{ listStyle: 'decimal', pl: 3, '& > li': { display: 'list-item' } }}` — or
you ship an ordered list with no numbers in it.

**Dashboard figures** _(0.2.11)_: `Chart` (`kind='line' | 'area' | 'bar'`),
`Donut`, `StatBlock`, `ActivityList`. These are what the host's own dashboard
cards are built from, so a widget made of them is indistinguishable from a native
one. Colour is a semantic `tone`, never a hex. See the widget contract below.

Several components arrive **already styled**, so declaring them bare is correct
and `sx`/`variant` are for departing from the default, not assembling it: `Paper`
(24px padding on the platform's own surface), `Button` (`variant='primary'`),
`Chip` (soft, neutral, small), `Tabs` (`'pill'`), `Stack` (`direction='column'`).
`sx` merges as an array, so an override wins per-property and leaves the rest
intact.

**Corners** _(0.3.2)_: `Paper` and `Card` are square by default, like the
platform's own panels. Pass `rounded` for rounded corners — the radius is the
host's, so never write `sx={{ borderRadius: … }}` to get it. Round all of a
page's cards or none. Dashboard cards and `WidgetCard` are always square and do
not take it; never wrap a widget in a rounded `Paper` to round it (that is a card
inside a card). `variant='outlined'` also rounds, but swaps the outline for a
border — use `rounded` for the corners alone.

⚠️ **The default is the theme's, not the kit's.** `Paper`, `Card` and `Chip` used
to have a `variant` pinned by the SDK wrapper; that was removed in 0.2.11 because
re-specifying the theme's own settings is how a contributed card ends up rounder
than every native surface around it. Two consequences for you: don't pass a
`variant` to match what you see (you are freezing today's choice), and don't pass
`size='small'` to a `Chip` — the theme already sets it platform-wide, so it
changes nothing and `'medium'` would make your chip the odd one out.

**Genuinely not in the kit** — do not hunt for these: `TableContainer` (use
`Paper sx={{ overflowX: 'auto' }}`), `TableSortLabel` (sorting is
`DatagridTemplate`'s job), `MenuItem`, `Menu`, `Accordion`, `Badge`,
`LinearProgress`, `Skeleton`, `Snackbar`, `Dialog`/`Drawer` (use
`templates.SidePanel`), `CardActionArea` (give `Card` an `onClick` — the host
renders one internally, keyboard-reachable), `Breadcrumbs` (`PageTemplate` takes
a `breadcrumbs` prop), `TextArea` (`TextField multiline`), `DatePicker`. If you
need one, use the nearest primitive and log it in `KIT-GAPS.md`.

**Verify this list before trusting it.** It is a copy of the host's
`src/lib/sdk/ui/flowUi.ts` and copies go stale — this section listed `Table`,
`Grid`, `List` and `Code` as missing for several releases after they shipped, and
apps hand-rolled all four on that advice.

## Theming & dark/light mode (contract)

Aurora (the host theme) drives a live light/dark toggle. An app looks native only
if it re-themes with it. Four things the host hands you, and how each behaves:

| Source                               | What it is                                                                                              | Reactive to toggle?                                                              |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| `ui.*` components / `ui.templates.*` | host MUI components (`Button`, `Paper`, `Chip`, `PageTemplate`, …)                                      | **Yes** — wrapped in the host's MUI `ThemeProvider`, they re-color automatically |
| `useTheme() → { theme }`             | the `'light' \| 'dark'` mode string                                                                     | **Yes** — flips the instant the user toggles                                     |
| `ui.theme` (`ThemeTokens`)           | design tokens: `colors`, `spacing`, `typography`, `borderRadius`, `shadows`                             | **Snapshot** — frozen at the mode active when the route first mounted            |
| `ui.styles`                          | pre-built semantic style objects (`surface.card`, `text.*`, `badge.*`, `divider`) baked from the tokens | **Snapshot** — same as `ui.theme`                                                |

**Why the snapshot.** Three pieces, none wrong on its own, and the bug lives in
their interaction — worth knowing, because it is easy to reintroduce:

1. **The host is fine.** It keeps one frozen `ui` surface _per colour mode_ and
   rebuilds the whole context when the mode changes. Correct tokens are handed
   over every time.
2. **The provider refreshes only two fields.** `FlowContextProvider`
   re-spreads `{ ...context, theme, locale }` and never touches `context.ui`.
3. **So freezing the context pins `ui`.** The `useMemo([], …)` page wrapper in
   `App.tsx` — needed for stable component identity — closes over the context
   from first paint unless you read it through a ref. Then `theme` keeps
   updating while `ui.theme`/`ui.styles` stay on the load-time mode.

The `App.tsx` template above uses the ref, which is why its pages see a live
`ui`. Keep it. But do not treat that as licence to style from tokens: it holds
only as long as the ref does, and inline token styling still skips the focus
rings, hover states and a11y that kit components carry.

Note also that **zone extensions and dynamic columns are immune** — the host
re-derives their `ui` per render, so this only ever bites full-page routes.

Rules that keep an app theme-correct:

1. **Default to `ui.*` components for anything visible.** They re-theme live and
   are the reason MUI isn't a direct dependency. This alone gets ~all UI right.
2. **`useTheme()` is the only reactive theme signal** — use it to pick a
   mode-dependent glyph, image, or chart palette (values your app owns), not to
   recolor host chrome.
3. **From `ui.theme`, only `spacing` / `typography` / `borderRadius` are
   mode-invariant** (identical in light & dark) — those are safe to read off the
   snapshot for custom layout/sizing. `colors` and `shadows` differ by mode, so
   the snapshot copies go stale on toggle.
4. **Need a mode-dependent color?** Per RULE 1 you should not be hand-rolling
   the markup in the first place — put the region in a `ui.*` surface and give
   `sx` a **palette path** (`bgcolor='background.elevation1'`,
   `borderColor='divider'`, `color='text.secondary'`), which the host resolves
   per render. Only if you own the value outright (a chart series, a brand
   glyph) branch on the reactive `theme`. Never read it from the snapshot: the
   token builders (`getThemeTokens`/`getUIStyles`) are host-internal and **not**
   exported, so you cannot recompute fresh ones yourself.
5. **Don't subscribe to `theme:changed` directly** — `useTheme()` already does,
   in both pages (via provider) and standalone extensions (via `context.eventBus`).

## Rendering a data table (contract)

Use `ui.templates.DatagridTemplate` — it wraps the host's shared `DataTable`, so it
inherits search, filtering, CSV export, column show/hide, per-user persisted column
order/width, autosize, row actions, and the pagination footer. Do **not** hand-roll a
table; a remote app has no MUI of its own.

```tsx
const { DatagridTemplate } = ui?.templates ?? {};

<DatagridTemplate
  data={rows}
  columns={[
    { field: 'name', headerName: 'Name', flex: 1, minWidth: 150 },
    { field: 'email', headerName: 'Email', flex: 1, minWidth: 200 },
    { field: 'status', headerName: 'Status', width: 120 },
  ]}
  actions={[
    { label: 'Edit', icon: 'mdi:pencil', onClick: (row) => edit(row) },
    {
      label: 'Delete',
      icon: 'mdi:delete',
      color: 'error',
      onClick: (row) => remove(row),
    },
  ]}
  toolbar={{
    enableSearch: true,
    enableFilter: true,
    enableColumns: true,
    enableExport: true,
    enableRefresh: true,
    onRefresh: refetch,
  }}
  getRowId={(row) => row.id}
  loading={isLoading}
  defaultPageSize={25}
  pageSizeOptions={[15, 25, 50, 100]}
/>;
```

The grid sizes itself, but only if the page tells the shell to fill. Put
`layout="fill"` on the `PageTemplate` that wraps it:

```tsx
<PageTemplate title='<display-name>' layout='fill'>
  <Alert severity='info'>…</Alert> {/* takes its height first */}
  <DatagridTemplate {...gridProps} /> {/* absorbs whatever is left */}
</PageTemplate>
```

**Put them in directly — do not wrap them in a `<Stack>` or `<Box>`.** The body is
already a flex column with its own gap. A wrapper sits in between as a
content-sized flex item, and the grid fills _the wrapper_ instead of the page, so
it stops short of the bottom. If you genuinely need one, give it
`sx={{ flex: 1, minHeight: 0 }}` so it fills and lets the grid fill in turn.

`src/pages/CallRecordingsPage.tsx` in this repository is exactly this shape, and
`DATAGRID.md` covers the footer questions in more depth.

Rules that trip apps up:

1. **Never calculate a `height`. Set `layout="fill"` on the `PageTemplate` instead.**
   The grid then takes whatever height is left in the page column, so its pagination row
   sits on the viewport's bottom edge however much you stack above it — a heading, a
   banner, a filter row, or a host extension zone. It stays correct when that content
   changes.

   This used to advise passing a concrete offset tuned to your own chrome. That produced
   values like `calc(100vh - 470px)` — this repository's own call-recordings page was one
   — right the day they were written, wrong as soon as anything above the grid moved. Pass
   an explicit `height` only for a genuinely fixed-size grid: a dashboard card, one pane
   of a split view.

2. **`height="auto"` is the usual reason pagination looks missing.** It sizes the grid to
   its rows, so the footer follows the last row — about `rows × rowHeight` down the page,
   ~1600px at `defaultPageSize: 25` with 64px rows, i.e. two screens down. It is a fine
   choice for a short table that should grow and let the page scroll, but pair it with a
   small `defaultPageSize` (5–10). `layout="fill"` is what you want otherwise.
3. **Pagination is client-side over the rows you pass.** There is no `paginationMode`,
   `rowCount`, or `onPaginationModelChange` — fetch your rows, hand them over, and the
   footer paginates them. If you page a large set in yourself, feed
   `infiniteLoading={{ totalCount, progress, isLoadingAny }}` so the footer shows
   load progress instead of a total that keeps changing.
4. **`defaultPageSize` larger than your row count leaves every page control disabled** —
   correct behaviour, but it reads as "pagination is broken". Check against real volumes.
5. **Set `getRowId`** unless your rows have an `id` field; without it selection, export
   of selected rows, and detail panels all misbehave.
6. `headerName` and action `label` are run through the host translator, so a plain
   English string is fine but a translation key resolves if one exists.

## Contributing a dashboard widget (contract)

A widget is a card on a dashboard. The host owns the grid, the card, the heading,
the padding and the menu — write content and it matches every native card.

```tsx
sdk.registerWidget({
  // A plain name. The host prefixes your app id, so this is stored as
  // `<app-id>:activity`. Two apps can both ship a `sales-pipeline` and neither
  // has to know. It is also what lands in every user's saved layout, so it is
  // the one field that cannot change without losing every placement.
  id: 'activity',
  kind: 'panel', // or 'leaf' — a block inside a host container
  zones: ['platform-admin-dashboard-widgets'],
  title: 'Recent activity',
  description: 'Shown on the catalogue card',
  icon: 'mdi:pulse',
  category: 'activity', // decides the catalogue section and the loading wireframe
  size: { default: 'half' },
  // Narrows only. The host intersects this with the dashboard's own floor, so it
  // can hide the widget from some people who can reach the dashboard, never
  // reveal it to somebody who cannot.
  requiredScopes: 'ADMINS',
  // Where it lands on add and on every re-add. Not consulted once it is placed —
  // after that the user's arrangement wins.
  placement: { after: 'health' },
  component: RecentActivity,
});

// On unmount. `cleanup()` also tears this down.
sdk.unregisterWidget('activity');
```

Your component is handed `{ context, widget, actions }`:

- `context.ui` — the host UI kit, as everywhere else.
- `widget.pixel` — the card's box, derived by the host. ECharts sizes to its
  container at init and does not observe resize, so a chart needs this signal.
  A **leaf** gets `{ width: 0, height: 0 }`: its container lays it out.
- `widget.range` — resolved `from`/`to` timestamps if you declared
  `refreshPolicy: 'shared-range'`. Never a preset label.
- `actions` — `remove()`, `resize()`, `refresh()`. Refresh is a **remount**: the
  host holds no handle on your queries, so it bumps a token in your component's
  key and whatever you do on mount runs again.

`refreshPolicy` declares where your data comes from, and the host acts on it:

| Policy           | What you get                                                |
| ---------------- | ----------------------------------------------------------- |
| `'shared-range'` | `widget.range`, as resolved from/to timestamps              |
| `'own-cadence'`  | No range — you own the timer                                |
| `'realtime'`     | No range — data arrives by push on your scoped event bus    |
| _omitted_        | Nothing. Correct for a widget whose content cannot go stale |

Declaring one you do not need is a claim the host acts on: it hands you a range
and invites a dependency on a control unrelated to your card.

Two gates beyond `requiredScopes`, answering different questions:

```tsx
// What your APP was granted. Checked before the widget reaches the catalogue,
// so a platform with the capability switched off never offers an empty card.
requiredPermissions: ['call-events:listen'],
// Your own predicate, evaluated last, on every read. One that throws hides the
// widget rather than taking the dashboard's render down, so be strict.
condition: (context) => Boolean(context.eventBus),
```

**Do not draw a card, a heading or padding.** The frame draws all of it, from
what you already declare — `title` as the heading, `description` as the subtitle
beneath it, a window chip for a `shared-range` widget, and a provenance tooltip
from `metric`. Write content and it matches every native card.

**And build the content from the same components the native cards use** _(0.2.11)_:

| Card is… | Use               | Instead of                                   |
| -------- | ----------------- | -------------------------------------------- |
| a figure | `ui.StatBlock`    | `Typography variant='h4'` + a hand sparkline |
| a trend  | `ui.Chart`        | ECharts, Recharts, anything of your own      |
| a split  | `ui.Donut`        | a pie you style yourself                     |
| a feed   | `ui.ActivityList` | a `List` with hand-placed status dots        |

This is not a style preference, it is the whole reason a contributed card looks
native. A stat leaf that hand-built its number as
`Typography variant='h4' fontWeight={600}` sat beside a native block that is
`h4`'s own weight at `text.secondary` — 700 vs 600, `rgb(77,89,94)` vs
`rgb(27,33,36)`. Invisible until somebody inspects it, then obviously wrong, and
it drifts again the next time the platform restyles. Pass a semantic `tone`
(`success`, `error`, `warning`, `neutral`, `primary`) and the host picks the
colour, so it follows the toggle and a reseller's palette with nothing to update.

`chrome: 'self'` turns all of that off and hands you the padding and type scale
to match by hand. It exists for host panels that predate the widget frame; an app
that sets it gets two titles and a double inset, or loses the header entirely.

**Do not emit `dynamic-widget:register` on the bus.** `registerWidget` is the
only supported path; the bus is an SDK implementation detail and the event names
are not exported.

A **leaf** goes inside a host container rather than becoming a card of its own:

```tsx
sdk.registerWidget({
  id: 'tickets',
  kind: 'leaf',
  leafOf: 'stat', // the container category
  zones: ['platform-admin-dashboard-widgets'],
  title: 'Open tickets',
  category: 'stats',
  component: OpenTickets,
});
```

You can also ship a **container** — a panel that holds your own leaves. The host
renders its `LeafContainer` in place of your `component`, lays the leaves out,
reorders them inside that card, and draws the empty state when the last one is
removed:

```tsx
sdk.registerWidget({
  id: 'integration-health',
  kind: 'panel',
  // Namespace the category. The host resolves a leaf's home by finding the first
  // panel that accepts it, so declaring 'stat' would race the host's stat card.
  acceptsLeaves: { category: 'myapp-insight' },
  zones: ['platform-admin-dashboard-widgets'],
  title: 'Integration health',
  category: 'other',
  component: () => null, // never called — the container branch runs instead
});

sdk.registerWidget({
  id: 'contacts-synced',
  kind: 'leaf',
  leafOf: 'myapp-insight', // → your container, not the host's
  zones: ['platform-admin-dashboard-widgets'],
  title: 'Contacts synced',
  category: 'stats',
  component: SyncedContacts,
});
```

The user adds widgets from **Customize** on the dashboard; registering one offers
it in that catalogue rather than placing it. A saved layout is authoritative, so
a widget you ship later never appears on a dashboard somebody has already
arranged — it appears in their catalogue.

Check what you contributed under **Platform → UI SDK management → Registered
apps**, which lists your widget zones and whether each is enabled. A refused
registration logs the reason; it never fails silently.

## Host events & data streams (contract)

Two rules govern how a remote app talks across the host boundary. The host **enforces** both — get them right.

### 1. Host data streams are capability-gated — never read the raw bus

Live host data (call events, subscriber / device / registration changes) is delivered **only** through the SDK as per-app callbacks. It is **not** broadcast on `eventBus`, so `flowContext.eventBus.on('call-event' | 'subscriber:*', …)` receives nothing.

```tsx
// Call events — typed helper:
const stop = sdk.subscribeToCallEvents(
  ['call-started', 'call-answered', 'call-ended'],
  (event) => {
    /* … */
  },
);

// Other host streams (subscriber / device / registration):
const stop2 = sdk.subscribeToStream('subscriber', ['user'], (event) => {
  /* … */
});

// Call stop()/stop2() to unsubscribe; sdk.cleanup() also tears them down.
// The useStream(eventBus, webpackModule, streamId, eventTypes, cb) hook does
// the same with automatic cleanup.
```

Each stream is gated by a `<streamId>:listen` capability. Declare it as `requiredPermissions` on the extension config that needs it — the platform analyser extracts those from your submitted source, and the Capabilities column on Registered Apps is a read-only view of what it found. There is no `permissions` field on the registration to list them in. The capability must also be enabled **platform-wide**; an administrator can disable any capability globally, and a disabled one silently ignores the subscription. Subscriptions are attributed to your app on the Registered Apps page.

| `subscribeToStream` id | Capability            | Carries                                             |
| ---------------------- | --------------------- | --------------------------------------------------- |
| `call-events`          | `call-events:listen`  | SIP call lifecycle (prefer `subscribeToCallEvents`) |
| `subscriber`           | `subscriber:listen`   | subscriber / user record changes                    |
| `device`               | `device:listen`       | device state                                        |
| `registration`         | `registration:listen` | SIP registration state                              |

### 2. The event bus is per-app scoped — use it only for your own custom events

The host hands each app a **scoped** `eventBus`. Custom events you emit are automatically confined to your app's namespace: they reach your own pages and extensions (e.g. a `table-row-actions` extension signalling your page or side panel) but never another app — and you cannot listen to host channels or another app's events.

```tsx
// Intra-app coordination only — the host scopes this to your app automatically.
flowContext.eventBus.emit('<app-id>:refresh', payload);
flowContext.eventBus.on('<app-id>:refresh', handler); // clean up in your effect
```

Do **not** subscribe to `theme:changed` / `locale:changed` directly — use `useTheme()` / `useLocale()`. Opening the shared side panel from an extension is a built-in control event — use `useSidePanel()`, not a custom event.

## After scaffolding

Tell the user:

```
✅ Created <app-id> at ./<app-id>

Next:
  cd <app-id>
  npm install
  npm run dev

Then register with Flow (see README for the curl command), and visit
/apps/<app-id> in your Flow instance.

Check who each surface is for:
  Every registered route, extension and column should declare `requiredScopes`.
  Without it, any signed-in user can reach it.

Before you ship:
  npm run build && npm run verify

  `verify` runs the same bundle checks the platform runs. Registering the app
  is not enough on its own — it stays at verification status `none` and will
  not render until you deploy a version and it is verified. The README has the
  deploy call.

  Your CDN origin must be in the operator's approved CDN origins list, or the
  bundle is refused before it is fetched.

To develop against a live Flow without publishing, see "Local development"
in the README: it needs the `NsUISDKDevRemotes` API config on the server, then
a deploy of the localhost URL.

If you had to work around a missing UI component, it is written up in
KIT-GAPS.md — please send that file to the Flow SDK team. It is how the
host UI kit finds out what it is missing.
```

## Notes for the agent

- Replace **all** placeholders before writing files: `<app-id>`, `<display-name>`, `<module-scope>`, `<dev-port>`, `<author>`.
- **Keep `KIT-GAPS.md` up to date as you build — this is a running log, not a scaffold-time file.** The kit is deliberately smaller than MUI, so sooner or later you will want a component it does not have. Whenever that happens, do not just work around it silently: append an entry recording what you reached for, what you used instead (with the file path), what it cost, and the component shape that would have fit. You are the only observer who has that reasoning while it is still live — a developer reading the finished code months later cannot reconstruct why a `ToggleButtonGroup` is pretending to be a tab strip. This file is the sole mechanism by which the host UI kit learns what it is missing, so an unrecorded workaround is a gap nobody ever hears about. If you finish with no gaps, leave the file with its commented-out template; an empty log is a real signal too.
- **The federation name is single-sourced.** `<module-scope>` (camelCase) is now hardcoded in exactly one place — `MODULE_NAME` in `webpack.config.js`, which `MF_NAME` overrides for a local run — and flows into the app via `DefinePlugin` (`__MF_NAME__`), which `useRemoteApp(flowContext, __MF_NAME__)` consumes. Do **not** also hardcode the module name in `App.tsx`. `<module-scope>` must be a valid JS identifier (camelCase, no dashes); the SDK/host derive the kebab `<app-id>` from it, which is what you use for route ids/paths (`<app-id>.main`, `/apps/<app-id>`) and the registration's `capabilities.routes`.
- Don't pull in MUI as a direct dependency — every UI component comes from `flowContext.ui`. They're wrapped in the host MUI `ThemeProvider`, so they re-theme on a live dark/light toggle for free — which is exactly why hand-rolled markup colored from raw tokens drifts out of sync.
- **RULE 1 is the one to re-read before writing any JSX — see the top of this skill, and "What's in the kit".** Every visible element comes from `ui.*` / `ui.templates.*`; colours go in `sx` as palette paths. Never paint from `ui.theme.colors` or `ui.styles` — they are per-mode snapshots, so hand-rolled markup silently stops following the dark/light toggle, and `getThemeTokens`/`getUIStyles` are host-internal so you cannot recompute fresh ones. `useTheme() → { theme }` is the only reactive mode signal, and it is for _picking_ a value you own. In standalone extensions (outside the provider) call `useTheme(context.eventBus, context.theme)`. Full mechanism in "Theming & dark/light mode".
- **Keep the `contextRef` in `App.tsx`.** The memoized page wrapper must read `contextRef.current`, not close over `flowContext`. Closing over it pins `ui` to the colour mode active at first paint while `theme` keeps updating — the most common theming bug in a Flow remote, and invisible until someone toggles dark mode.
- **Only `react`, `react-dom`, and `loglevel` go in webpack `shared`.** Any other runtime dependency (e.g. a WebRTC/signaling/charting lib) is bundled normally — just `npm install` it and import it. Do **NOT** add a non-host-provided lib to `shared` as a `singleton`: the host's federation loader doesn't register it, so it crashes at load with "Unsatisfied version". (This is also why MUI is absent from `shared`.) The host also provides `i18next` and `react-i18next`, but you reach translations through `context.t` rather than sharing them.
- **Never put `@netsapiens/flow-sdk` in `shared`.** It is the one entry that looks like it belongs and does not. Sharing it fails the build with "contains unresolved integrity placeholders" and fails verification on `sdk-not-shared`. Remove it entirely — `import: false` is not a workaround.
- **Pages read context via `useFlowContext()`, not props.** Wrap each page component once in `<FlowContextProvider context={flowContext}>` inside `App.tsx` (memoized with **empty deps** for stable identity — the provider keeps theme/locale live via the eventBus). Don't prop-drill `flowContext` into pages. Extensions are different — they receive `context` as a prop (`ExtensionComponentProps`) and read `context.ui` directly.
- **Host UI components are properly typed — do not cast them.** They carry real prop contracts (`HostComponentProps`, or a named interface where the shape is specific). Casting to `ComponentType<unknown>` or `ComponentType<Record<string, unknown>>` was a 0.1.x-era workaround and is now actively wrong: props are contravariant, so `unknown` demands a component accepting every possible props object, and React 19 reads it as `IntrinsicAttributes` — "accepts no props" — which makes `<Paper sx={{ p: 2 }}>x</Paper>` a type error. Destructure from `ui` and use them directly.
- **Route menu position uses `placement`, not `order`.** `RouteConfig` has no `order` field — use `placement: { first: true } | { last: true } | { after: 'anchor' } | { before: 'anchor' }` (anchors resolve by fuzzy match). `registerRoute` is async — `.catch()` it.
- Don't use `sdk.registerExtension` (legacy, removed). Use `sdk.registerDynamicExtension` with a zone + route patterns.
- **Never read host data streams off the raw bus.** `eventBus.on('call-event' | 'subscriber:*' | …)` receives nothing — host streams are delivered only via `sdk.subscribeToCallEvents(...)` / `sdk.subscribeToStream(streamId, eventTypes, cb)` (capability-gated, attributed). See "Host events & data streams".
- **Declare `requiredScopes` on every route, extension and column — see "Declaring who a surface is for".** Omitting it means every signed-in user can reach the surface; the host no longer treats a hidden menu entry as a gate. Prefer a tier name (`'ADMINS'`) over a literal scope array, and write it inline so a typo is a compile error — a malformed declaration refuses the whole registration rather than being ignored.
- **Streams are capability-gated.** For any stream the app subscribes to, add its `<streamId>:listen` capability to the registration `permissions` (e.g. `call-events:listen`); a platform admin enables it per app. Without the grant, the subscription is silently dropped.
- **The event bus is per-app scoped.** Use `eventBus` only for the app's _own_ custom events (intra-app coordination — your page ↔ your extensions), namespaced with the appId prefix; the host confines them to your app and blocks cross-app/host-channel access. Don't subscribe to `theme:changed` / `locale:changed` directly — use `useTheme()` / `useLocale()`.
- Don't import from `@netsapiens/flow-sdk/client` or `/ui` — only the root entry exists.
- **Domain pages have two route shapes.** Admins above the domain get `/manage/:domain/<page>`; the domain's own Office/Site Manager gets `/home/domain/<page>`, with no `:domain` param (read `user.domain`). Register both patterns, or domain managers never see the extension.
- **`locale` is not a BCP 47 tag.** Flow sends forms like `enUS`; `localeCompare`/`Intl.*` throw `RangeError: Invalid language tag`. Map it to a valid tag (e.g. `fr*` → `'fr'`, else `'en'`) before any locale-sensitive call.
- **`form-section-*` zones only get what the host form passes.** The zone's `pageContext` is `{ formType, mode, entityId, formData }`, and `formData` is whatever that form hands to `FormPanel` — some host forms pass none (the Add/Edit site form gets `formData: undefined`). Zones cannot write the host form or see its submit. Log `pageContext` on the target form before designing around it.
- **Host pickers cache their lists.** Flow's autocomplete fields read cached lists (dial plans: `staleTime` 3 h). An object your app creates through the API is not offered in host forms until the page is reloaded — tell the user, or offer a reload.
- **`IconButton` is shorthand-only.** Pass the Iconify icon name via the `icon` prop (and optionally `iconSize`). Do NOT use the MUI children pattern — children are not supported and the button will render at 0×0. Correct: `<IconButton icon="mdi:account" iconSize={18} size="small" onClick={...} aria-label="..." />`. Wrong: `<IconButton><Icon icon="mdi:account" /></IconButton>`. The SDK type contract enforces this at compile time. Every other themed component (`Button`, `Stack`, `Paper`, etc.) follows standard MUI children patterns.
- **`Select` takes an `options` prop, not `MenuItem` children.** The host kit does not expose `MenuItem`. Use `<Select label="…" value={v} onChange={(e) => set(e.target.value)} options={[{ value, label }]} />`. Building it with `MenuItem` children yields an empty dropdown.
- **Contribute action-zone buttons with `actions`, not `component`.** Declaring
  `{ id, label, icon?, intent?, onClick }` lets the host render the button in the house
  style; rendering your own means restating that a secondary action is
  `variant="soft" color="neutral"`, and the raw MUI variants stay reachable, so it is easy
  to ship one that does not match the page. `onClick` gets `{ route, params, user,
pageContext }`, so page data is still available. Keep `component` for non-buttons.
- **`PageTemplate` `actions` is `PageAction[]`, not JSX.** The host renders the buttons itself, so pass an array of `{ label, icon?, variant?: 'primary' | 'secondary' | 'danger', onClick, disabled?, tooltip? }`. Passing a node throws `actions.map is not a function` and blanks the route. For arbitrary header JSX (status chips/badges) use the `headerStatus` prop instead.
- The remote `App` component should return `null` or hidden content. UI surfaces only through registered routes/extensions/columns.
