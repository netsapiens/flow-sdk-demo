/**
 * Shared demo directory — the few internal people who appear on more than one
 * surface in this demo (CRM caller enrichment in `mocks/crm.ts`, used by the
 * inbound-call widget and the CRM Integration page).
 *
 * Centralizing them here is the single source of truth for an extension/name
 * pairing, so the same person reads consistently everywhere instead of being
 * hand-duplicated per file. Demo fixtures only — not real data.
 */

export interface Person {
  /** Internal extension number. */
  extension: string;
  /** Display name. */
  name: string;
  /** Team / department, surfaced as the "company" in CRM enrichment. */
  department: string;
}

export const INTERNAL_PEOPLE: Person[] = [
  { extension: '2001', name: 'Alice Williams', department: 'Sales Team' },
  { extension: '2002', name: 'Bob Martinez', department: 'Support Team' },
  {
    extension: '2009',
    name: 'Reid Sellers',
    department: 'Reseller / Channel Partner',
  },
  { extension: '2364', name: 'Flow Agent', department: 'Engineering' },
  { extension: '3832', name: 'Andrew Lighterink', department: 'Product' },
  { extension: '5226', name: 'Chris Aaker', department: 'SVP of Engineering' },
  { extension: '6767', name: 'Tony Friar', department: 'Customer Support' },
];

/** Lookup by extension, e.g. `peopleByExtension['2001'].name`. */
export const peopleByExtension: Record<string, Person> = Object.fromEntries(
  INTERNAL_PEOPLE.map((p) => [p.extension, p]),
);
