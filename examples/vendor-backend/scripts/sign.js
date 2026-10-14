/**
 * Local smoke test: build a webhook payload, sign it the way the NetSapiens API
 * would (signature v2: HMAC-SHA256 over `"<timestamp>." + the raw body bytes`),
 * and POST it to the running server. Use with MOCK_MODE=1 so the server skips the cluster-JWT
 * verification and the live code exchange.
 *
 *   FLOW_CALLBACK_SECRET=test-secret MOCK_MODE=1 npm start   # terminal 1
 *   FLOW_CALLBACK_SECRET=test-secret npm run sign            # terminal 2
 *
 * It does NOT send X-NS-Cluster-Verification, so it only works against a server
 * in MOCK_MODE. Real webhooks always carry both headers.
 */
import crypto from 'node:crypto';

const SECRET =
  process.env.FLOW_CALLBACK_SECRET ||
  process.env.HORIZON_CALLBACK_SECRET || // pre-3.0.0 name, read for one release
  'test-secret';
const URL = process.env.TARGET_URL || 'http://localhost:8787/flow/callback';

const request_id = `remauth_${crypto.randomBytes(6).toString('hex')}`;
const code = crypto.randomBytes(16).toString('hex');
const timestamp = Math.floor(Date.now() / 1000);

// Build the body FIRST, serialize it once, then sign and send those exact bytes.
// Signing a separately-constructed string is how a signer and a real sender drift
// apart: JSON.stringify is not canonical, so re-serializing can change the bytes.
const body = {
  request_id,
  code,
  code_verifier: crypto.randomBytes(32).toString('base64url'),
  user: {
    uid: '1042@acme.example.com',
    domain: 'acme.example.com',
    displayName: 'Alice Example',
  },
  vendor_id: 'demo-backend',
  app_id: 'flow-extension-demo',
  platform: {
    client_id: 1,
    client: 'netsapiens',
    cluster_id: 23767,
    cluster_name: 'local mock cluster',
    tenant: 'tenant_1_23767',
    hostname: 'acme.example.com',
  },
  expires_in: 600,
  validation_endpoint: 'https://acme.example.com/ns-api/v2/oauth2/token',
  timestamp,
  pkce_enabled: true,
  // NOTE: no `signature` field. v2 signs the whole body, and a signature cannot
  // cover a body that contains it — it travels in X-NS-Signature only.
};

const rawBody = Buffer.from(JSON.stringify(body), 'utf8');

const signature = crypto
  .createHmac('sha256', SECRET)
  .update(`${timestamp}.`)
  .update(rawBody)
  .digest('hex');

const res = await fetch(URL, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-NS-Request-ID': request_id,
    'X-NS-Timestamp': String(timestamp),
    'X-NS-Signature': `sha256=${signature}`,
    'X-NS-Signature-Version': '2',
    // No X-NS-Platform-Assertion / X-NS-Cluster-Verification — MOCK_MODE only.
  },
  body: rawBody,
});

console.log('status:', res.status);
console.log('response:', JSON.stringify(await res.json(), null, 2));
