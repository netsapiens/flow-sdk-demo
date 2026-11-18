/**
 * Step 2 of the vendor's responsibilities: exchange the single-use code at the
 * cluster's token endpoint, using the PKCE `code_verifier` that the webhook
 * delivered (only the vendor ever sees it).
 *
 * The NetSapiens token endpoint detects the PKCE flow from the presence of
 * `code_verifier`, checks `SHA-256(code_verifier) == code_challenge` stored on
 * the code, validates `username` against the identity the code was minted for,
 * and returns a NetSapiens access token BOUND TO THE USER. That token is the
 * proof of identity the vendor needs before minting its own token. No
 * client_id / client_secret are presented. (That check happens on the
 * platform; this code only presents the verifier.)
 */

/** How long the token endpoint gets before the exchange is abandoned. */
export const EXCHANGE_TIMEOUT_MS = 10_000;

/** Hosts an `http://` pin is accepted for, and only outside production. */
const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]']);

/**
 * Parse one side of the pin comparison. ns-api advertises the token path as
 * /oauth/token in the webhook, but the live route is /oauth2/token (the
 * /oauth/token form 404s), so either spelling maps to the live one, and a
 * trailing slash is dropped.
 */
function normalise(raw, label) {
  let url;
  try {
    url = new URL(raw);
  } catch {
    throw new Error(`${label} is not an absolute URL`);
  }
  url.pathname =
    url.pathname
      .replace(/\/oauth\/token\/?$/, '/oauth2/token')
      .replace(/\/+$/, '') || '/';
  return url;
}

/**
 * Where the code is posted: the pinned endpoint from YOUR configuration, once
 * the (signed) webhook's `validation_endpoint` has confirmed it. The advertised
 * value is derived from the cluster's configured origin, but only your
 * configuration knows where this cluster lives, so the pin is required and the
 * advertised value only confirms it. Compared as origin + path, after the
 * /oauth/token rewrite: scheme, host and port must match exactly; a query
 * string or trailing slash on the advertised side is ignored.
 *
 * @param {string|undefined} pinned      FLOW_TOKEN_ENDPOINT
 * @param {string|undefined} advertised  the webhook's validation_endpoint
 * @param {object} [opts]
 * @param {boolean} [opts.allowInsecureLoopback]  accept http://localhost (a
 *                                      local mock cluster); never in production
 * @returns {string} the URL to post the code to
 */
export function resolveTokenEndpoint(
  pinned,
  advertised,
  { allowInsecureLoopback = false } = {},
) {
  if (!advertised) {
    throw new Error('webhook is missing validation_endpoint');
  }
  if (!pinned) {
    throw new Error(
      'FLOW_TOKEN_ENDPOINT is not set; refusing to post the code to the advertised validation_endpoint. ' +
        `Set it to this cluster's token endpoint (the webhook advertises ${advertised}).`,
    );
  }
  const pin = normalise(pinned, 'FLOW_TOKEN_ENDPOINT');
  if (pin.search || pin.hash || pin.username || pin.password) {
    throw new Error(
      'FLOW_TOKEN_ENDPOINT must be scheme, host and path only (no query, fragment or credentials)',
    );
  }
  if (pin.protocol !== 'https:') {
    const loopback =
      pin.protocol === 'http:' && LOOPBACK_HOSTS.has(pin.hostname);
    if (!loopback || !allowInsecureLoopback) {
      throw new Error(
        'FLOW_TOKEN_ENDPOINT must be an https:// URL (http://localhost is accepted only when NODE_ENV is not "production")',
      );
    }
  }

  const adv = normalise(advertised, 'validation_endpoint');
  if (pin.origin !== adv.origin || pin.pathname !== adv.pathname) {
    throw new Error(
      `webhook advertises ${adv.origin}${adv.pathname} but FLOW_TOKEN_ENDPOINT pins ${pin.origin}${pin.pathname}; refusing to post the code`,
    );
  }
  return `${pin.origin}${pin.pathname}`;
}

/**
 * @param {object} body           parsed webhook body (needs code, code_verifier,
 *                                 validation_endpoint, user.uid)
 * @param {object} [opts]
 * @param {string} [opts.redirectUri]  this server's registered callback URL;
 *                                 many token endpoints require it to match.
 * @param {typeof fetch} [opts.fetchImpl]  injectable for tests
 * @returns {Promise<object>} the NetSapiens token response (proves the user)
 */
export async function exchangeCodeForNsToken(
  body,
  { redirectUri, fetchImpl = fetch } = {},
) {
  const { code, code_verifier, validation_endpoint, user } = body;

  const tokenEndpoint = resolveTokenEndpoint(
    process.env.FLOW_TOKEN_ENDPOINT,
    validation_endpoint,
    { allowInsecureLoopback: process.env.NODE_ENV !== 'production' },
  );

  const form = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    code_verifier,
    username: user.uid,
  });
  if (redirectUri) form.set('redirect_uri', redirectUri);

  // The code and verifier go to the pinned endpoint and nowhere else: a
  // redirect from it is an error, not somewhere new to post them. A hung
  // endpoint is abandoned rather than holding the webhook open past the
  // platform's own timeout.
  const res = await fetchImpl(tokenEndpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: form,
    redirect: 'error',
    signal: AbortSignal.timeout(EXCHANGE_TIMEOUT_MS),
  });

  if (!res.ok) {
    // Status only. The upstream body stays out of the error, and so out of
    // this server's log: a token endpoint that echoes its request would put
    // the code and verifier there.
    throw new Error(`code exchange failed: ${res.status}`);
  }
  return res.json(); // e.g. { access_token, token_type, expires_in, uid, domain, ... }
}
