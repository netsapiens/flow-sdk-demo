/**
 * Replay guard for the remote-auth webhook.
 *
 * The HMAC window tolerates clock skew, so inside it a captured webhook
 * verifies again. The guard keys on the SIGNED `request_id` from the body,
 * never on the `X-NS-Request-ID` header: the HMAC covers the timestamp and the
 * raw body only, so a replay with a fresh header value would walk straight
 * past a header-keyed guard.
 *
 * In-memory and per process: a restart forgets every id, and a backend with
 * several instances must keep this in a shared store (a Redis SET with a TTL,
 * or a unique-indexed table), or each instance has its own view of what it
 * has seen.
 */
export const REPLAY_WINDOW_MS = 10 * 60 * 1000;

/**
 * @param {object} [opts]
 * @param {number} [opts.windowMs] how long an id stays claimed
 * @param {() => number} [opts.now] clock, injectable for tests
 */
export function createReplayGuard({
  windowMs = REPLAY_WINDOW_MS,
  now = Date.now,
} = {}) {
  const seen = new Map();
  const prune = (at) => {
    for (const [id, claimedAt] of seen)
      if (at - claimedAt > windowMs) seen.delete(id);
  };
  return {
    /**
     * Claim `id` for the request in flight. False when it was claimed inside
     * the window, so the webhook is a replay. The claim is held while the
     * handshake runs, which refuses a concurrent duplicate too; `release` it
     * when the handshake fails before anything was minted, so the platform's
     * retry of the same webhook (same id) can still succeed.
     */
    claim(id) {
      const at = now();
      prune(at);
      if (seen.has(id)) return false;
      seen.set(id, at);
      return true;
    },
    /** Give an id back after a failed handshake. */
    release(id) {
      seen.delete(id);
    },
    get size() {
      return seen.size;
    },
  };
}
