/**
 * Webhook authenticity verification for the Flow remoteAuth callback.
 *
 * Three signals, with different roles:
 *
 *   1. HMAC (`X-NS-Signature`) — the PRIMARY, always-required gate. Proves the
 *      sender holds this app's shared callback secret. A webhook that fails (or
 *      omits) the HMAC is rejected outright. **Signature v2** — see
 *      verifyHmacSignature.
 *   1b. Platform assertion (`X-NS-Platform-Assertion`) — RS256, signed by the
 *      calling CLUSTER with its own key, verified against that instance's
 *      published JWKS. Answers "which cluster is calling", carries the same
 *      client/cluster/tenant claims, and needs no third party — so unlike the
 *      cluster JWT below it is available whenever the cluster is configured. It
 *      verifies exactly like the cluster JWT (same helper, different JWKS URI
 *      and claims), so this example does not duplicate the code.
 *   2. Cluster JWT (`X-NS-Cluster-Verification`) — an OPTIONAL, additive
 *      attestation. RS256, signed by INSight, verified against INSight's
 *      published JWKS. Proves the webhook came from a real NetSapiens cluster and
 *      names the client/cluster — without any pre-shared secret. The platform
 *      sends it best-effort (it depends on a live INSight fetch and cluster
 *      config), so it can legitimately be absent. Policy here: verify it WHEN
 *      PRESENT and reject on failure (a genuine cluster sends a valid one); skip
 *      cleanly when absent, since the HMAC already authenticated the sender.
 */
import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import { JwksClient } from 'jwks-rsa';

/**
 * Verify the `X-NS-Signature` HMAC (signature **v2**).
 *
 * The signed material is `"<X-NS-Timestamp>." + <RAW REQUEST BODY>`, HMAC-SHA256,
 * hex-encoded. The header is `sha256=` prefixed.
 *
 * ⚠️ TWO THINGS THAT WILL SILENTLY BREAK THIS.
 *
 *   1. **You must hash the raw bytes.** Re-serializing the parsed object
 *      (`JSON.stringify(req.body)`) produces different bytes — key order,
 *      whitespace, unicode escaping — and will not match. See server.js for how
 *      the raw buffer is captured.
 *   2. **There is no `signature` field in the body.** A signature cannot cover a
 *      body that contains it, which is why v2 moved it to a header.
 *
 * Signature v1 signed the string `request_id + code + timestamp` instead. That
 * covered neither the PKCE verifier, nor the user identity, nor the scopes — so
 * a backend that verified it had verified almost nothing about the request it
 * was about to act on. v2 covers the whole body, and is NOT backward compatible:
 * a v1 verifier rejects every v2 webhook.
 *
 * @param {Buffer|string} rawBody exact bytes as received
 * @param {string|undefined} signatureHeader `X-NS-Signature`
 * @param {string|undefined} timestampHeader `X-NS-Timestamp`
 * @param {string} sharedSecret the app's registered callback secret
 * @param {number} [toleranceSeconds] reject a timestamp older/newer than this
 * @returns {{ ok: boolean, reason?: string }}
 */
export function verifyHmacSignature(
  rawBody,
  signatureHeader,
  timestampHeader,
  sharedSecret,
  toleranceSeconds = 300,
) {
  if (!signatureHeader) return { ok: false, reason: 'missing X-NS-Signature' };
  if (!timestampHeader) return { ok: false, reason: 'missing X-NS-Timestamp' };
  if (!sharedSecret)
    return { ok: false, reason: 'no shared secret configured' };
  if (!rawBody || rawBody.length === 0)
    return { ok: false, reason: 'raw body unavailable — see server.js' };

  const [algo, sig] = signatureHeader.split('=');
  if (algo !== 'sha256')
    return { ok: false, reason: `unsupported algo: ${algo}` };
  if (!sig) return { ok: false, reason: 'malformed signature header' };

  // Replay window. The timestamp is inside the signed string, so it cannot be
  // altered without breaking the signature — checking it here is what makes a
  // captured-and-resent webhook fail.
  const ts = Number(timestampHeader);
  if (!Number.isFinite(ts))
    return { ok: false, reason: 'malformed X-NS-Timestamp' };
  const age = Math.abs(Math.floor(Date.now() / 1000) - ts);
  if (age > toleranceSeconds)
    return { ok: false, reason: `timestamp outside tolerance (${age}s)` };

  const expected = crypto
    .createHmac('sha256', sharedSecret)
    .update(`${timestampHeader}.`)
    .update(rawBody)
    .digest('hex');

  // Constant-time compare. Bail before timingSafeEqual if lengths differ — it
  // throws on unequal-length buffers.
  const a = Buffer.from(sig, 'hex');
  const b = Buffer.from(expected, 'hex');
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    return { ok: false, reason: 'signature mismatch' };
  }
  return { ok: true };
}

let jwks; // lazily created; the client caches keys internally
function getJwksClient(jwksUri) {
  if (!jwks)
    jwks = new JwksClient({ jwksUri, cache: true, cacheMaxAge: 600_000 });
  return jwks;
}

/**
 * Verify the `X-NS-Cluster-Verification` RS256 JWT against INSight's JWKS.
 *
 * Resolves to the decoded claims on success; rejects on any failure. Requires
 * the JWT's `scope` to be `verification` and its `appId` to match this app.
 */
export async function verifyClusterToken(
  token,
  { jwksUri, issuer, expectedAppId },
) {
  if (!token) throw new Error('missing X-NS-Cluster-Verification');

  const decodedHeader = jwt.decode(token, { complete: true });
  const kid = decodedHeader?.header?.kid;
  if (!kid) throw new Error('cluster JWT has no kid');

  const key = await getJwksClient(jwksUri).getSigningKey(kid);
  const claims = jwt.verify(token, key.getPublicKey(), {
    algorithms: ['RS256'],
    issuer,
  });

  if (claims.scope !== 'verification') {
    throw new Error(`unexpected JWT scope: ${claims.scope}`);
  }
  if (claims.appId !== expectedAppId) {
    throw new Error(
      `appId mismatch: expected ${expectedAppId}, got ${claims.appId}`,
    );
  }
  return claims;
}
