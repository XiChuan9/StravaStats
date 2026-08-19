import assert from 'node:assert/strict';
import test from 'node:test';

import {
  validateCanonicalStreamSet
} from '../../js/data/contracts/index.js';

function streamSet(series = [], overrides = {}) {
  return {
    activityId: 'synthetic-activity',
    series,
    ...overrides
  };
}

function numericSeries(overrides = {}) {
  return {
    streamType: 'distance',
    unit: 'meters',
    offsetsSeconds: [0, 1, 2],
    values: [0, null, 12.5],
    ...overrides
  };
}

function hasItem(result, collection, code, path) {
  return result[collection].some(
    (item) => item.code === code && item.path === path
  );
}

function compareItems(left, right) {
  if (left.path !== right.path) return left.path < right.path ? -1 : 1;
  if (left.code !== right.code) return left.code < right.code ? -1 : 1;
  if (left.message !== right.message) {
    return left.message < right.message ? -1 : 1;
  }
  return 0;
}

function deepFreeze(value) {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value)) deepFreeze(child);
  }
  return value;
}

test('accepts an empty summary-only CanonicalStreamSet', () => {
  assert.deepEqual(validateCanonicalStreamSet(streamSet()), {
    ok: true,
    errors: [],
    warnings: []
  });
});

test('accepts numeric, moving, and position streams', () => {
  const value = streamSet([
    numericSeries(),
    {
      streamType: 'moving',
      unit: 'boolean',
      offsetsSeconds: [0, 2],
      values: [true, null]
    },
    {
      streamType: 'position',
      unit: 'wgs84',
      offsetsSeconds: [0, 4],
      values: [[12.5, 34.5], null]
    }
  ]);

  assert.equal(validateCanonicalStreamSet(value).ok, true);
});

test('supports independent series timelines', () => {
  const value = streamSet([
    numericSeries({
      streamType: 'altitude',
      unit: 'meters',
      offsetsSeconds: [0, 5],
      values: [-12, 25]
    }),
    numericSeries({
      streamType: 'temperature',
      unit: 'celsius',
      offsetsSeconds: [1, 9, 20, 40],
      values: [-5, 0, 12, null]
    })
  ]);

  assert.equal(validateCanonicalStreamSet(value).ok, true);
});

test('preserves null and real zero points without normalization', () => {
  const value = streamSet([numericSeries()]);
  const before = structuredClone(value);

  const result = validateCanonicalStreamSet(value);

  assert.equal(result.ok, true);
  assert.deepEqual(value, before);
  assert.equal(value.series[0].values[0], 0);
  assert.equal(value.series[0].values[1], null);
  assert.equal('value' in result, false);
});

test('requires each present series to be non-empty', async (t) => {
  for (const [offsetsSeconds, values] of [
    [[], []],
    [[], [1]],
    [[0], []]
  ]) {
    await t.test(`${offsetsSeconds.length}/${values.length}`, () => {
      const result = validateCanonicalStreamSet(
        streamSet([numericSeries({ offsetsSeconds, values })])
      );
      assert.equal(result.ok, false);
      assert.ok(
        result.errors.some(
          (item) =>
            item.code === 'VALUE_INVALID' ||
            item.code === 'LENGTH_MISMATCH'
        )
      );
    });
  }
});

test('reports offset and value length mismatch', () => {
  const result = validateCanonicalStreamSet(
    streamSet([
      numericSeries({
        offsetsSeconds: [0, 1],
        values: [0]
      })
    ])
  );

  assert.ok(
    hasItem(
      result,
      'errors',
      'LENGTH_MISMATCH',
      '/streams/series/0/values'
    )
  );
});

test('rejects negative and decreasing offsets', () => {
  const result = validateCanonicalStreamSet(
    streamSet([
      numericSeries({
        offsetsSeconds: [-1, 2, 1],
        values: [1, 2, 3]
      })
    ])
  );

  assert.ok(
    hasItem(
      result,
      'errors',
      'RANGE_INVALID',
      '/streams/series/0/offsetsSeconds/0'
    )
  );
  assert.ok(
    hasItem(
      result,
      'errors',
      'ORDER_INVALID',
      '/streams/series/0/offsetsSeconds/2'
    )
  );
});

test('emits one duplicate timestamp warning for every repeated position', () => {
  const result = validateCanonicalStreamSet(
    streamSet([
      numericSeries({
        offsetsSeconds: [0, 0, 0],
        values: [1, 2, 3]
      })
    ])
  );

  assert.equal(result.ok, true);
  assert.deepEqual(
    result.warnings.map(({ code, path }) => ({ code, path })),
    [
      {
        code: 'DUPLICATE_TIMESTAMP',
        path: '/streams/series/0/offsetsSeconds/1'
      },
      {
        code: 'DUPLICATE_TIMESTAMP',
        path: '/streams/series/0/offsetsSeconds/2'
      }
    ]
  );
});

test('requires unique stream types without reordering input', () => {
  const value = streamSet([
    numericSeries(),
    numericSeries({ unit: 'kilometers' })
  ]);
  const before = structuredClone(value);
  const result = validateCanonicalStreamSet(value);

  assert.ok(
    hasItem(
      result,
      'errors',
      'DUPLICATE_VALUE',
      '/streams/series/1/streamType'
    )
  );
  assert.deepEqual(value, before);
});

test('moving streams require boolean unit and boolean or null values', () => {
  const result = validateCanonicalStreamSet(
    streamSet([
      {
        streamType: 'moving',
        unit: 'number',
        offsetsSeconds: [0, 1, 2],
        values: [true, 1, null]
      }
    ])
  );

  assert.ok(
    hasItem(
      result,
      'errors',
      'VALUE_INVALID',
      '/streams/series/0/unit'
    )
  );
  assert.ok(
    hasItem(
      result,
      'errors',
      'TYPE_INVALID',
      '/streams/series/0/values/1'
    )
  );
});

test('position streams require wgs84 two-number tuples', async (t) => {
  const cases = [
    {
      value: [1],
      code: 'TYPE_INVALID',
      path: '/streams/series/0/values/0'
    },
    {
      value: { latitude: 1, longitude: 2 },
      code: 'TYPE_INVALID',
      path: '/streams/series/0/values/0'
    },
    {
      value: [91, 0],
      code: 'RANGE_INVALID',
      path: '/streams/series/0/values/0/0'
    },
    {
      value: [0, -181],
      code: 'RANGE_INVALID',
      path: '/streams/series/0/values/0/1'
    },
    {
      value: [NaN, 0],
      code: 'NUMBER_INVALID',
      path: '/streams/series/0/values/0/0'
    }
  ];

  for (const testCase of cases) {
    await t.test(testCase.path, () => {
      const result = validateCanonicalStreamSet(
        streamSet([
          {
            streamType: 'position',
            unit: 'wgs84',
            offsetsSeconds: [0],
            values: [testCase.value]
          }
        ])
      );
      assert.ok(
        hasItem(
          result,
          'errors',
          testCase.code,
          testCase.path
        )
      );
    });
  }

  const badUnit = validateCanonicalStreamSet(
    streamSet([
      {
        streamType: 'position',
        unit: 'degrees',
        offsetsSeconds: [0],
        values: [[0, 0]]
      }
    ])
  );
  assert.ok(
    hasItem(
      badUnit,
      'errors',
      'VALUE_INVALID',
      '/streams/series/0/unit'
    )
  );
});

test('rejects non-finite numeric stream values', async (t) => {
  for (const value of [NaN, Infinity, -Infinity, '1', true]) {
    await t.test(String(value), () => {
      const result = validateCanonicalStreamSet(
        streamSet([
          numericSeries({
            offsetsSeconds: [0],
            values: [value]
          })
        ])
      );
      assert.ok(
        hasItem(
          result,
          'errors',
          'NUMBER_INVALID',
          '/streams/series/0/values/0'
        )
      );
    });
  }
});

test('enforces heart-rate and non-negative stream bounds', async (t) => {
  const cases = [
    ['heartRate', 0],
    ['heartRate', 301],
    ['distance', -1],
    ['power', -1],
    ['cadence', -1]
  ];
  for (const [streamType, value] of cases) {
    await t.test(`${streamType}/${value}`, () => {
      const result = validateCanonicalStreamSet(
        streamSet([
          numericSeries({
            streamType,
            offsetsSeconds: [0],
            values: [value]
          })
        ])
      );
      assert.ok(
        hasItem(
          result,
          'errors',
          'RANGE_INVALID',
          '/streams/series/0/values/0'
        )
      );
    });
  }
});

test('allows negative altitude and temperature without hard maxima', () => {
  const result = validateCanonicalStreamSet(
    streamSet([
      numericSeries({
        streamType: 'altitude',
        offsetsSeconds: [0],
        values: [-500]
      }),
      numericSeries({
        streamType: 'temperature',
        unit: 'celsius',
        offsetsSeconds: [0],
        values: [-40]
      }),
      numericSeries({
        streamType: 'synthetic-open-number',
        unit: 'arbitrary',
        offsetsSeconds: [0],
        values: [1e100]
      })
    ])
  );

  assert.equal(result.ok, true);
});

test('accepts absent, null, and JSON-safe quality objects without key warnings', () => {
  const result = validateCanonicalStreamSet(
    streamSet([
      numericSeries(),
      numericSeries({
        streamType: 'power',
        quality: null
      }),
      numericSeries({
        streamType: 'cadence',
        quality: {
          confidence: 0,
          flags: [null, false, 'synthetic']
        }
      })
    ])
  );

  assert.deepEqual(result, { ok: true, errors: [], warnings: [] });
});

test('rejects non-plain or non-JSON-safe quality', async (t) => {
  for (const quality of [[], new Date(0), { nested: undefined }]) {
    await t.test(Object.prototype.toString.call(quality), () => {
      const result = validateCanonicalStreamSet(
        streamSet([numericSeries({ quality })])
      );
      assert.equal(result.ok, false);
      assert.ok(
        result.errors.some(
          (item) =>
            item.code === 'TYPE_INVALID' ||
            item.code === 'JSON_UNSAFE'
        )
      );
    });
  }
});

test('warns for unknown StreamSet and StreamSeries fields', () => {
  const value = streamSet(
    [numericSeries({ 'series~/extra': true })],
    { 'set~/extra': true }
  );
  const result = validateCanonicalStreamSet(value);

  assert.deepEqual(
    result.warnings.map((item) => item.path),
    [
      '/streams/series/0/series~0~1extra',
      '/streams/set~0~1extra'
    ]
  );
});

test('rejects missing required fields and invalid array shapes', () => {
  const missing = validateCanonicalStreamSet({});
  assert.ok(
    hasItem(
      missing,
      'errors',
      'REQUIRED_FIELD_MISSING',
      '/streams/activityId'
    )
  );
  assert.ok(
    hasItem(
      missing,
      'errors',
      'REQUIRED_FIELD_MISSING',
      '/streams/series'
    )
  );

  const invalid = validateCanonicalStreamSet(
    streamSet({ not: 'an array' })
  );
  assert.ok(
    hasItem(
      invalid,
      'errors',
      'TYPE_INVALID',
      '/streams/series'
    )
  );
});

test('validates deeply frozen input without mutation', () => {
  const value = deepFreeze(
    streamSet([
      numericSeries({
        quality: { flags: [false, null] }
      })
    ])
  );

  assert.doesNotThrow(() => validateCanonicalStreamSet(value));
  assert.equal(validateCanonicalStreamSet(value).ok, true);
});

test('never executes top-level or nested accessors', async (t) => {
  const cases = [
    {
      label: 'top-level series',
      create() {
        return streamSet();
      },
      target(value) {
        return value;
      },
      field: 'series',
      path: '/streams/series'
    },
    {
      label: 'series values',
      create() {
        return streamSet([numericSeries()]);
      },
      target(value) {
        return value.series[0];
      },
      field: 'values',
      path: '/streams/series/0/values'
    },
    {
      label: 'quality nested',
      create() {
        return streamSet([
          numericSeries({ quality: { confidence: 1 } })
        ]);
      },
      target(value) {
        return value.series[0].quality;
      },
      field: 'confidence',
      path: '/streams/series/0/quality/confidence'
    }
  ];

  for (const testCase of cases) {
    await t.test(testCase.label, () => {
      const value = testCase.create();
      const target = testCase.target(value);
      let getterCalls = 0;
      Object.defineProperty(target, testCase.field, {
        enumerable: true,
        get() {
          getterCalls += 1;
          throw new Error('STREAM_GETTER_EXECUTED');
        }
      });

      let result;
      assert.doesNotThrow(() => {
        result = validateCanonicalStreamSet(value);
      });
      assert.equal(getterCalls, 0);
      assert.ok(
        hasItem(result, 'errors', 'JSON_UNSAFE', testCase.path)
      );
      assert.equal(
        JSON.stringify(result).includes('STREAM_GETTER_EXECUTED'),
        false
      );
    });
  }
});

test('fails closed on non-enumerable fields', () => {
  const value = streamSet();
  Object.defineProperty(value, 'series', {
    enumerable: false,
    value: []
  });

  const result = validateCanonicalStreamSet(value);
  assert.ok(
    hasItem(result, 'errors', 'JSON_UNSAFE', '/streams/series')
  );
});

test('revoked and throwing reflection proxies fail closed', async (t) => {
  await t.test('revoked proxy', () => {
    const revocable = Proxy.revocable(streamSet(), {});
    revocable.revoke();
    let result;
    assert.doesNotThrow(() => {
      result = validateCanonicalStreamSet(revocable.proxy);
    });
    assert.equal(result.ok, false);
    assert.equal(JSON.stringify(result).includes('revoked'), false);
  });

  await t.test('nested ownKeys trap', () => {
    const privateMessage = 'STREAM_PRIVATE_PROXY_MESSAGE';
    const value = streamSet([
      new Proxy(numericSeries(), {
        ownKeys() {
          throw new Error(privateMessage);
        }
      })
    ]);
    let result;
    assert.doesNotThrow(() => {
      result = validateCanonicalStreamSet(value);
    });
    assert.equal(result.ok, false);
    assert.ok(result.errors.some((item) => item.code === 'JSON_UNSAFE'));
    assert.equal(JSON.stringify(result).includes(privateMessage), false);
  });
});

test('errors and warnings have stable ordering and repeatable results', () => {
  const value = streamSet(
    [
      numericSeries({
        offsetsSeconds: [2, 1, 1],
        values: [-1, -2]
      }),
      numericSeries()
    ],
    { zUnknown: true, aUnknown: true }
  );

  const first = validateCanonicalStreamSet(value);
  const second = validateCanonicalStreamSet(value);
  assert.deepEqual(first, second);
  assert.deepEqual([...first.errors].sort(compareItems), first.errors);
  assert.deepEqual([...first.warnings].sort(compareItems), first.warnings);
});

test('valid streams survive structuredClone and JSON round-trip', () => {
  const value = streamSet([
    numericSeries({
      quality: { synthetic: [0, null, false] }
    }),
    {
      streamType: 'position',
      unit: 'wgs84',
      offsetsSeconds: [0],
      values: [[0, 0]]
    }
  ]);

  const cloned = structuredClone(value);
  const roundTripped = JSON.parse(JSON.stringify(value));
  assert.deepEqual(cloned, value);
  assert.deepEqual(roundTripped, value);
  assert.equal(validateCanonicalStreamSet(cloned).ok, true);
  assert.equal(validateCanonicalStreamSet(roundTripped).ok, true);
});
