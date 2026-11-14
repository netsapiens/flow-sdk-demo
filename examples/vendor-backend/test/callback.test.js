import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { test } from 'node:test';

import { createCallbackHandler } from '../lib/callback.js';
import { createReplayGuard } from '../lib/replay.js';

const CALLBACK_SECRET = 'test-callback-secret-0123456789abcdef0123456789';
const VENDOR_SECRET = 'test-vendor-jwt-secret-0123456789abcdef012345678';

/** A webhook signed the way the platform signs it (v2), as an Express-ish req. */
function signedRequest(body, { secret = CALLBACK_SECRET, headers = {} } = {}) {
  const rawBody = Buffer.from(JSON.stringify(body), 'utf8');
  const timestamp = String(Math.floor(Date.now() / 1000));
  const signature = crypto
    .createHmac('sha256', secret)
    .update(`${timestamp}.`)
    .update(rawBody)
    .digest('hex');
  const all = {
    'x-ns-request-id': body.request_id,
    'x-ns-timestamp': timestamp,
    'x-ns-signature': `sha256=${signature}`,
    ...Object.fromEntries(
      Object.entries(headers).map(([k, v]) => [k.toLowerCase(), v]),
    ),
  };
  // Like express.raw in server.js: req.body is the bytes, nothing is parsed.
  return { body: rawBody, get: (name) => all[name.toLowerCase()] };
}

/** The same, for bytes that are not JSON. */
function signedRawRequest(rawBody, secret = CALLBACK_SECRET) {
  const timestamp = String(Math.floor(Date.now() / 1000));
  const signature = crypto
    .createHmac('sha256', secret)
    .update(`${timestamp}.`)
    .update(rawBody)
    .digest('hex');
  const all = {
    'x-ns-timestamp': timestamp,
    'x-ns-signature': `sha256=${signature}`,
  };
  return { body: rawBody, get: (name) => all[name.toLowerCase()] };
}

function fakeResponse() {
  const res = {
    statusCode: 200,
    body: undefined,
    status(code) {
      res.statusCode = code;
      return res;
    },
    json(payload) {
      res.body = payload;
      return res;
    },
  };
  return res;
}

const webhook = (requestId = 'remauth_abc123') => ({
  request_id: requestId,
  code: 'single-use-code',
  code_verifier: 'verifier',
  user: { uid: '1042@acme.example.com', domain: 'acme.example.com' },
  validation_endpoint: 'https://acme.example.com/ns-api/v2/oauth2/token',
});

const quiet = { log() {} };

function handler(overrides = {}) {
  return createCallbackHandler({
    callbackSecret: CALLBACK_SECRET,
    vendorJwtSecret: VENDOR_SECRET,
    ttlSeconds: 60,
    appId: 'flow-extension-demo',
    jwksUri: 'https://insight.example/.well-known/jwks.json',
    issuer: 'https://insight.example',
    mock: true,
    logger: quiet,
    ...overrides,
  });
}

test('a correctly signed webhook mints a vendor token', async () => {
  const res = fakeResponse();
  await handler()(signedRequest(webhook()), res);
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.token_type, 'Bearer');
  assert.ok(res.body.access_token);
});

test('a replay with a fresh X-NS-Request-ID header is refused', async () => {
  const handle = handler();
  const first = signedRequest(webhook());
  const res1 = fakeResponse();
  await handle(first, res1);
  assert.equal(res1.statusCode, 200);

  // Same bytes, same signature, same timestamp: only the unsigned header
  // changes. The guard must key on the signed body field, not the header.
  const replay = {
    ...first,
    get: (name) =>
      name.toLowerCase() === 'x-ns-request-id'
        ? 'remauth_fresh_header'
        : first.get(name),
  };
  const res2 = fakeResponse();
  await handle(replay, res2);
  assert.equal(res2.statusCode, 409);
  assert.deepEqual(res2.body, { error: 'duplicate_request' });
});

test('a webhook with a header id but no signed request_id is refused', async () => {
  const body = webhook();
  delete body.request_id;
  const res = fakeResponse();
  await handler()(
    signedRequest(body, { headers: { 'X-NS-Request-ID': 'remauth_hdr' } }),
    res,
  );
  assert.equal(res.statusCode, 409);
});

test('a transient exchange failure does not burn the id: the retry succeeds', async () => {
  let calls = 0;
  const exchange = async () => {
    calls += 1;
    if (calls === 1) throw new Error('code exchange failed: 503');
    return { access_token: 'ns', uid: '1042@acme.example.com' };
  };
  const guard = createReplayGuard();
  const handle = handler({ mock: false, exchange, replayGuard: guard });

  const res1 = fakeResponse();
  await handle(signedRequest(webhook()), res1);
  assert.equal(res1.statusCode, 401);
  assert.deepEqual(res1.body, { error: 'verification_failed' });
  assert.equal(guard.size, 0, 'the failed id was released');

  const res2 = fakeResponse();
  await handle(signedRequest(webhook()), res2);
  assert.equal(res2.statusCode, 200);
  assert.equal(calls, 2);
  assert.equal(guard.size, 1, 'the successful id stays claimed');
});

test('a cluster JWT that fails verification releases the id for a retry', async () => {
  let attempts = 0;
  const verifyCluster = async () => {
    attempts += 1;
    if (attempts === 1) throw new Error('jwks fetch failed');
  };
  const guard = createReplayGuard();
  const handle = handler({
    mock: false,
    verifyCluster,
    exchange: async () => ({ uid: '1042@acme.example.com' }),
    replayGuard: guard,
  });
  const req = () =>
    signedRequest(webhook(), {
      headers: { 'X-NS-Cluster-Verification': 'a.b.c' },
    });

  const res1 = fakeResponse();
  await handle(req(), res1);
  assert.equal(res1.statusCode, 401);
  const res2 = fakeResponse();
  await handle(req(), res2);
  assert.equal(res2.statusCode, 200);
});

test('a bad signature never reaches the replay guard', async () => {
  const guard = createReplayGuard();
  const res = fakeResponse();
  await handler({ replayGuard: guard })(
    signedRequest(webhook(), { secret: 'wrong-secret' }),
    res,
  );
  assert.equal(res.statusCode, 401);
  assert.deepEqual(res.body, { error: 'invalid_signature' });
  assert.equal(guard.size, 0);
});

test('a body that is not JSON is parsed only after the HMAC passes', async () => {
  const bytes = Buffer.from('{"request_id": "remauth_x", not json', 'utf8');
  // Unsigned (wrong secret): refused as a signature failure, never parsed.
  const res1 = fakeResponse();
  await handler()(
    signedRawRequest(bytes, 'another-secret-value-long-enough-xx'),
    res1,
  );
  assert.equal(res1.statusCode, 401);
  assert.deepEqual(res1.body, { error: 'invalid_signature' });
  // Signed: parsed, and refused as a body problem.
  const res2 = fakeResponse();
  await handler()(signedRawRequest(bytes), res2);
  assert.equal(res2.statusCode, 400);
  assert.deepEqual(res2.body, { error: 'invalid_body' });
  // A signed JSON array is not a webhook either.
  const res3 = fakeResponse();
  await handler()(signedRawRequest(Buffer.from('[1,2]')), res3);
  assert.equal(res3.statusCode, 400);
});

test('a request with no raw body is a signature failure', async () => {
  const res = fakeResponse();
  await handler()({ body: {}, get: () => undefined }, res);
  assert.equal(res.statusCode, 401);
});

test('request-supplied values are sanitised before they are logged', async () => {
  const lines = [];
  const logger = { log: (...args) => lines.push(args.join(' ')) };
  const body = webhook('remauth_ok\r\n[fake] HMAC verified');
  const res = fakeResponse();
  await handler({ logger })(signedRequest(body), res);
  assert.equal(res.statusCode, 200);
  assert.ok(lines.length > 0);
  for (const line of lines) {
    assert.ok(!/[\r\n]/.test(line), `control characters in log line: ${line}`);
  }
  // The unsigned header is not what gets logged.
  const res2 = fakeResponse();
  await handler({ logger })(
    signedRequest(webhook('remauth_other'), {
      headers: { 'X-NS-Request-ID': 'HEADER_VALUE_NOT_LOGGED' },
    }),
    res2,
  );
  assert.ok(!lines.some((line) => line.includes('HEADER_VALUE_NOT_LOGGED')));
});

test('replay guard forgets an id once the window has passed', () => {
  let clock = 1_000_000;
  const guard = createReplayGuard({ windowMs: 1000, now: () => clock });
  assert.equal(guard.claim('a'), true);
  assert.equal(guard.claim('a'), false);
  clock += 1001;
  assert.equal(guard.claim('a'), true);
});
