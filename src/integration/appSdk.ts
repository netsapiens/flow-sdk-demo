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
import type { FlowApiClient, RemoteAppSDK } from '@netsapiens/flow-sdk';

export const appSdk: { current: RemoteAppSDK | null } = { current: null };

/**
 * The host's authenticated API proxy (`flowContext.api`), for the same reason:
 * side panels render outside FlowContextProvider and their context carries no
 * API client. `App.tsx` sets it alongside `appSdk`.
 */
export const appApi: { current: FlowApiClient | null } = { current: null };

/**
 * The signed-in user's extension, from `useRemoteApp`. A side panel's context
 * names the user by domain and login only, and a personal contact is filed
 * under the extension.
 */
export const appUserExtension: { current: string | undefined } = {
  current: undefined,
};
