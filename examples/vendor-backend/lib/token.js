/**
 * Step 3: mint the VENDOR'S OWN token for the verified user. This is the token
 * the SDK ultimately hands back to the extension as `RemoteAuthResponse`.
 *
 * Here it's a self-signed JWT for illustration; in a real vendor backend this is
 * wherever your product issues sessions/tokens (your OAuth server, a DB-backed
 * opaque token, a real Salesforce/HubSpot token from your own OAuth app, etc.).
 * The key point: it is YOUR token, scoped to the user the NS exchange proved.
 *
 * IDENTITY: bind the token to the identity the code exchange RETURNED
 * (`nsToken`), never to the webhook body's `user.uid`. ns-api pins the auth code
 * to the caller's trusted session and validates `username` at exchange, so the
 * exchange response is the authoritative identity; the request body's `user` is
 * attacker-influenceable and only used as a display-name fallback.
 */
import jwt from 'jsonwebtoken';

/**
 * @param {object} nsToken   NS token-exchange response (the PROVEN identity):
 *                           { access_token, uid?/login?, domain?, ... }
 * @param {object} opts      { secret, ttlSeconds, fallbackUser? }
 * @returns {{ access_token: string, token_type: string, expires_in: number }}
 */
export function mintVendorToken(nsToken, { secret, ttlSeconds, fallbackUser }) {
  // Identity comes from the exchange response, NOT the webhook body.
  const sub = nsToken?.uid || nsToken?.login;
  if (!sub) {
    throw new Error(
      'code exchange returned no user identity (uid/login) to bind the token to',
    );
  }

  const accessToken = jwt.sign(
    {
      sub,
      domain: nsToken.domain,
      // Display name isn't security-sensitive; fall back to the webhook body.
      name: nsToken.displayName || fallbackUser?.displayName,
    },
    secret,
    { expiresIn: ttlSeconds, issuer: 'flow-remote-auth-vendor-backend' },
  );

  // snake_case OAuth shape. The NetSapiens platform maps this onto the SDK's
  // RemoteAuthResponse via an EXPLICIT ALLOW-LIST:
  //   access_token  -> accessToken
  //   token_type    -> tokenType   (defaults to 'Bearer' if omitted)
  //   expires_in    -> expiresAt   (absolute unix seconds: time() + expires_in)
  //   refresh_token -> refreshToken (only if present)
  //   cluster_verification -> clusterVerification (only if present)
  // Only those are mapped — any OTHER field you return is silently dropped.
  // There is no generic `metadata` pass-through today.
  return {
    access_token: accessToken,
    token_type: 'Bearer',
    expires_in: ttlSeconds,
  };
}
