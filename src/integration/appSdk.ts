/**
 * The app's SDK handle, for code that runs outside a component.
 *
 * A declared action's `onClick` receives page state (`route`, `params`,
 * `pageContext`) but no SDK handle, by design: it is a description of a button,
 * not a component. An action that needs a host capability, such as opening the
 * side panel, reads it from here. `App.tsx` sets it once `useRemoteApp` returns.
 *
 * A module-level value inside your own bundle is the supported way to share
 * things between your own pieces, the same as the `onCallChanges()` emitter.
 */
import type { RemoteAppSDK } from '@netsapiens/flow-sdk';

export const appSdk: { current: RemoteAppSDK | null } = { current: null };
