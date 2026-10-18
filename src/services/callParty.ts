/**
 * The far end of a Call Logs row — who an app should look up in its own system.
 *
 * Kept out of the panel module so the panel file exports only components (fast
 * refresh), and so the row action that resolves the party at click time and
 * the panel that renders it agree on one shape.
 */

/** The call's other party: who the CRM is asked about. */
export interface CallParty {
  /** Raw number/URI as the row carries it; '' when the row has none. */
  number: string;
  /** Caller-ID / directory name from the row, if any. */
  name: string;
  /** How the call ran, for the subtitle line. */
  direction: 'Inbound' | 'Outbound' | 'Missed' | 'Call';
}

function str(row: Record<string, unknown>, ...keys: string[]): string {
  for (const k of keys) {
    const v = row[k];
    if (v !== undefined && v !== null && v !== '') return String(v);
  }
  return '';
}

/**
 * Pick the external party out of a Call Logs row. `call-direction` decides
 * which end is "them": on an outbound call (0) it is the number dialled
 * (`call-orig-to-user`, else the terminating user); on inbound (1), missed (2)
 * and anything else it is the originator (`call-orig-from-user`, else the
 * `call-orig-from-uri` SIP URI the grid shows in its From column).
 */
export function externalParty(row: Record<string, unknown>): CallParty {
  const dir = Number(row['call-direction']);
  if (dir === 0) {
    return {
      number: str(
        row,
        'call-orig-to-user',
        'call-term-user',
        'call-term-to-uri',
      ),
      name: str(row, 'call-term-to-name'),
      direction: 'Outbound',
    };
  }
  return {
    number: str(
      row,
      'call-orig-from-user',
      'call-orig-from-uri',
      'call-orig-user',
    ),
    name: str(row, 'call-orig-from-name'),
    direction: dir === 1 ? 'Inbound' : dir === 2 ? 'Missed' : 'Call',
  };
}
