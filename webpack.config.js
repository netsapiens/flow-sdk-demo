const HtmlWebpackPlugin = require('html-webpack-plugin');
const ModuleFederationPlugin = require('webpack/lib/container/ModuleFederationPlugin');
const { SubresourceIntegrityPlugin } = require('webpack-subresource-integrity');
const webpack = require('webpack');
const path = require('path');

// Single source of truth for the Module Federation container name. Used as the
// ModuleFederationPlugin `name` AND injected via DefinePlugin as `__MF_NAME__`,
// so App.tsx passes it to useRemoteApp without retyping the string.
//
// `MF_NAME` overrides it for a LOCAL run against a shared server, e.g.
//   MF_NAME=horizonExtensionDemoLocal npm run dev
// The app id is derived from this name (horizonExtensionDemoLocal →
// horizon-extension-demo-local), so a local build can be registered as its own
// app beside the published showcase instead of replacing it for everyone. The
// name must match the registration's webpack_module exactly, or the host finds
// no container and loads nothing.
const MODULE_FEDERATION_NAME = process.env.MF_NAME || 'horizonExtensionDemo';
if (!/^[A-Za-z_$][\w$]*$/.test(MODULE_FEDERATION_NAME)) {
  throw new Error(
    `MF_NAME must be a JavaScript identifier, got "${MODULE_FEDERATION_NAME}"`,
  );
}

module.exports = (_env, argv) => {
  const isProduction = argv.mode === 'production';

  return {
    mode: argv.mode || 'development',
    entry: './src/App.tsx',
    // Bundle verification (SDK 0.2.x) rejects a bundle with no source maps, and the
    // maps must carry `sourcesContent` — so never `noSources`, and dist/*.map ships.
    devtool: 'source-map',
    output: {
      path: path.resolve(__dirname, 'dist'),
      publicPath: isProduction ? 'auto' : 'http://localhost:5005/',
      filename: isProduction ? '[name].[contenthash].js' : '[name].js',
      chunkFilename: isProduction ? '[id].[contenthash].js' : '[id].js',
      // Required for Subresource Integrity: the browser cannot verify an integrity
      // value against an opaque cross-origin response. Without this, the integrity
      // values below are emitted but never actually checked.
      crossOriginLoading: 'anonymous',
      clean: true,
    },
    // ⚠️ PRODUCTION REACT RUNTIME IN EVERY BUILD, dev included.
    //
    // React is a shared singleton, and the host supplies its PRODUCTION build.
    // A dev build would otherwise bundle react/jsx-runtime's development variant,
    // which calls dev-only internals on React (`dispatcher.getOwner`) that the
    // host's React does not have — App throws on first render, registers
    // nothing, and the host reports "loaded but registered nothing" with every
    // route a 404. nodeEnv picks the production variant of every dependency.
    optimization: {
      nodeEnv: 'production',
    },
    resolve: {
      extensions: ['.tsx', '.ts', '.js', '.jsx'],
    },
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
                // Production JSX even in a dev build — see `optimization.nodeEnv`.
                [
                  '@babel/preset-react',
                  { runtime: 'automatic', development: false },
                ],
                '@babel/preset-typescript',
              ],
            },
          },
        },
      ],
    },
    plugins: [
      new ModuleFederationPlugin({
        name: MODULE_FEDERATION_NAME,
        filename: 'remoteEntry.js',
        exposes: {
          './App': './src/App',
          './pages/DemoPage': './src/pages/DemoPage',
        },
        shared: {
          react: { singleton: true, requiredVersion: '^19.2.0', eager: false },
          'react-dom': {
            singleton: true,
            requiredVersion: '^19.2.0',
            eager: false,
          },
          loglevel: {
            singleton: true,
            requiredVersion: '^1.9.2',
            eager: false,
          },
          // '@netsapiens/flow-sdk' is intentionally NOT listed here. The host does
          // not register the SDK as a shared module, so declaring it shared cannot
          // resolve to a host copy — and bundle verification rejects a bundle that
          // declares it. Bundle it normally.
          //
          // MUI is intentionally NOT listed here. The host does not register
          // @mui/material or @emotion/*, and declaring a singleton the host does not
          // provide fails at load. Consume MUI via horizonContext.ui instead, which
          // also carries the host theme and dark mode.
          //
          // i18next is absent for a different reason, and the distinction matters: the
          // host DOES register i18next and react-i18next. Localization is owned by the
          // host and the SDK — the host holds the initialised instance with every
          // translation loaded and hands the app a t() through the context — so a
          // partner has no reason to reach for i18next at all. Use useLocale() /
          // context.t(). (An earlier version of this comment claimed declaring i18next
          // shared crashes with "Unsatisfied version". That was wrong.)
          //
          // 'react-dom/client' is NOT declared here because this demo never calls
          // createRoot — a Horizon remote is mounted by the host, inside the host's
          // React tree. An app whose graph DOES reach it (most often via
          // @ant-design/v5-patch-for-react-19) must declare it, and must do so without
          // a fallback:
          //
          //   'react-dom/client': { singleton: true, requiredVersion: '^19.0.0', import: false },
          //
          // Sharing 'react-dom' does not cover it: react-dom/client is a separate build
          // carrying its own reconciler and its own baked-in React version, so an
          // undeclared bundle keeps that copy, resolves `react` to the host's, and dies
          // with React #527. `import: false` is required rather than optional — keeping
          // the fallback emits a chunk that leaves the integrity plugin with an
          // unresolvable placeholder. See MIGRATION §2.2 step 4.
        },
      }),
      new webpack.DefinePlugin({
        // Inject the MF container name so App.tsx can reference it without
        // retyping the string — defined once above as MODULE_FEDERATION_NAME.
        __MF_NAME__: JSON.stringify(MODULE_FEDERATION_NAME),
      }),
      new HtmlWebpackPlugin({
        template: './index.html',
      }),
      // Emits sha384 integrity values for every chunk the entry loads. The platform
      // pins a hash of remoteEntry.js itself; without these, nothing that entry
      // pulls in afterwards is covered. Production only — the plugin warns under
      // `mode: development` and provides nothing useful for the dev server.
      ...(isProduction
        ? [new SubresourceIntegrityPlugin({ hashFuncNames: ['sha384'] })]
        : []),
    ],
    devServer: {
      port: 5005,
      // A hosted Flow server loads this dev build cross-site, as a plain
      // (no-cors) script — the host adds no `crossorigin` to an unpinned dev
      // remote. webpack-dev-server ≥5.2 answers that (Sec-Fetch-Site: cross-site
      // + Sec-Fetch-Mode: no-cors) with 403 "Cross-Origin request blocked" unless
      // the Host is explicitly allowed; the CORS header below does not help, the
      // guard runs first. List the loopback names only (not 'all'), so the
      // DNS-rebinding Host check still holds for every other name. 127.0.0.1 is
      // listed because this guard does not exempt IP addresses the way the
      // ordinary Host check does: a build registered at 127.0.0.1 would get 403.
      allowedHosts: ['localhost', '127.0.0.1'],
      // No live-reload client in the bundle. It would run inside the HOST page
      // and keep opening ws://localhost:5005/ws from there — noise in the host's
      // console that looks like the app opening its own sockets (it never does;
      // sdk.streams rides the host's socket). Pointing it at localhost
      // (`client.webSocketURL`) does not help: the Host/Origin check refuses the
      // portal's origin. Reload the host page to pick up a rebuild instead.
      hot: false,
      liveReload: false,
      client: false,
      webSocketServer: false,
      headers: {
        'Access-Control-Allow-Origin': '*',
        // Chrome's Private Network Access: an HTTPS server's page (the host)
        // loading a script from localhost is preflighted, and refused unless
        // the preflight allows the private network. The host then reports only
        // "Script load error". Newer Chrome also asks the user once, with a
        // "look for and connect to devices on your local network" prompt.
        'Access-Control-Allow-Private-Network': 'true',
      },
    },
  };
};
