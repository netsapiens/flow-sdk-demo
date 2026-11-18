import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  EXCHANGE_TIMEOUT_MS,
  exchangeCodeForNsToken,
  resolveTokenEndpoint,
} from '../lib/exchange.js';

const LIVE = 'https://acme.example.com/ns-api/v2/oauth2/token';

test('a pin in the documented form matches the advertised endpoint', () => {
  assert.equal(resolveTokenEndpoint(LIVE, LIVE), LIVE);
});

test('the webhook may advertise /oauth/token, a trailing slash or a query', () => {
  for (const advertised of [
    'https://acme.example.com/ns-api/v2/oauth/token',
    'https://acme.example.com/ns-api/v2/oauth/token/',
    'https://acme.example.com/ns-api/v2/oauth2/token/',
    'https://acme.example.com/ns-api/v2/oauth2/token?client=netsapiens',
    'https://ACME.example.com:443/ns-api/v2/oauth2/token',
  ]) {
    assert.equal(resolveTokenEndpoint(LIVE, advertised), LIVE, advertised);
  }
});

test('a pin spelled /oauth/token is accepted and posts to the live /oauth2 route', () => {
  assert.equal(
    resolveTokenEndpoint(
      'https://acme.example.com/ns-api/v2/oauth/token',
      'https://acme.example.com/ns-api/v2/oauth/token',
    ),
    LIVE,
  );
});

test('a pin on another origin or path refuses', () => {
  for (const pinned of [
    'https://evil.example.com/ns-api/v2/oauth2/token',
    'https://acme.example.com:8443/ns-api/v2/oauth2/token',
    'https://acme.example.com/oauth2/token',
  ]) {
    assert.throws(
      () => resolveTokenEndpoint(pinned, LIVE),
      /refusing to post the code/,
      pinned,
    );
  }
});

test('an unset pin refuses and names the variable', () => {
  for (const pinned of [undefined, '']) {
    assert.throws(
      () => resolveTokenEndpoint(pinned, LIVE),
      /FLOW_TOKEN_ENDPOINT is not set/,
    );
  }
});

test('a missing advertised endpoint refuses', () => {
  assert.throws(
    () => resolveTokenEndpoint(LIVE, undefined),
    /missing validation_endpoint/,
  );
});

test('a pin with a query, fragment or credentials refuses', () => {
  for (const pinned of [
    `${LIVE}?x=1`,
    `${LIVE}#frag`,
    'https://user:pw@acme.example.com/ns-api/v2/oauth2/token',
  ]) {
    assert.throws(
      () => resolveTokenEndpoint(pinned, LIVE),
      /scheme, host and path only/,
      pinned,
    );
  }
});

test('an http:// pin refuses unless it is loopback outside production', () => {
  const http = 'http://acme.example.com/ns-api/v2/oauth2/token';
  assert.throws(() => resolveTokenEndpoint(http, http), /must be an https/);
  assert.throws(
    () => resolveTokenEndpoint(http, http, { allowInsecureLoopback: true }),
    /must be an https/,
    'loopback only, never any other host',
  );

  const local = 'http://localhost:8080/ns-api/v2/oauth2/token';
  assert.throws(() => resolveTokenEndpoint(local, local), /must be an https/);
  assert.equal(
    resolveTokenEndpoint(local, local, { allowInsecureLoopback: true }),
    local,
  );
  const loop = 'http://127.0.0.1/ns-api/v2/oauth2/token';
  assert.equal(
    resolveTokenEndpoint(loop, loop, { allowInsecureLoopback: true }),
    loop,
  );
});

test('a pin that is not a URL refuses', () => {
  assert.throws(
    () => resolveTokenEndpoint('acme.example.com/oauth2/token', LIVE),
    /not an absolute URL/,
  );
});

test('a failed exchange reports the status and never the upstream body', async () => {
  const previous = {
    endpoint: process.env.FLOW_TOKEN_ENDPOINT,
    env: process.env.NODE_ENV,
  };
  process.env.FLOW_TOKEN_ENDPOINT = LIVE;
  process.env.NODE_ENV = 'production';
  try {
    let bodyRead = false;
    const fetchImpl = async () => ({
      ok: false,
      status: 400,
      text: async () => {
        bodyRead = true;
        return 'invalid_grant code=SECRET-CODE code_verifier=SECRET-VERIFIER';
      },
    });
    await assert.rejects(
      exchangeCodeForNsToken(
        {
          code: 'c',
          code_verifier: 'v',
          validation_endpoint: LIVE,
          user: { uid: 'u' },
        },
        { fetchImpl },
      ),
      (err) => {
        assert.equal(err.message, 'code exchange failed: 400');
        return true;
      },
    );
    assert.equal(bodyRead, false, 'the upstream body is not even read');
  } finally {
    process.env.FLOW_TOKEN_ENDPOINT = previous.endpoint;
    process.env.NODE_ENV = previous.env;
  }
});

test('the exchange posts to the pin only, follows no redirect, and times out', async () => {
  const previous = {
    endpoint: process.env.FLOW_TOKEN_ENDPOINT,
    env: process.env.NODE_ENV,
  };
  process.env.FLOW_TOKEN_ENDPOINT = LIVE;
  process.env.NODE_ENV = 'production';
  try {
    let seen;
    const fetchImpl = async (url, init) => {
      seen = { url, init };
      return {
        ok: true,
        status: 200,
        json: async () => ({ uid: '1042@acme.example.com' }),
      };
    };
    const result = await exchangeCodeForNsToken(
      {
        code: 'c',
        code_verifier: 'v',
        validation_endpoint: 'https://acme.example.com/ns-api/v2/oauth/token',
        user: { uid: '1042@acme.example.com' },
      },
      { fetchImpl },
    );
    assert.equal(result.uid, '1042@acme.example.com');
    assert.equal(seen.url, LIVE);
    assert.equal(seen.init.redirect, 'error');
    assert.ok(seen.init.signal instanceof AbortSignal);
    assert.ok(EXCHANGE_TIMEOUT_MS > 0);
  } finally {
    process.env.FLOW_TOKEN_ENDPOINT = previous.endpoint;
    process.env.NODE_ENV = previous.env;
  }
});
