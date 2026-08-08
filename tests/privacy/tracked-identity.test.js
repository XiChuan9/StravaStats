import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';

import {
  createIdentityDigest,
  findContentViolation,
  scanTrackedFiles,
} from '../../scripts/check-privacy.mjs';

test('privacy guard rejects identity selectors and numeric opaque-ID parsing', () => {
  const targetSelector = ['TARGET', 'ATHLETE', 'ID'].join('_');
  const profileAccess = ['profile', 'id'].join('.');
  const activityArgument = ['activity', 'Id'].join('');
  assert.equal(
    findContentViolation('synthetic.js', `const ${targetSelector} = 42;`),
    'hard-coded athlete identity selector',
  );
  assert.equal(
    findContentViolation('synthetic.js', `const id = Number(${profileAccess});`),
    'opaque identity numeric coercion',
  );
  assert.equal(
    findContentViolation('synthetic.js', `initialize(parseInt(${activityArgument}, 10));`),
    'opaque activity ID numeric parsing',
  );
});

test('privacy guard digest matching is testable without private literals', () => {
  const syntheticCanary = 'synthetic-private-identity-canary';
  const digests = new Set([createIdentityDigest(syntheticCanary)]);
  assert.equal(
    findContentViolation('synthetic.js', `const label = '${syntheticCanary}';`, digests),
    'tracked athlete identity literal',
  );
});

test('opaque string IDs remain permitted as inert data', () => {
  for (const id of [
    '0',
    '000123',
    'id/a?b=c&d=e#frag%25',
    '运动员-🧪',
    '__proto__',
    'constructor',
    'prototype',
  ]) {
    assert.equal(
      findContentViolation('synthetic.js', `const id = ${JSON.stringify(id)};`),
      null,
    );
  }
});

test('tracked current tree contains no prohibited identity category', () => {
  assert.deepEqual(scanTrackedFiles(), []);
});

test('repository privacy command uses the content guard', () => {
  assert.doesNotThrow(() => execFileSync(
    process.execPath,
    ['scripts/check-privacy.mjs'],
    { cwd: process.cwd(), encoding: 'utf8', stdio: 'pipe' },
  ));
});
