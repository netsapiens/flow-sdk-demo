/**
 * The app's menu entries, in the user's language.
 *
 * Flow draws a registered route's `label` in its menus, through its own `t()`.
 * That translates Flow's keys only, so an app's label stays as registered, in
 * every language. The SDK has no per-locale label yet, so the app swaps them
 * itself: `registerAppRoute` records each route as it registers, and
 * `relabelRoutes` re-registers them all with the new language's labels when
 * the locale changes. A route id is registered once on the host, so a relabel
 * is an unregister then a register, in the original order, so the menu keeps
 * its order.
 *
 * The French and Spanish are the demo's own translations: have a native
 * speaker review them before showing them to a customer in that language.
 */
import type { RemoteAppSDK } from '@netsapiens/flow-sdk';

import type { AppLanguage } from '../i18n/useAppText';
import { appLanguage } from '../i18n/useAppText';

type RouteConfig = Parameters<RemoteAppSDK['registerRoute']>[0];

/** Labels by route id; English is the label each route registers with. */
const LABELS: Record<Exclude<AppLanguage, 'en'>, Record<string, string>> = {
  fr: {
    'ucaas-demo-page': 'Démo du SDK Flow',
    'ucaas-live-operations': 'Opérations en direct',
    'ucaas-component-showcase': 'Vitrine des composants',
    'ucaas-crm-integration': 'Intégration CRM',
    'ucaas-domain-crm-sync': 'Synchronisation CRM',
    'ucaas-vendor-dashboard': 'CRM d’exemple',
    'ucaas-recording-qa-review': 'Revue qualité des enregistrements',
  },
  es: {
    'ucaas-demo-page': 'Demo del SDK de Flow',
    'ucaas-live-operations': 'Operaciones en vivo',
    'ucaas-component-showcase': 'Catálogo de componentes',
    'ucaas-crm-integration': 'Integración CRM',
    'ucaas-domain-crm-sync': 'Sincronización CRM',
    'ucaas-vendor-dashboard': 'CRM de ejemplo',
    'ucaas-recording-qa-review': 'Revisión de calidad de grabaciones',
  },
};

/** Every route this app registered, in registration order. */
const registered: RouteConfig[] = [];
let language: AppLanguage = 'en';

function labelled(config: RouteConfig): RouteConfig {
  const label = language === 'en' ? undefined : LABELS[language][config.id];
  return label ? { ...config, label } : config;
}

/** `sdk.registerRoute`, remembering the route so it can be relabelled. */
export function registerAppRoute(sdk: RemoteAppSDK, config: RouteConfig) {
  // Replace rather than append, so a re-run of the registering effect keeps
  // one entry per route.
  const at = registered.findIndex((r) => r.id === config.id);
  if (at >= 0) registered[at] = config;
  else registered.push(config);
  return sdk.registerRoute(labelled(config));
}

/** Re-register every route with `locale`'s labels; a no-op if unchanged. */
export function relabelRoutes(sdk: RemoteAppSDK, locale: string | undefined) {
  const next = appLanguage(locale);
  if (next === language) return;
  language = next;
  for (const config of registered) sdk.unregisterRoute(config.id);
  for (const config of registered) {
    sdk
      .registerRoute(labelled(config))
      .catch((error) =>
        console.error(`[Demo App] Failed to relabel ${config.id}:`, error),
      );
  }
}
