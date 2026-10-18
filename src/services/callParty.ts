/**
 * The far end of a Call Logs row — who an app should look up in its own system.
 *
 * Kept out of the panel module so the panel file exports only components (fast
 * refresh), and so the row action that resolves the party at click time and
 * the panel that renders it agree on one shape.
 */

/** The call's other party: who the CRM is asked about. */
export interface CallParty {
  /** The number, a SIP URI reduced to its user part; '' when the row has none. */
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
 * A SIP URI (`sip:10618534922@sas.example;user=phone`) to its user part, which
 * is the number a person would read and the CRM is keyed by. Anything that is
 * not a SIP URI passes through unchanged.
 */
function userOf(value: string): string {
  const match = /^sips?:([^@;]+)/i.exec(value.trim());
  return match ? match[1] : value;
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
      number: userOf(
        str(row, 'call-orig-to-user', 'call-term-user', 'call-term-to-uri'),
      ),
      name: str(row, 'call-term-to-name'),
      direction: 'Outbound',
    };
  }
  return {
    number: userOf(
      str(row, 'call-orig-from-user', 'call-orig-from-uri', 'call-orig-user'),
    ),
    name: str(row, 'call-orig-from-name'),
    direction: dir === 1 ? 'Inbound' : dir === 2 ? 'Missed' : 'Call',
  };
}
