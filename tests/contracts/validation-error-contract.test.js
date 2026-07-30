import assert from 'node:assert/strict';
import test from 'node:test';

import * as publicApi from '../../js/data/contracts/index.js';

const { validateCanonicalActivity } = publicApi;

function validActivity(overrides = {}) {
  return {
    schemaVersion: 1,
    id: 'validation-contract',
    sportCategory: 'run',
    sportVariant: null,
    startTimeUtc: '2026-01-02T03:04:05.006Z',
    timeZone: {
      ianaName: 'Etc/UTC',
      utcOffsetMinutes: 0
    },
    capabilities: {
      hasGps: false,
      hasHeartRate: false,
      hasPower: false,
      hasCadence: false,
      hasLaps: false
    },
    ...overrides
  };
}

function compareItems(left, right) {
  if (left.path !== right.path) return left.path < right.path ? -1 : 1;
  if (left.code !== right.code) return left.code < right.code ? -1 : 1;
  if (left.message !== right.message) {
    return left.message < right.message ? -1 : 1;
  }
  return 0;
}

function assertStandardResult(result) {
  assert.deepEqual(Object.keys(result), ['ok', 'errors', 'warnings']);
  assert.equal(typeof result.ok, 'boolean');
  assert.ok(Array.isArray(result.errors));
  assert.ok(Array.isArray(result.warnings));
}

test('public index exports only validateCanonicalActivity in B1', () => {
  assert.deepEqual(Object.keys(publicApi), ['validateCanonicalActivity']);
  assert.equal(typeof validateCanonicalActivity, 'function');
});

test('result and item shapes are stable and minimal', () => {
  const result = validateCanonicalActivity({
    unknown: true
  });

  assertStandardResult(result);

  for (const item of [...result.errors, ...result.warnings]) {
    assert.deepEqual(Object.keys(item), ['code', 'path', 'message']);
    assert.equal(typeof item.code, 'string');
    assert.equal(typeof item.path, 'string');
    assert.equal(typeof item.message, 'string');
  }
});

test('JSON Pointer paths escape slash and tilde segments', () => {
  const activity = validActivity({ 'raw~/field': true });
  activity.timeZone['nested~/field'] = true;

  const result = validateCanonicalActivity(activity);
  assert.deepEqual(
    result.warnings.map((item) => item.path),
    ['/activity/raw~0~1field', '/activity/timeZone/nested~0~1field']
  );
});

test('errors and warnings use deterministic path-code-message ordering', () => {
  const activity = {
    zUnknown: true,
    schemaVersion: 2,
    id: 44,
    sportCategory: 'unsupported',
    sportVariant: 'Not Normalized',
    startTimeUtc: 'not-a-time',
    timeZone: {
      ianaName: 'bad zone',
      utcOffsetMinutes: 900,
      zUnknown: true
    },
    capabilities: {
      hasGps: 'unknown',
      hasHeartRate: false,
      hasPower: false,
      hasCadence: false,
      hasLaps: false,
      aUnknown: true
    },
    aUnknown: true
  };

  const result = validateCanonicalActivity(activity);
  assert.deepEqual([...result.errors].sort(compareItems), result.errors);
  assert.deepEqual([...result.warnings].sort(compareItems), result.warnings);
  assert.ok(result.errors.length > 1);
  assert.ok(result.warnings.length > 1);
});

test('repeated validation produces deeply equal results', () => {
  const activity = {
    schemaVersion: 3,
    id: '',
    sportCategory: 'unsupported',
    sportVariant: null,
    startTimeUtc: 'invalid',
    timeZone: { ianaName: null, utcOffsetMinutes: null },
    capabilities: {
      hasGps: 'unknown',
      hasHeartRate: false,
      hasPower: false,
      hasCadence: false,
      hasLaps: false
    }
  };

  assert.deepEqual(
    validateCanonicalActivity(activity),
    validateCanonicalActivity(activity)
  );
});

test('validation messages never echo invalid actual values', () => {
  const sensitiveMarker = 'SENSITIVE-ACTUAL-VALUE-DO-NOT-ECHO';
  const result = validateCanonicalActivity(
    validActivity({
      id: '',
      sportCategory: sensitiveMarker,
      startTimeUtc: sensitiveMarker,
      averageHeartRateBpm: 999
    })
  );

  assert.equal(JSON.stringify(result).includes(sensitiveMarker), false);
});

test('stable codes cover unsupported versions, IDs, and unknown fields', () => {
  const result = validateCanonicalActivity(
    validActivity({
      schemaVersion: 2,
      id: '',
      unexpected: true
    })
  );

  assert.ok(
    result.errors.some((item) => item.code === 'VERSION_UNSUPPORTED')
  );
  assert.ok(result.errors.some((item) => item.code === 'ID_INVALID'));
  assert.ok(
    result.warnings.some((item) => item.code === 'UNKNOWN_FIELD')
  );
});

test('ordinary invalid inputs return results without throwing', async (t) => {
  const inputs = [
    undefined,
    null,
    true,
    false,
    0,
    1,
    '',
    'activity',
    [],
    new Date(0),
    new Map(),
    new Set()
  ];

  for (const input of inputs) {
    await t.test(
      input === null ? 'null' : typeof input,
      () => {
        let result;
        assert.doesNotThrow(() => {
          result = validateCanonicalActivity(input);
        });
        assert.equal(result.ok, false);
        assertStandardResult(result);
      }
    );
  }
});

test('throwing reflection proxies fail closed without leaking exceptions', () => {
  const privateExceptionMessage = 'PRIVATE_PROXY_EXCEPTION_MESSAGE';
  const proxy = new Proxy(validActivity(), {
    getPrototypeOf() {
      throw new Error(privateExceptionMessage);
    }
  });

  let first;
  let second;
  assert.doesNotThrow(() => {
    first = validateCanonicalActivity(proxy);
    second = validateCanonicalActivity(proxy);
  });

  assertStandardResult(first);
  assert.equal(first.ok, false);
  assert.deepEqual(first, second);
  assert.equal(JSON.stringify(first).includes(privateExceptionMessage), false);
});

test('ownKeys and descriptor proxy failures return JSON_UNSAFE results', async (t) => {
  const cases = [
    {
      label: 'ownKeys trap',
      handler: {
        ownKeys() {
          throw new Error('OWN_KEYS_PRIVATE_EXCEPTION');
        }
      },
      privateMessage: 'OWN_KEYS_PRIVATE_EXCEPTION'
    },
    {
      label: 'getOwnPropertyDescriptor trap',
      handler: {
        getOwnPropertyDescriptor() {
          throw new Error('DESCRIPTOR_PRIVATE_EXCEPTION');
        }
      },
      privateMessage: 'DESCRIPTOR_PRIVATE_EXCEPTION'
    }
  ];

  for (const testCase of cases) {
    await t.test(testCase.label, () => {
      const proxy = new Proxy(validActivity(), testCase.handler);
      let result;
      assert.doesNotThrow(() => {
        result = validateCanonicalActivity(proxy);
      });
      assertStandardResult(result);
      assert.equal(result.ok, false);
      assert.ok(result.errors.some((item) => item.code === 'JSON_UNSAFE'));
      assert.equal(
        JSON.stringify(result).includes(testCase.privateMessage),
        false
      );
    });
  }
});

test('revoked proxies fail closed with deterministic standard results', () => {
  const revocable = Proxy.revocable(validActivity(), {});
  revocable.revoke();

  let first;
  let second;
  assert.doesNotThrow(() => {
    first = validateCanonicalActivity(revocable.proxy);
    second = validateCanonicalActivity(revocable.proxy);
  });

  assertStandardResult(first);
  assert.equal(first.ok, false);
  assert.deepEqual(first, second);
  assert.equal(JSON.stringify(first).includes('revoked'), false);
});
