/**
 * Turns the declarative `zones.manifest.json` into registration-ready
 * descriptors, so `App.tsx` registers extensions by iterating the manifest
 * (the same manifest the Playwright suite asserts against) instead of
 * hand-writing each call. Adding/removing a zone extension is a manifest edit
 * plus a component entry in COMPONENTS below.
 */
import type {
  ExtensionAction,
  ExtensionComponentProps,
  ScopeRequirement,
} from '@netsapiens/flow-sdk';
import type { ComponentType } from 'react';

import type { ZoneMarkerProps } from './withZoneTestId';
import { ActiveCallsRecordingFilter } from '../extensions/ActiveCallsRecordingFilter';
import { AnalyticsWidget } from '../extensions/AnalyticsWidget';
import { CallerInfoWidget } from '../extensions/CallerInfoWidget';
import ComplianceCheckbox from '../extensions/ComplianceCheckbox';
import ContactFormBanner from '../extensions/ContactFormBanner';
import { exportActions } from '../extensions/ExportButton';
import FormDataInspector from '../extensions/FormDataInspector';
import { HeaderStatusBadge } from '../extensions/HeaderStatusBadge';
import { QuickActionButton } from '../extensions/QuickActionButton';
import { TableToolbarInfo } from '../extensions/TableToolbarInfo';
import { TopbarHelpButton } from '../extensions/TopbarHelpButton';
import { withZoneTestId } from './withZoneTestId';
import manifestJson from './zones.manifest.json';

interface ExtensionManifestEntry {
  id: string;
  zone: string;
  routes: string[];
  testId: string;
  priority?: number;
  requiredPermissions?: string[];
}
interface RouteManifestEntry {
  id: string;
  parentPath: string;
  path: string;
  fullPath: string;
  /**
   * Documentation only — the enforcing declaration is an inline literal at the
   * `registerRoute` call site in App.tsx. Recorded here so the Playwright suite
   * knows which signed-in scope can reach the page. See the manifest's
   * `$comment_requiredScopes` for why it is duplicated rather than read from here.
   */
  requiredScopes?: ScopeRequirement;
  testId: string;
}
interface ColumnManifestEntry {
  id: string;
  zone: string;
  field: string;
  routes: string[];
  /** Documentation only, as on RouteManifestEntry. */
  requiredScopes?: ScopeRequirement;
  testId: string;
}
interface WidgetManifestEntry {
  /** Manifest id, `demo-` prefixed like every other entry here. */
  id: string;
  /**
   * The plain name passed to `sdk.registerWidget` — no app prefix. The host
   * stamps its own from this app's binding on the bus.
   */
  widgetId: string;
  /** What the host stores it as, and what lands in a user's saved layout. */
  storedId: string;
  kind: 'panel' | 'leaf';
  /** Documentation only — the enforcing array is an inline literal in App.tsx. */
  zones: string[];
  /** Leaves only: the container category this belongs in. */
  leafOf?: string;
  /**
   * Container panels only: the leaf category this panel accepts. Its body is
   * then drawn by the host's LeafContainer rather than by the registered
   * component. Namespaced per app — see the manifest entry's `$comment`.
   */
  acceptsLeaves?: string;
  category?: string;
  /** Defaults to 'host'. Only one widget here declares 'self'. */
  chrome?: 'host' | 'self';
  /** Panels only — a leaf's width belongs to its container. */
  size?: 'half' | 'full';
  /** Panels only: reserved height in grid row units, which also sizes the skeleton. */
  height?: number;
  /** Panels only. */
  resizable?: boolean;
  placement?: { after: string } | { before: string } | 'end';
  refreshPolicy?: 'shared-range' | 'own-cadence' | 'realtime';
  /** Gates on what the APP was granted. Documentation only, as below. */
  requiredPermissions?: string[];
  /** Documentation only, as on RouteManifestEntry. */
  requiredScopes?: ScopeRequirement;
  testId: string;
}
interface ZonesManifest {
  appId: string;
  webpackModule: string;
  remoteEntryUrl: string;
  extensions: ExtensionManifestEntry[];
  routes: RouteManifestEntry[];
  columns: ColumnManifestEntry[];
  widgets: WidgetManifestEntry[];
}

export const manifest = manifestJson as unknown as ZonesManifest;

// Manifest id -> declared actions the host renders itself. Preferred for action
// zones: the app supplies intent and behaviour, the host owns the styling, so a
// contributed button cannot drift from the page it sits on.
const ACTIONS: Record<string, ExtensionAction[]> = {
  'demo-export-button': exportActions,
};

// Manifest id -> the component that renders in that zone. For anything that is
// not a button: badges, banners, widgets, filter controls.
const COMPONENTS: Record<
  string,
  ComponentType<ExtensionComponentProps & ZoneMarkerProps>
> = {
  'demo-analytics-widget': AnalyticsWidget,
  'demo-quick-action': QuickActionButton,
  'demo-caller-info-widget': CallerInfoWidget,
  'demo-contact-form-banner': ContactFormBanner,
  'demo-compliance-checkbox': ComplianceCheckbox,
  'demo-form-data-inspector': FormDataInspector,
  'demo-active-calls-recording-filter': ActiveCallsRecordingFilter,
  'demo-header-status-badge': HeaderStatusBadge,
  'demo-table-toolbar-info': TableToolbarInfo,
  'demo-topbar-help': TopbarHelpButton,
};

export interface ExtensionRegistration {
  id: string;
  zone: string;
  routes: Array<{ pattern: string }>;
  /** Exactly one of these is set — see ACTIONS/COMPONENTS above. */
  component?: ComponentType<ExtensionComponentProps>;
  actions?: ExtensionAction[];
  priority?: number;
  requiredPermissions?: string[];
}

/** Registration-ready descriptors, each component wrapped with its zone testId. */
export const extensionRegistrations: ExtensionRegistration[] =
  manifest.extensions.map((e) => {
    const actions = ACTIONS[e.id];
    const Component = COMPONENTS[e.id];
    if (!actions && !Component) {
      throw new Error(
        `zones.manifest.json: no actions or component mapped for "${e.id}"`,
      );
    }
    return {
      id: e.id,
      zone: e.zone,
      routes: e.routes.map((pattern) => ({ pattern })),
      // Declared actions carry their own test id, so they skip the wrapper the
      // component path needs.
      ...(actions
        ? { actions }
        : { component: withZoneTestId(Component!, e.testId, e.zone) }),
      ...(e.priority !== undefined ? { priority: e.priority } : {}),
      ...(e.requiredPermissions
        ? { requiredPermissions: e.requiredPermissions }
        : {}),
    };
  });

/** testId for a full-page route, by manifest id (used to tag the page root). */
export function routeTestId(id: string): string {
  const testId = manifest.routes.find((r) => r.id === id)?.testId;
  if (!testId)
    throw new Error(`zones.manifest.json: no route testId for "${id}"`);
  return testId;
}

/** testId for a dynamic column, by manifest id (used to tag each cell). */
export function columnTestId(id: string): string {
  const testId = manifest.columns.find((c) => c.id === id)?.testId;
  if (!testId)
    throw new Error(`zones.manifest.json: no column testId for "${id}"`);
  return testId;
}

/**
 * testId for a dashboard widget, by manifest id (used to tag the widget's own
 * content root — the host frame around it carries its own testid keyed on the
 * stored, app-prefixed widget id).
 */
export function widgetTestId(id: string): string {
  const testId = manifest.widgets.find((w) => w.id === id)?.testId;
  if (!testId)
    throw new Error(`zones.manifest.json: no widget testId for "${id}"`);
  return testId;
}
