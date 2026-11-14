/**
 * The webhook handler: verify, exchange, mint. Factored out of server.js so it
 * can be exercised with a fake request and response, with no port listening,
 * and so the collaborators (exchange, cluster-JWT check, minting) can be
 * swapped in a test.
 */
import { exchangeCodeForNsToken } from './exchange.js';
import { sanitizeLogValue } from './http.js';
import { createReplayGuard } from './replay.js';
import { mintVendorToken } from './token.js';
import { verifyClusterToken, verifyHmacSignature } from './verify.js';

/**
 * @param {object} opts
 * @param {string} opts.callbackSecret   the app's registered callback secret
 * @param {string} opts.vendorJwtSecret  signs the vendor token
 * @param {number} opts.ttlSeconds       vendor token lifetime
 * @param {string} opts.appId            expected `appId` in the cluster JWT
 * @param {string} opts.jwksUri          INSight JWKS
 * @param {string} opts.issuer           INSight issuer
 * @param {boolean} [opts.mock]          MOCK_MODE: skip the live exchange
 * @param {string} [opts.redirectUri]    sent as `redirect_uri` in the exchange
 * @param {object} [opts.replayGuard]    see lib/replay.js
 * @param {Function} [opts.exchange]     lib/exchange.js by default
 * @param {Function} [opts.verifyCluster] lib/verify.js by default
 * @param {Function} [opts.mint]         lib/token.js by default
 * @param {{ log: Function }} [opts.logger]
 * @returns {(req: object, res: object) => Promise<object>} an Express handler
 */
export function createCallbackHandler({
  callbackSecret,
  vendorJwtSecret,
  ttlSeconds,
  appId,
  jwksUri,
  issuer,
  mock = false,
  redirectUri,
  replayGuard = createReplayGuard(),
  exchange = exchangeCodeForNsToken,
  verifyCluster = verifyClusterToken,
  mint = mintVendorToken,
  logger = console,
}) {
  return async function handleCallback(req, res) {
    // `req.body` is the RAW bytes (express.raw in server.js), not a parsed
    // object: signature v2 is an HMAC over the exact bytes received, and
    // nothing is parsed until they verify. Anything from the request that
    // reaches a log line goes through sanitizeLogValue first.
    const rawBody = Buffer.isBuffer(req.body) ? req.body : undefined;
    let requestId;
    // The request id is a value, never part of the format string: a
    // request-supplied `%s` must not be interpreted by the logger.
    const log = (msg, extra) =>
      logger.log(
        '[%s] %s',
        sanitizeLogValue(requestId) || 'no-request-id',
        msg,
        typeof extra === 'string' ? sanitizeLogValue(extra) : (extra ?? ''),
      );
    let claimed = false;

    try {
      // --- 1. Verify authenticity ---
      // 1a. HMAC — the required gate. No valid HMAC, no further processing,
      //     not even JSON parsing.
      const hmac = verifyHmacSignature(
        rawBody,
        req.get('X-NS-Signature'),
        req.get('X-NS-Timestamp'),
        callbackSecret,
      );
      if (!hmac.ok) {
        // Log the specific reason server-side; return a generic error only.
        log('HMAC verification failed', hmac.reason);
        return res.status(401).json({ error: 'invalid_signature' });
      }
      log('HMAC verified');

      let body;
      try {
        body = JSON.parse(rawBody.toString('utf8'));
      } catch {
        body = undefined;
      }
      if (!body || typeof body !== 'object' || Array.isArray(body)) {
        log('signed body is not a JSON object');
        return res.status(400).json({ error: 'invalid_body' });
      }
      // The replay key is the SIGNED body field. X-NS-Request-ID carries the
      // same value, but the HMAC does not cover headers, so the header must
      // not be the key: a replay with a fresh header value would pass.
      requestId =
        typeof body.request_id === 'string' ? body.request_id : undefined;

      // 1a'. Replay. The HMAC window tolerates clock skew, so inside it a
      //      captured webhook verifies again; a request id seen before is
      //      refused. The platform's code is single-use, but your side effects
      //      are not. The claim is released below if the handshake fails, so
      //      a transient error does not burn the id for the whole window.
      if (!requestId || !replayGuard.claim(requestId)) {
        log('replayed or id-less webhook refused');
        return res.status(409).json({ error: 'duplicate_request' });
      }
      claimed = true;

      // 1b. Cluster JWT — optional attestation. Verify WHEN PRESENT (reject on
      //     failure); skip cleanly when absent. In MOCK_MODE there is no
      //     cluster, so the header is simply absent and this is a no-op.
      const clusterToken = req.get('X-NS-Cluster-Verification');
      if (clusterToken && !mock) {
        await verifyCluster(clusterToken, {
          jwksUri,
          issuer,
          expectedAppId: appId,
        });
        log('cluster JWT verified');
      } else {
        log(
          'no cluster JWT present — proceeding on HMAC (expected in some setups)',
        );
      }

      // --- 2. Exchange the code (PKCE) for a NetSapiens token proving identity ---
      let nsToken;
      if (mock) {
        log('MOCK_MODE: skipping live code exchange');
        // Fabricate a proof carrying identity so downstream minting works with
        // no real cluster. Clearly labelled mock — never trust this shape for
        // real.
        nsToken = {
          access_token: `mock-ns-token-for-${body.user?.uid}`,
          uid: body.user?.uid,
          domain: body.user?.domain,
          displayName: body.user?.displayName,
          mock: true,
        };
      } else {
        nsToken = await exchange(body, { redirectUri });
        log('code exchanged for NS token');
      }

      // --- 3. Mint the vendor's OWN token for the PROVEN user and return it ---
      // Identity is taken from `nsToken` (the exchange result), not body.user.
      const vendorToken = mint(nsToken, {
        secret: vendorJwtSecret,
        ttlSeconds,
        fallbackUser: body.user,
      });
      log('minted vendor token', { sub: nsToken.uid || nsToken.login });

      // 2xx + JSON. The platform maps { access_token, token_type, expires_in,
      // refresh_token? } onto RemoteAuthResponse via an explicit allow-list —
      // any other field is dropped (no generic metadata pass-through today).
      return res.status(200).json(vendorToken);
    } catch (err) {
      // Nothing was minted, so the id goes back: the platform's retry of the
      // same webhook can succeed once the JWKS fetch or the exchange recovers.
      if (claimed) replayGuard.release(requestId);
      // Non-2xx / timeout / unparseable -> the platform returns 502 RA009 to
      // the SDK and the extension's promise rejects. Log detail server-side;
      // return a generic message so upstream/internal detail isn't echoed to
      // the caller.
      log('callback failed', err.message);
      return res.status(401).json({ error: 'verification_failed' });
    }
  };
}
