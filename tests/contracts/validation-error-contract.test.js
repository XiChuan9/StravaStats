import assert from 'node:assert/strict';
import test from 'node:test';

import * as publicApi from '../../js/data/contracts/index.js';

const {
  validateCanonicalActivity,
  validateCanonicalStreamSet,
  validateImportedActivityBundle
} = publicApi;

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

function validStreamSet(overrides = {}) {
  return {
    activityId: 'validation-contract',
    series: [],
    ...overrides
  };
}

function validBundle(overrides = {}) {
  return {
    schemaVersion: 1,
    activity: validActivity({ elapsedTimeSeconds: 60 }),
    streams: validStreamSet(),
    laps: [],
    events: [],
    sources: [
      {
        id: 'validation-source',
        activityId: 'validation-contract',
        provider: 'synthetic-provider',
        acquisitionMethod: 'synthetic-test',
        importedAt: '2026-01-02T03:04:05.006Z'
      }
    ],
    devices: [],
    warnings: [],
    versionMetadata: {
      schemaVersion: 1
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

test('public index exports exactly the three B2 validators', () => {
  assert.deepEqual(Object.keys(publicApi), [
    'validateCanonicalActivity',
    'validateCanonicalStreamSet',
    'validateImportedActivityBundle'
  ]);
  assert.equal(typeof validateCanonicalActivity, 'function');
  assert.equal(typeof validateCanonicalStreamSet, 'function');
  assert.equal(typeof validateImportedActivityBundle, 'function');
});

test('all validator result and item shapes are stable and minimal', () => {
  const results = [
    validateCanonicalActivity({ unknown: true }),
    validateCanonicalStreamSet({ unknown: true }),
    validateImportedActivityBundle({ unknown: true })
  ];

  for (const result of results) {
    assertStandardResult(result);

    for (const item of [...result.errors, ...result.warnings]) {
      assert.deepEqual(Object.keys(item), ['code', 'path', 'message']);
      assert.equal(typeof item.code, 'string');
      assert.equal(typeof item.path, 'string');
      assert.equal(typeof item.message, 'string');
    }
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

  const streamsResult = validateCanonicalStreamSet({
    activityId: sensitiveMarker,
    series: [
      {
        streamType: sensitiveMarker,
        unit: '',
        offsetsSeconds: [0],
        values: [sensitiveMarker]
      }
    ]
  });
  assert.equal(
    JSON.stringify(streamsResult).includes(sensitiveMarker),
    false
  );

  const value = validBundle();
  value.sources[0].deviceId = sensitiveMarker;
  const bundleResult = validateImportedActivityBundle(value);
  assert.equal(
    JSON.stringify(bundleResult).includes(sensitiveMarker),
    false
  );
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

test('B2 stable codes are emitted with their approved severity', () => {
  const streamResult = validateCanonicalStreamSet({
    activityId: 'validation-contract',
    series: [
      {
        streamType: 'distance',
        unit: 'meters',
        offsetsSeconds: [1, 1],
        values: [1]
      },
      {
        streamType: 'distance',
        unit: 'meters',
        offsetsSeconds: [0],
        values: [1]
      }
    ]
  });
  assert.ok(
    streamResult.errors.some(
      (item) => item.code === 'DUPLICATE_VALUE'
    )
  );
  assert.ok(
    streamResult.errors.some(
      (item) => item.code === 'LENGTH_MISMATCH'
    )
  );
  assert.ok(
    streamResult.warnings.some(
      (item) => item.code === 'DUPLICATE_TIMESTAMP'
    )
  );

  const value = validBundle({
    schemaVersion: 2,
    versionMetadata: { schemaVersion: 1 }
  });
  value.activity.schemaVersion = 2;
  value.activity.capabilities.hasGps = false;
  value.streams.series = [
    {
      streamType: 'position',
      unit: 'wgs84',
      offsetsSeconds: [0],
      values: [[0, 0]]
    }
  ];
  value.laps = [
    {
      id: 'lap',
      activityId: 'validation-contract',
      index: 0,
      startOffsetSeconds: 10,
      elapsedTimeSeconds: 20
    },
    {
      id: 'lap',
      activityId: 'other',
      index: 0,
      startOffsetSeconds: 5,
      elapsedTimeSeconds: 10
    }
  ];
  value.events = [
    {
      id: 'event',
      activityId: 'validation-contract',
      index: 0,
      type: 'pause',
      offsetSeconds: 0
    }
  ];
  const bundleResult = validateImportedActivityBundle(value);
  const codes = new Set(bundleResult.errors.map((item) => item.code));
  for (const code of [
    'CAPABILITY_CONFLICT',
    'DUPLICATE_VALUE',
    'ORDER_INVALID',
    'REFERENCE_INVALID',
    'STATE_INVALID'
  ]) {
    assert.ok(codes.has(code), code);
  }
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

test('all three validators fail closed for ordinary invalid inputs', async (t) => {
  const validators = [
    validateCanonicalActivity,
    validateCanonicalStreamSet,
    validateImportedActivityBundle
  ];
  for (const validator of validators) {
    await t.test(validator.name, () => {
      for (const input of [
        undefined,
        null,
        0,
        '',
        [],
        new Date(0)
      ]) {
        let result;
        assert.doesNotThrow(() => {
          result = validator(input);
        });
        assertStandardResult(result);
        assert.equal(result.ok, false);
      }
    });
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
