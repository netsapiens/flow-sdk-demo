/**
 * The app's own strings, in the user's language.
 *
 * Two sources of text, and they must not be confused:
 *
 *   - Flow's own words (Save, Cancel, Apps, Templates…) come from `t(key)`
 *     (`useLocale()`). It translates only keys the platform ships, and returns
 *     the key itself for one it does not know — so it is no use for copy the
 *     app wrote.
 *   - Everything the app wrote comes from dictionaries the app ships, chosen
 *     by `locale`. That is this hook. The SDK has no API for registering an
 *     app's translations with the host, by design: the app owns its copy.
 *
 * `locale` can arrive as `fr-CA` or `frCA`, so pick by the first two letters,
 * and fall back to English for any language the app has no dictionary for.
 * It is reactive: switch language with the flag in the top bar and every
 * caller re-renders with the new dictionary, no reload.
 */
import { useLocale } from '@netsapiens/flow-sdk';

export type AppLanguage = 'en' | 'fr' | 'es';

/** `fr-CA`, `frCA`, `fr` → `fr`; anything without a dictionary → `en`. */
export function appLanguage(locale: string | undefined): AppLanguage {
  const lang = (locale ?? 'en').slice(0, 2).toLowerCase();
  return lang === 'fr' || lang === 'es' ? lang : 'en';
}

/** The dictionary for the current language, from a set keyed by language. */
export function useAppText<T>(dictionaries: Record<AppLanguage, T>): T {
  const { locale } = useLocale();
  return dictionaries[appLanguage(locale)];
}
