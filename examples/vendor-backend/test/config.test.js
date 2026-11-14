import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  checkSecret,
  MIN_SECRET_LENGTH,
  secretProblems,
} from '../lib/config.js';

const strong = 'f3a9c1d8e7b2a4c6d9e1f0a2b3c4d5e6f7a8b9c0';

test('a long random value passes', () => {
  assert.deepEqual(checkSecret('X', strong), { ok: true });
  assert.ok(strong.length >= MIN_SECRET_LENGTH);
});

test('unset, empty and blank values are refused', () => {
  for (const value of [undefined, null, '', '   ', 42]) {
    const result = checkSecret('X', value);
    assert.equal(result.ok, false);
    assert.match(result.reason, /unset/);
  }
});

test('anything shorter than the minimum is refused, even if random', () => {
  const short = strong.slice(0, MIN_SECRET_LENGTH - 1);
  const result = checkSecret('X', short);
  assert.equal(result.ok, false);
  assert.match(result.reason, /shorter than/);
  assert.ok(!result.reason.includes(short), 'the value is not echoed');
});

test('the previously listed insecure defaults are still refused', () => {
  for (const value of ['dev-only-insecure-secret', 'changeme']) {
    assert.equal(checkSecret('X', value).ok, false);
  }
});

test('a placeholder word is refused at any length and any case', () => {
  for (const word of ['example', 'ChangeMe', 'PLACEHOLDER', 'Insecure']) {
    const padded = `${strong}-${word}-${strong}`;
    const result = checkSecret('X', padded);
    assert.equal(result.ok, false, word);
    assert.match(result.reason, /placeholder/);
    assert.ok(!result.reason.includes(padded), 'the value is not echoed');
  }
});

test('secretProblems reports both variables and names each', () => {
  const problems = secretProblems({
    VENDOR_JWT_SECRET: 'dev-secret',
    FLOW_CALLBACK_SECRET: undefined,
  });
  assert.equal(problems.length, 2);
  assert.match(problems[0], /^VENDOR_JWT_SECRET /);
  assert.match(problems[1], /^FLOW_CALLBACK_SECRET /);
});

test('secretProblems is empty when both secrets are strong', () => {
  assert.deepEqual(
    secretProblems({ VENDOR_JWT_SECRET: strong, FLOW_CALLBACK_SECRET: strong }),
    [],
  );
});
