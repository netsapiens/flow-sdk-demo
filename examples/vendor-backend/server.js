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

import { createCallbackHandler } from './lib/callback.js';
import { secretProblems } from './lib/config.js';
import { createErrorMiddleware, createRateLimiter } from './lib/http.js';

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

// Named HORIZON_CALLBACK_SECRET before 3.0.0, and still read for one release so
// an existing .env keeps working; drop the fallback in the release after. A
// stale secret fails loudly (every HMAC check rejects).
const FLOW_CALLBACK_SECRET =
  process.env.FLOW_CALLBACK_SECRET ?? process.env.HORIZON_CALLBACK_SECRET;
// HORIZON_APP_ID is deliberately NOT a fallback. 3.0.0 changed the app's
// identity, so an old value (horizon-extension-demo) is wrong by definition and
// would make verifyClusterToken reject every callback that carries a
// cluster-verification token.
const FLOW_APP_ID = process.env.FLOW_APP_ID ?? 'flow-extension-demo';
if (process.env.HORIZON_APP_ID && !process.env.FLOW_APP_ID) {
  console.warn(
    `WARNING: HORIZON_APP_ID is set but ignored since 3.0.0; using FLOW_APP_ID=${FLOW_APP_ID}.`,
  );
}

const mock = MOCK_MODE === '1';
const ttlSeconds = Number(VENDOR_TOKEN_TTL_SECONDS);

// Fail fast on an unset, short or placeholder secret (lib/config.js). A bad
// VENDOR_JWT_SECRET silently signs REAL, trusted tokens anyone could forge, and
// a placeholder FLOW_CALLBACK_SECRET verifies webhooks against a public value,
// so neither gets to boot. The messages name the variable, never its value.
const problems = secretProblems({ VENDOR_JWT_SECRET, FLOW_CALLBACK_SECRET });
if (problems.length > 0) {
  for (const problem of problems) console.error(`FATAL: ${problem}.`);
  console.error(
    'Set each to a long random string (for example `openssl rand -hex 32`) before starting.',
  );
  process.exit(1);
}

const app = express();

app.get('/healthz', (_req, res) => res.json({ ok: true, mock }));

// ⚠️ CAPTURE THE RAW BODY. Signature v2 is an HMAC over the exact bytes received,
// so a parsed object is not enough — JSON.stringify(req.body) re-serializes and
// will not match. The callback route takes the bytes as they are, and the
// handler parses JSON only once the HMAC has verified them, so an
// unauthenticated caller never reaches the parser. No body parser is mounted
// app-wide. The handshake itself lives in lib/callback.js (verify, replay
// guard, code exchange, mint). The replay guard keys on the SIGNED
// body.request_id and is per process: see lib/replay.js for what a
// multi-instance backend needs.
// The callback does an HMAC check, a JWKS fetch and a code exchange per
// request, so it is rate-limited per client address before any of that runs.
// In memory, per process; a multi-instance backend swaps this for a limiter
// with a shared store (express-rate-limit with a Redis store, for instance).
const callbackRateLimit = createRateLimiter({ windowMs: 60 * 1000, limit: 60 });

app.post(
  CALLBACK_PATH,
  callbackRateLimit,
  express.raw({ type: () => true, limit: '100kb' }),
  createCallbackHandler({
    callbackSecret: FLOW_CALLBACK_SECRET,
    vendorJwtSecret: VENDOR_JWT_SECRET,
    ttlSeconds,
    appId: FLOW_APP_ID,
    jwksUri: INSIGHT_JWKS_URL,
    issuer: INSIGHT_ISSUER,
    mock,
    redirectUri: PUBLIC_CALLBACK_URL,
  }),
);

// Status only on a request Express itself rejects (oversized body and the
// like); the default handler would answer with a stack trace outside
// NODE_ENV=production.
app.use(createErrorMiddleware());

app.listen(Number(PORT), () => {
  console.log(
    `vendor backend listening on :${PORT}${CALLBACK_PATH}` +
      (mock ? '  [MOCK_MODE — not for production]' : ''),
  );
});
