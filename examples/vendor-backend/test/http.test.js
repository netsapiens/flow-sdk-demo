import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  createErrorMiddleware,
  createRateLimiter,
  LOG_VALUE_MAX,
  sanitizeLogValue,
} from '../lib/http.js';

test('sanitizeLogValue strips control characters and caps the length', () => {
  assert.equal(
    sanitizeLogValue('remauth_abc\r\n[forged] line'),
    'remauth_abc[forged] line',
  );
  assert.equal(sanitizeLogValue('a\u001b[31mred\u0000'), 'a[31mred');
  assert.equal(sanitizeLogValue(undefined), '');
  assert.equal(sanitizeLogValue(42), '42');
  const long = 'x'.repeat(LOG_VALUE_MAX + 50);
  const out = sanitizeLogValue(long);
  assert.equal(out.length, LOG_VALUE_MAX + 1);
  assert.ok(out.endsWith('…'));
});

function fakeResponse() {
  const res = {
    statusCode: 200,
    body: undefined,
    headersSent: false,
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

test('the error middleware answers with the status only', () => {
  const logged = [];
  const middleware = createErrorMiddleware({
    error: (...args) => logged.push(args),
  });
  const err = new SyntaxError('Unexpected token } in JSON at position 12');
  err.status = 400;
  err.type = 'entity.parse.failed';
  const res = fakeResponse();
  middleware(err, {}, res, () => {});
  assert.equal(res.statusCode, 400);
  assert.deepEqual(res.body, { error: 'request_failed' });
  assert.equal(logged.length, 1);
  assert.ok(!JSON.stringify(res.body).includes('Unexpected token'));
});

test('an error without a usable status is a 500', () => {
  const middleware = createErrorMiddleware({ error() {} });
  for (const err of [
    new Error('boom'),
    { status: 200 },
    { status: 'x' },
    null,
  ]) {
    const res = fakeResponse();
    middleware(err, {}, res, () => {});
    assert.equal(res.statusCode, 500);
  }
});

test('the error middleware does not write when headers were already sent', () => {
  const middleware = createErrorMiddleware({ error() {} });
  const res = fakeResponse();
  res.headersSent = true;
  middleware(new Error('late'), {}, res, () => {});
  assert.equal(res.body, undefined);
});

const fakeRes = () => {
  const r = { headers: {}, statusCode: 200, body: undefined };
  r.set = (k, v) => {
    r.headers[k] = v;
    return r;
  };
  r.status = (s) => {
    r.statusCode = s;
    return r;
  };
  r.json = (b) => {
    r.body = b;
    return r;
  };
  return r;
};

test('the rate limiter admits `limit` requests per window per address, then answers 429', () => {
  let clock = 1_000;
  const limiter = createRateLimiter({
    windowMs: 1000,
    limit: 2,
    now: () => clock,
  });
  const call = (ip) => {
    const res = fakeRes();
    let passed = false;
    limiter({ ip }, res, () => {
      passed = true;
    });
    return { passed, res };
  };
  assert.equal(call('10.0.0.1').passed, true);
  assert.equal(call('10.0.0.1').passed, true);
  const third = call('10.0.0.1');
  assert.equal(third.passed, false);
  assert.equal(third.res.statusCode, 429);
  assert.deepEqual(third.res.body, { error: 'rate_limited' });
  assert.equal(third.res.headers['RateLimit-Remaining'], '0');
  assert.equal(third.res.headers['Retry-After'], '1');
  // Another address has its own window.
  assert.equal(call('10.0.0.2').passed, true);
  // The window resets.
  clock += 1000;
  assert.equal(call('10.0.0.1').passed, true);
});
