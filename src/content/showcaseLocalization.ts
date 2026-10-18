/**
 * The host translation keys the Component Showcase resolves live in its
 * "Typography & localization" section. Pure data, kept out of the section so the
 * section is just layout.
 *
 * Every key here exists in the host's `common` namespace in en-US, es-MX and
 * fr-CA (checked against the host's `src/locales/langs/*.json`). That check is
 * not optional: the host runs i18next with `returnNull: false`, so a key that
 * does not exist comes back as the key itself — `t('FOUNDATIONS')` renders
 * "FOUNDATIONS", not `undefined`, and the `?? 'Fallback'` beside it never fires.
 * `??` only covers a host too old to hand over `t` at all. A wrong key is a
 * visible bug, so look a key up before you use it.
 */

/**
 * Anchor id on the localization block, so the intro card at the top of the
 * page can link straight to it.
 */
export const LOCALIZATION_ANCHOR = 'showcase-localization';

export interface ShowcaseKey {
  key: string;
  /** Interpolation values, for the keys whose string has `{{placeholders}}`. */
  options?: Record<string, unknown>;
}

/**
 * Chosen to make a point each: the everyday verbs any app needs and would
 * otherwise re-translate; the datagrid's own toolbar and footer vocabulary,
 * which an app's custom toolbar should match word for word; and
 * `PAGINATION_RANGE`, which takes interpolation values — the part people assume
 * they have to hand-roll.
 */
export const SHOWCASE_KEYS: ShowcaseKey[] = [
  { key: 'SAVE' },
  { key: 'CANCEL' },
  { key: 'DELETE' },
  { key: 'EXPORT' },
  { key: 'FILTER' },
  { key: 'COLUMNS' },
  { key: 'SEARCH_PLACEHOLDER' },
  { key: 'ENABLED' },
  { key: 'ROLE_ADMIN' },
  { key: 'PAGINATION_ROWS_PER_PAGE' },
  {
    key: 'PAGINATION_RANGE',
    options: { from: 1, to: 25, count: 148 },
  },
];
