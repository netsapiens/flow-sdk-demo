/**
 * Boot-time checks on the two secrets this server holds. Both are refused when
 * unset, short, or obviously a placeholder, so `cp .env.example .env` without
 * filling the values in does not start a server that signs forgeable vendor
 * tokens or verifies webhooks against a public value.
 */

/** Fewer characters than this is not a secret. 32 hex chars is 128 bits. */
export const MIN_SECRET_LENGTH = 32;

/**
 * A value containing one of these (case-insensitive) is a placeholder, whatever
 * its length: the words any example file, README or scaffold reaches for.
 */
export const WEAK_SECRET_WORDS = [
  'example',
  'changeme',
  'placeholder',
  'insecure',
];

/**
 * @param {string} name   the variable, for the message
 * @param {unknown} value its value
 * @returns {{ ok: true } | { ok: false, reason: string }} never echoes the value
 */
export function checkSecret(name, value) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    return { ok: false, reason: `${name} is unset` };
  }
  if (value.trim().length < MIN_SECRET_LENGTH) {
    return {
      ok: false,
      reason: `${name} is shorter than ${MIN_SECRET_LENGTH} characters`,
    };
  }
  const lower = value.toLowerCase();
  const weak = WEAK_SECRET_WORDS.find((word) => lower.includes(word));
  if (weak) {
    return {
      ok: false,
      reason: `${name} looks like a placeholder (contains "${weak}")`,
    };
  }
  return { ok: true };
}

/**
 * Every problem with the secrets the server needs, in one pass, so the
 * operator sees all of them at once. Empty means boot.
 *
 * @param {{ VENDOR_JWT_SECRET?: unknown, FLOW_CALLBACK_SECRET?: unknown }} env
 * @returns {string[]} reasons, none of which contain a secret value
 */
export function secretProblems(env) {
  return ['VENDOR_JWT_SECRET', 'FLOW_CALLBACK_SECRET']
    .map((name) => checkSecret(name, env[name]))
    .filter((result) => !result.ok)
    .map((result) => result.reason);
}
