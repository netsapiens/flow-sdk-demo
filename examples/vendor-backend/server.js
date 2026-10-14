/**
 * Reference vendor backend for the Flow remoteAuth handshake.
 *
 * Receives the signed webhook the NetSapiens API POSTs to your `callbackUrl`,
 * verifies it, exchanges the PKCE code for proof of the user's identity, mints
 * the vendor's own token, and returns it. The Flow platform shapes a 2xx
 * JSON response into the SDK's `RemoteAuthResponse` and resolves the
 * extension's `auth.requestRemoteAuth(...)` promise.
 *
 * This implements the NetSapiens remote-auth webhook contract (HMAC as the
 * required gate, optional cluster-JWT attestation, PKCE code exchange, and
 * vendor-token minting). Run with MOCK_MODE=1 to exercise it end-to-end with no
 * cluster (see README + scripts/sign.js).
 */
import express from 'express';

import { exchangeCodeForNsToken } from './lib/exchange.js';
import { mintVendorToken } from './lib/token.js';
import { verifyClusterToken, verifyHmacSignature } from './lib/verify.js';

const {
  PORT = '8787',
  CALLBACK_PATH = '/flow/callback',
  INSIGHT_JWKS_URL = 'https://insight.netsapiens.com/.well-known/jwks.json',
  INSIGHT_ISSUER = 'https://insight.netsapiens.com',
  VENDOR_JWT_SECRET,
  VENDOR_TOKEN_TTL_SECONDS = '3600',
  // Your registered callback URL, sent as `redirect_uri` in the code exchange
  // when set (some token endpoints require it to match). Optional.
  PUBLIC_CALLBACK_URL,
  MOCK_MODE = '0',
} = process.env;

// Named HORIZON_* before 3.0.0. The old names are still read for one release so
// an existing .env keeps working; drop the fallbacks in the release after.
const FLOW_CALLBACK_SECRET =
  process.env.FLOW_CALLBACK_SECRET ?? process.env.HORIZON_CALLBACK_SECRET;
const FLOW_APP_ID =
  process.env.FLOW_APP_ID ??
  process.env.HORIZON_APP_ID ??
  'flow-extension-demo';

const mock = MOCK_MODE === '1';
const ttlSeconds = Number(VENDOR_TOKEN_TTL_SECONDS);

// Fail fast on an unset or well-known-insecure signing secret. Unlike a missing
// callback secret (which just rejects every webhook), a bad VENDOR_JWT_SECRET
// silently signs REAL, trusted tokens anyone could forge — so refuse to boot.
const INSECURE_SECRETS = new Set(['', 'dev-only-insecure-secret', 'changeme']);
if (!VENDOR_JWT_SECRET || INSECURE_SECRETS.has(VENDOR_JWT_SECRET)) {
  console.error(
    'FATAL: VENDOR_JWT_SECRET is unset or set to a known insecure default. ' +
      'Set it to a long random string before starting.',
  );
  process.exit(1);
}

const app = express();
// ⚠️ CAPTURE THE RAW BODY. Signature v2 is an HMAC over the exact bytes received,
// so the parsed object is not enough — JSON.stringify(req.body) re-serializes and
// will not match. `verify` runs before parsing and hands us the buffer.
app.use(
  express.json({
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    },
  }),
);

app.get('/healthz', (_req, res) => res.json({ ok: true, mock }));

app.post(CALLBACK_PATH, async (req, res) => {
  const body = req.body || {};
  const requestId = req.get('X-NS-Request-ID') || body.request_id;
  const log = (msg, extra) =>
    console.log(`[${requestId ?? 'no-request-id'}] ${msg}`, extra ?? '');

  try {
    // --- 1. Verify authenticity ---
    // 1a. HMAC — the required gate. No valid HMAC, no further processing.
    const hmac = verifyHmacSignature(
      req.rawBody,
      req.get('X-NS-Signature'),
      req.get('X-NS-Timestamp'),
      FLOW_CALLBACK_SECRET,
    );
    if (!hmac.ok) {
      // Log the specific reason server-side; return a generic error only.
      log('HMAC verification failed', hmac.reason);
      return res.status(401).json({ error: 'invalid_signature' });
    }
    log('HMAC verified');

    // 1b. Cluster JWT — optional attestation. Verify WHEN PRESENT (reject on
    //     failure); skip cleanly when absent. In MOCK_MODE there is no cluster,
    //     so the header is simply absent and this is a no-op.
    const clusterToken = req.get('X-NS-Cluster-Verification');
    if (clusterToken && !mock) {
      await verifyClusterToken(clusterToken, {
        jwksUri: INSIGHT_JWKS_URL,
        issuer: INSIGHT_ISSUER,
        expectedAppId: FLOW_APP_ID,
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
      // Fabricate a proof carrying identity so downstream minting works with no
      // real cluster. Clearly labelled mock — never trust this shape for real.
      nsToken = {
        access_token: `mock-ns-token-for-${body.user?.uid}`,
        uid: body.user?.uid,
        domain: body.user?.domain,
        displayName: body.user?.displayName,
        mock: true,
      };
    } else {
      nsToken = await exchangeCodeForNsToken(body, {
        redirectUri: PUBLIC_CALLBACK_URL,
      });
      log('code exchanged for NS token');
    }

    // --- 3. Mint the vendor's OWN token for the PROVEN user and return it ---
    // Identity is taken from `nsToken` (the exchange result), not body.user.
    const vendorToken = mintVendorToken(nsToken, {
      secret: VENDOR_JWT_SECRET,
      ttlSeconds,
      fallbackUser: body.user,
    });
    log('minted vendor token', { sub: nsToken.uid || nsToken.login });

    // 2xx + JSON. The platform maps { access_token, token_type, expires_in,
    // refresh_token? } onto RemoteAuthResponse via an explicit allow-list —
    // any other field is dropped (no generic metadata pass-through today).
    return res.status(200).json(vendorToken);
  } catch (err) {
    // Non-2xx / timeout / unparseable -> the platform returns 502 RA009 to the
    // SDK and the extension's promise rejects. Log detail server-side; return a
    // generic message so upstream/internal detail isn't echoed to the caller.
    log('callback failed', err.message);
    return res.status(401).json({ error: 'verification_failed' });
  }
});

app.listen(Number(PORT), () => {
  console.log(
    `vendor backend listening on :${PORT}${CALLBACK_PATH}` +
      (mock ? '  [MOCK_MODE — not for production]' : ''),
  );
  if (!FLOW_CALLBACK_SECRET) {
    console.warn(
      'WARNING: FLOW_CALLBACK_SECRET is unset — all webhooks will be rejected.',
    );
  }
});
