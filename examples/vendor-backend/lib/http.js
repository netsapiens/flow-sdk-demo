/**
 * Small HTTP hygiene helpers for server.js, kept here so they can be tested.
 */

/** Longest value a log line carries from a request. */
export const LOG_VALUE_MAX = 128;

/**
 * A request-supplied value, safe to put on one log line: coerced to a string,
 * control characters stripped (no forged line breaks or terminal escapes),
 * and capped so a flood of header bytes cannot flood the log.
 *
 * @param {unknown} value
 * @param {number} [max]
 * @returns {string}
 */
export function sanitizeLogValue(value, max = LOG_VALUE_MAX) {
  if (value === undefined || value === null) return '';
  const text = typeof value === 'string' ? value : String(value);
  const printable = text.replace(/[\u0000-\u001f\u007f-\u009f]/g, '');
  return printable.length > max ? `${printable.slice(0, max)}…` : printable;
}

/**
 * Express error middleware: status only, never the message or a stack. The
 * default handler answers a body-parser failure (malformed or oversized JSON)
 * with an HTML stack trace unless NODE_ENV=production; an unauthenticated
 * caller gets neither. The detail stays in the server log.
 *
 * @param {{ log?: Function, error?: Function }} [logger]
 */
export function createErrorMiddleware(logger = console) {
  // Four parameters: that is how Express recognises an error handler.
  return function errorMiddleware(err, _req, res, _next) {
    const status =
      Number.isInteger(err?.status) && err.status >= 400 && err.status < 600
        ? err.status
        : 500;
    logger.error(`request failed: ${status}`, sanitizeLogValue(err?.type));
    if (res.headersSent) return;
    res.status(status).json({ error: 'request_failed' });
  };
}

/**
 * Fixed-window rate limiter keyed by client address: at most `limit` requests
 * per `windowMs` per `req.ip`, 429 `{ error: 'rate_limited' }` beyond that,
 * with `RateLimit-Limit`, `RateLimit-Remaining` and `Retry-After` headers.
 * In memory and per process, which is right for this reference; a backend
 * with more than one instance wants a shared store instead.
 */
export function createRateLimiter({
  windowMs = 60_000,
  limit = 60,
  now = Date.now,
} = {}) {
  const windows = new Map();
  return function rateLimiter(req, res, next) {
    const key = req.ip || 'unknown';
    const t = now();
    let entry = windows.get(key);
    if (!entry || entry.resetAt <= t) {
      entry = { count: 0, resetAt: t + windowMs };
      windows.set(key, entry);
      // Drop windows that have expired so the map does not grow with every
      // address that ever called.
      if (windows.size > 10_000) {
        for (const [k, v] of windows) if (v.resetAt <= t) windows.delete(k);
      }
    }
    entry.count += 1;
    const remaining = Math.max(0, limit - entry.count);
    res.set('RateLimit-Limit', String(limit));
    res.set('RateLimit-Remaining', String(remaining));
    if (entry.count > limit) {
      res.set('Retry-After', String(Math.ceil((entry.resetAt - t) / 1000)));
      res.status(429).json({ error: 'rate_limited' });
      return;
    }
    next();
  };
}
