import assert from 'node:assert/strict';
import test from 'node:test';

import {
  validateImportedActivityBundle
} from '../../js/data/contracts/index.js';

const ACTIVITY_ID = 'synthetic-bundle-activity';

function activity(overrides = {}) {
  return {
    schemaVersion: 1,
    id: ACTIVITY_ID,
    sportCategory: 'run',
    sportVariant: null,
    startTimeUtc: '2026-02-03T04:05:06.007Z',
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
    elapsedTimeSeconds: 120,
    ...overrides
  };
}

function source(overrides = {}) {
  return {
    id: 'synthetic-source',
    activityId: ACTIVITY_ID,
    provider: 'synthetic-provider',
    acquisitionMethod: 'synthetic-import',
    importedAt: '2026-02-03T04:05:06.007Z',
    ...overrides
  };
}

function bundle(overrides = {}) {
  return {
    schemaVersion: 1,
    activity: activity(),
    streams: {
      activityId: ACTIVITY_ID,
      series: []
    },
    laps: [],
    events: [],
    sources: [source()],
    devices: [],
    warnings: [],
    versionMetadata: {
      schemaVersion: 1
    },
    ...overrides
  };
}

function lap(index, startOffsetSeconds, elapsedTimeSeconds, overrides = {}) {
  return {
    id: `synthetic-lap-${index}`,
    activityId: ACTIVITY_ID,
    index,
    startOffsetSeconds,
    elapsedTimeSeconds,
    ...overrides
  };
}

function event(index, type, offsetSeconds, overrides = {}) {
  return {
    id: `synthetic-event-${index}`,
    activityId: ACTIVITY_ID,
    index,
    type,
    offsetSeconds,
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

test('accepts a minimal summary-only ImportedActivityBundle', () => {
  assert.deepEqual(validateImportedActivityBundle(bundle()), {
    ok: true,
    errors: [],
    warnings: []
  });
});

test('accepts a complete synthetic bundle', () => {
  const value = bundle({
    activity: activity({
      capabilities: {
        hasGps: true,
        hasHeartRate: true,
        hasPower: true,
        hasCadence: true,
        hasLaps: true
      }
    }),
    streams: {
      activityId: ACTIVITY_ID,
      series: [
        {
          streamType: 'position',
          unit: 'wgs84',
          offsetsSeconds: [0, 60],
          values: [[1, 2], null]
        },
        {
          streamType: 'heartRate',
          unit: 'bpm',
          offsetsSeconds: [0, 60],
          values: [120, 140]
        },
        {
          streamType: 'power',
          unit: 'watts',
          offsetsSeconds: [0],
          values: [200]
        },
        {
          streamType: 'cadence',
          unit: 'rpm',
          offsetsSeconds: [0],
          values: [80]
        }
      ]
    },
    laps: [
      lap(0, 0, 60, {
        movingTimeSeconds: 55,
        distanceMeters: 500
      }),
      lap(1, 60, 60)
    ],
    events: [
      event(0, 'start', 0),
      event(1, 'marker', 20),
      event(2, 'pause', 30),
      event(3, 'unknown', 30, {
        sourceType: 'synthetic-provider-event'
      }),
      event(4, 'resume', 40),
      event(5, 'stop', 120)
    ],
    sources: [
      source({
        externalId: 'synthetic-external',
        rawArtifactId: 'synthetic-artifact',
        deviceId: 'synthetic-device'
      })
    ],
    devices: [
      {
        id: 'synthetic-device',
        manufacturer: 'synthetic-maker',
        model: 'synthetic-model'
      }
    ],
    warnings: [
      {
        code: 'SYNTHETIC_WARNING',
        path: '/synthetic',
        message: 'Synthetic warning content.'
      }
    ],
    versionMetadata: {
      schemaVersion: 1,
      parserVersion: 'parser-v1',
      normalizerVersion: 'normalizer-v1',
      analysisVersion: null,
      settingsVersion: 'settings-v1',
      inputHash: null
    }
  });

  assert.equal(validateImportedActivityBundle(value).ok, true);
});

test('requires all nine top-level bundle fields', async (t) => {
  for (const field of [
    'schemaVersion',
    'activity',
    'streams',
    'laps',
    'events',
    'sources',
    'devices',
    'warnings',
    'versionMetadata'
  ]) {
    await t.test(field, () => {
      const value = bundle();
      delete value[field];
      const result = validateImportedActivityBundle(value);
      assert.ok(
        hasItem(
          result,
          'errors',
          'REQUIRED_FIELD_MISSING',
          `/${field}`
        )
      );
    });
  }
});

test('requires at least one ActivitySource', () => {
  const result = validateImportedActivityBundle(
    bundle({ sources: [] })
  );
  assert.ok(
    hasItem(result, 'errors', 'VALUE_INVALID', '/sources')
  );
});

test('validates all activity references', async (t) => {
  const cases = [
    {
      field: 'streams',
      value(value) {
        value.streams.activityId = 'other-activity';
      },
      path: '/streams/activityId'
    },
    {
      field: 'lap',
      value(value) {
        value.laps = [
          lap(0, 0, 10, { activityId: 'other-activity' })
        ];
        value.activity.capabilities.hasLaps = true;
      },
      path: '/laps/0/activityId'
    },
    {
      field: 'event',
      value(value) {
        value.events = [
          event(0, 'marker', 0, { activityId: 'other-activity' })
        ];
      },
      path: '/events/0/activityId'
    },
    {
      field: 'source',
      value(value) {
        value.sources[0].activityId = 'other-activity';
      },
      path: '/sources/0/activityId'
    }
  ];

  for (const testCase of cases) {
    await t.test(testCase.field, () => {
      const value = bundle();
      testCase.value(value);
      const result = validateImportedActivityBundle(value);
      assert.ok(
        hasItem(
          result,
          'errors',
          'REFERENCE_INVALID',
          testCase.path
        )
      );
    });
  }
});

test('rejects duplicate IDs and indexes within each object type', () => {
  const value = bundle({
    activity: activity({
      capabilities: {
        hasGps: false,
        hasHeartRate: false,
        hasPower: false,
        hasCadence: false,
        hasLaps: true
      }
    }),
    laps: [
      lap(0, 0, 10),
      lap(0, 10, 10, { id: 'synthetic-lap-0' })
    ],
    events: [
      event(0, 'marker', 0),
      event(0, 'marker', 1, { id: 'synthetic-event-0' })
    ],
    sources: [source(), source()],
    devices: [
      { id: 'synthetic-device' },
      { id: 'synthetic-device' }
    ]
  });
  const result = validateImportedActivityBundle(value);

  for (const path of [
    '/laps/1/id',
    '/laps/1/index',
    '/events/1/id',
    '/events/1/index',
    '/sources/1/id',
    '/devices/1/id'
  ]) {
    assert.ok(
      hasItem(result, 'errors', 'DUPLICATE_VALUE', path),
      path
    );
  }
});

test('enforces Lap order, non-overlap, duration, and moving-time bounds', () => {
  const value = bundle({
    activity: activity({
      elapsedTimeSeconds: 30,
      capabilities: {
        hasGps: false,
        hasHeartRate: false,
        hasPower: false,
        hasCadence: false,
        hasLaps: true
      }
    }),
    laps: [
      lap(0, 10, 15),
      lap(1, 5, 40, { movingTimeSeconds: 41 })
    ]
  });
  const result = validateImportedActivityBundle(value);

  assert.ok(
    hasItem(
      result,
      'errors',
      'ORDER_INVALID',
      '/laps/1/startOffsetSeconds'
    )
  );
  assert.ok(
    hasItem(
      result,
      'errors',
      'RELATION_INVALID',
      '/laps/1/elapsedTimeSeconds'
    )
  );
  assert.ok(
    hasItem(
      result,
      'errors',
      'RELATION_INVALID',
      '/laps/1/movingTimeSeconds'
    )
  );
});

test('detects Lap overlap in otherwise ordered input', () => {
  const value = bundle({
    activity: activity({
      capabilities: {
        hasGps: false,
        hasHeartRate: false,
        hasPower: false,
        hasCadence: false,
        hasLaps: true
      }
    }),
    laps: [lap(0, 0, 20), lap(1, 10, 10)]
  });
  const result = validateImportedActivityBundle(value);

  assert.ok(
    hasItem(
      result,
      'errors',
      'ORDER_INVALID',
      '/laps/1/startOffsetSeconds'
    )
  );
});

test('accepts same-offset events and valid core transitions', () => {
  const value = bundle({
    events: [
      event(0, 'start', 0),
      event(1, 'marker', 0),
      event(2, 'pause', 10),
      event(3, 'unknown', 10, { sourceType: 'synthetic-unknown' }),
      event(4, 'resume', 10),
      event(5, 'stop', 20)
    ]
  });

  assert.equal(validateImportedActivityBundle(value).ok, true);
});

test('rejects Event order, bounds, and invalid state transitions', () => {
  const value = bundle({
    activity: activity({ elapsedTimeSeconds: 20 }),
    events: [
      event(0, 'pause', 5),
      event(1, 'start', 4),
      event(2, 'stop', 21),
      event(3, 'resume', 21)
    ]
  });
  const result = validateImportedActivityBundle(value);

  assert.ok(
    hasItem(result, 'errors', 'STATE_INVALID', '/events/0/type')
  );
  assert.ok(
    hasItem(
      result,
      'errors',
      'ORDER_INVALID',
      '/events/1/offsetSeconds'
    )
  );
  assert.ok(
    hasItem(
      result,
      'errors',
      'RELATION_INVALID',
      '/events/2/offsetSeconds'
    )
  );
  assert.ok(
    hasItem(result, 'errors', 'STATE_INVALID', '/events/3/type')
  );
});

test('requires sourceType for unknown events and preserves them', () => {
  const value = bundle({
    events: [event(0, 'unknown', 0)]
  });
  const before = structuredClone(value);
  const result = validateImportedActivityBundle(value);

  assert.ok(
    hasItem(
      result,
      'errors',
      'REQUIRED_FIELD_MISSING',
      '/events/0/sourceType'
    )
  );
  assert.deepEqual(value, before);
  assert.equal(value.events.length, 1);
});

test('rejects provider event enums instead of branching on providers', () => {
  const privateEnum = 'PRIVATE_PROVIDER_EVENT_ENUM';
  const result = validateImportedActivityBundle(
    bundle({ events: [event(0, privateEnum, 0)] })
  );

  assert.ok(
    hasItem(result, 'errors', 'VALUE_INVALID', '/events/0/type')
  );
  assert.equal(JSON.stringify(result).includes(privateEnum), false);
});

test('validates ActivitySource fields and fixed-millisecond importedAt', () => {
  const value = bundle({
    sources: [
      source({
        provider: '',
        acquisitionMethod: '',
        externalId: 1,
        rawArtifactId: '',
        importedAt: '2026-02-03T04:05:06Z'
      })
    ]
  });
  const result = validateImportedActivityBundle(value);

  assert.ok(
    hasItem(
      result,
      'errors',
      'VALUE_INVALID',
      '/sources/0/provider'
    )
  );
  assert.ok(
    hasItem(
      result,
      'errors',
      'VALUE_INVALID',
      '/sources/0/acquisitionMethod'
    )
  );
  assert.ok(
    hasItem(result, 'errors', 'ID_INVALID', '/sources/0/externalId')
  );
  assert.ok(
    hasItem(
      result,
      'errors',
      'ID_INVALID',
      '/sources/0/rawArtifactId'
    )
  );
  assert.ok(
    hasItem(
      result,
      'errors',
      'TIMESTAMP_INVALID',
      '/sources/0/importedAt'
    )
  );
});

test('validates DeviceReference and source device references', async (t) => {
  await t.test('broken reference', () => {
    const value = bundle({
      sources: [source({ deviceId: 'missing-device' })]
    });
    const result = validateImportedActivityBundle(value);
    assert.ok(
      hasItem(
        result,
        'errors',
        'REFERENCE_INVALID',
        '/sources/0/deviceId'
      )
    );
  });

  await t.test('valid synthetic reference', () => {
    const value = bundle({
      sources: [source({ deviceId: 'synthetic-device' })],
      devices: [
        {
          id: 'synthetic-device',
          manufacturer: null,
          model: 'synthetic-model'
        }
      ]
    });
    assert.equal(validateImportedActivityBundle(value).ok, true);
  });

  await t.test('invalid optional metadata', () => {
    const value = bundle({
      devices: [
        {
          id: 'synthetic-device',
          manufacturer: 1,
          model: false
        }
      ]
    });
    const result = validateImportedActivityBundle(value);
    assert.ok(
      hasItem(
        result,
        'errors',
        'TYPE_INVALID',
        '/devices/0/manufacturer'
      )
    );
    assert.ok(
      hasItem(
        result,
        'errors',
        'TYPE_INVALID',
        '/devices/0/model'
      )
    );
  });
});

test('accepts all six VersionMetadata fields', () => {
  const value = bundle({
    versionMetadata: {
      schemaVersion: 1,
      parserVersion: 'parser-v1',
      normalizerVersion: null,
      analysisVersion: 'analysis-v1',
      settingsVersion: null,
      inputHash: 'synthetic-hash'
    }
  });

  assert.equal(validateImportedActivityBundle(value).ok, true);
});

test('rejects invalid optional version metadata strings', async (t) => {
  for (const field of [
    'parserVersion',
    'normalizerVersion',
    'analysisVersion',
    'settingsVersion',
    'inputHash'
  ]) {
    await t.test(field, () => {
      const value = bundle({
        versionMetadata: {
          schemaVersion: 1,
          [field]: ''
        }
      });
      const result = validateImportedActivityBundle(value);
      assert.ok(
        hasItem(
          result,
          'errors',
          'VALUE_INVALID',
          `/versionMetadata/${field}`
        )
      );
    });
  }
});

test('rejects unsupported and inconsistent schema versions', () => {
  const value = bundle({
    schemaVersion: 2,
    activity: activity({ schemaVersion: 1 }),
    versionMetadata: { schemaVersion: 3 }
  });
  const result = validateImportedActivityBundle(value);

  assert.ok(
    hasItem(
      result,
      'errors',
      'VERSION_UNSUPPORTED',
      '/schemaVersion'
    )
  );
  assert.ok(
    hasItem(
      result,
      'errors',
      'RELATION_INVALID',
      '/activity/schemaVersion'
    )
  );
  assert.ok(
    hasItem(
      result,
      'errors',
      'RELATION_INVALID',
      '/versionMetadata/schemaVersion'
    )
  );
});

test('rejects unsupported version 2 consistently across all layers', () => {
  const value = bundle({
    schemaVersion: 2,
    activity: activity({ schemaVersion: 2 }),
    versionMetadata: { schemaVersion: 2 }
  });
  const result = validateImportedActivityBundle(value);
  assert.equal(
    result.errors.filter(
      (item) => item.code === 'VERSION_UNSUPPORTED'
    ).length,
    3
  );
});

test('enforces false capabilities when corresponding detail exists', async (t) => {
  const cases = [
    ['position', 'hasGps'],
    ['heartRate', 'hasHeartRate'],
    ['power', 'hasPower'],
    ['cadence', 'hasCadence']
  ];
  for (const [streamType, capability] of cases) {
    await t.test(streamType, () => {
      const values =
        streamType === 'position' ? [[0, 0]] : [1];
      const unit =
        streamType === 'position' ? 'wgs84' : 'synthetic-unit';
      const value = bundle({
        streams: {
          activityId: ACTIVITY_ID,
          series: [
            {
              streamType,
              unit,
              offsetsSeconds: [0],
              values
            }
          ]
        }
      });
      const result = validateImportedActivityBundle(value);
      assert.ok(
        hasItem(
          result,
          'errors',
          'CAPABILITY_CONFLICT',
          `/activity/capabilities/${capability}`
        )
      );
    });
  }

  const laps = bundle({ laps: [lap(0, 0, 10)] });
  const lapsResult = validateImportedActivityBundle(laps);
  assert.ok(
    hasItem(
      lapsResult,
      'errors',
      'CAPABILITY_CONFLICT',
      '/activity/capabilities/hasLaps'
    )
  );
});

test('allows true capabilities with missing detail in summary-only bundles', () => {
  const value = bundle({
    activity: activity({
      capabilities: {
        hasGps: true,
        hasHeartRate: true,
        hasPower: true,
        hasCadence: true,
        hasLaps: true
      }
    })
  });

  assert.equal(validateImportedActivityBundle(value).ok, true);
});

test('validates bundle warning item shape separately from result warnings', () => {
  const value = bundle({
    warnings: [
      {
        code: 1,
        path: null,
        message: false,
        payload: 'must-remain-input-only'
      }
    ]
  });
  const before = structuredClone(value);
  const result = validateImportedActivityBundle(value);

  for (const field of ['code', 'path', 'message']) {
    assert.ok(
      hasItem(
        result,
        'errors',
        'TYPE_INVALID',
        `/warnings/0/${field}`
      )
    );
  }
  assert.ok(
    hasItem(
      result,
      'warnings',
      'UNKNOWN_FIELD',
      '/warnings/0/payload'
    )
  );
  assert.deepEqual(value, before);
  assert.equal(
    JSON.stringify(result).includes('must-remain-input-only'),
    false
  );
});

test('warns for unknown fields at every bundle level', () => {
  const value = bundle({ 'bundle~/extra': true });
  value.laps = [
    lap(0, 0, 10, { 'lap~/extra': true })
  ];
  value.activity.capabilities.hasLaps = true;
  value.events = [
    event(0, 'marker', 0, { 'event~/extra': true })
  ];
  value.sources[0]['source~/extra'] = true;
  value.devices = [
    { id: 'synthetic-device', 'device~/extra': true }
  ];
  value.versionMetadata['version~/extra'] = true;

  const result = validateImportedActivityBundle(value);
  assert.equal(result.ok, true);
  for (const path of [
    '/bundle~0~1extra',
    '/devices/0/device~0~1extra',
    '/events/0/event~0~1extra',
    '/laps/0/lap~0~1extra',
    '/sources/0/source~0~1extra',
    '/versionMetadata/version~0~1extra'
  ]) {
    assert.ok(
      hasItem(result, 'warnings', 'UNKNOWN_FIELD', path),
      path
    );
  }
});

test('merges child results with stable ordering and no duplicate items', () => {
  const value = bundle({
    schemaVersion: 2,
    activity: activity({
      schemaVersion: 2,
      id: '',
      zUnknown: true
    }),
    streams: {
      activityId: '',
      series: [
        {
          streamType: 'distance',
          unit: 'meters',
          offsetsSeconds: [1, 0],
          values: [-1]
        }
      ],
      aUnknown: true
    },
    sources: [],
    versionMetadata: { schemaVersion: 2 }
  });

  const first = validateImportedActivityBundle(value);
  const second = validateImportedActivityBundle(value);
  assert.deepEqual(first, second);
  assert.deepEqual([...first.errors].sort(compareItems), first.errors);
  assert.deepEqual([...first.warnings].sort(compareItems), first.warnings);
  const keys = [...first.errors, ...first.warnings].map(
    (item) => `${item.code}\0${item.path}\0${item.message}`
  );
  assert.equal(new Set(keys).size, keys.length);
});

test('does not mutate, sort, normalize, or return a bundle copy', () => {
  const value = bundle({
    events: [
      event(0, 'marker', 10),
      event(1, 'marker', 5)
    ]
  });
  const before = structuredClone(value);
  const result = validateImportedActivityBundle(value);

  assert.deepEqual(value, before);
  assert.equal(value.events[0].offsetSeconds, 10);
  assert.deepEqual(Object.keys(result), ['ok', 'errors', 'warnings']);
  assert.equal('value' in result, false);
  assert.equal('bundle' in result, false);
});

test('validates deeply frozen bundle input', () => {
  const value = deepFreeze(bundle());

  assert.doesNotThrow(() => validateImportedActivityBundle(value));
  assert.equal(validateImportedActivityBundle(value).ok, true);
});

test('valid bundle survives structuredClone and JSON round-trip', () => {
  const value = bundle({
    warnings: [
      {
        code: 'SYNTHETIC',
        path: '/synthetic',
        message: 'Synthetic only.'
      }
    ],
    versionMetadata: {
      schemaVersion: 1,
      parserVersion: null,
      normalizerVersion: 'normalizer-v1',
      analysisVersion: null,
      settingsVersion: 'settings-v1',
      inputHash: null
    }
  });

  const cloned = structuredClone(value);
  const roundTripped = JSON.parse(JSON.stringify(value));
  assert.deepEqual(cloned, value);
  assert.deepEqual(roundTripped, value);
  assert.equal(validateImportedActivityBundle(cloned).ok, true);
  assert.equal(validateImportedActivityBundle(roundTripped).ok, true);
});

test('never executes bundle or nested getters', async (t) => {
  const cases = [
    {
      label: 'top-level activity',
      create() {
        return bundle();
      },
      target(value) {
        return value;
      },
      field: 'activity',
      path: '/activity'
    },
    {
      label: 'Lap id',
      create() {
        const value = bundle({ laps: [lap(0, 0, 10)] });
        value.activity.capabilities.hasLaps = true;
        return value;
      },
      target(value) {
        return value.laps[0];
      },
      field: 'id',
      path: '/laps/0/id'
    },
    {
      label: 'VersionMetadata inputHash',
      create() {
        return bundle();
      },
      target(value) {
        return value.versionMetadata;
      },
      field: 'inputHash',
      path: '/versionMetadata/inputHash'
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
          throw new Error('BUNDLE_GETTER_EXECUTED');
        }
      });

      let result;
      assert.doesNotThrow(() => {
        result = validateImportedActivityBundle(value);
      });
      assert.equal(getterCalls, 0);
      assert.ok(
        hasItem(result, 'errors', 'JSON_UNSAFE', testCase.path)
      );
      assert.equal(
        JSON.stringify(result).includes('BUNDLE_GETTER_EXECUTED'),
        false
      );
    });
  }
});

test('non-enumerable fields fail closed without reading values', () => {
  const value = bundle();
  Object.defineProperty(value.sources[0], 'provider', {
    enumerable: false,
    value: 'must-not-be-read'
  });
  const result = validateImportedActivityBundle(value);

  assert.ok(
    hasItem(
      result,
      'errors',
      'JSON_UNSAFE',
      '/sources/0/provider'
    )
  );
  assert.equal(JSON.stringify(result).includes('must-not-be-read'), false);
});

test('revoked and reflection-failing Proxies return standard results', async (t) => {
  await t.test('revoked root Proxy', () => {
    const revocable = Proxy.revocable(bundle(), {});
    revocable.revoke();
    let first;
    let second;
    assert.doesNotThrow(() => {
      first = validateImportedActivityBundle(revocable.proxy);
      second = validateImportedActivityBundle(revocable.proxy);
    });
    assert.equal(first.ok, false);
    assert.deepEqual(first, second);
    assert.equal(JSON.stringify(first).includes('revoked'), false);
  });

  await t.test('nested reflection failure', () => {
    const privateMessage = 'BUNDLE_PRIVATE_PROXY_EXCEPTION';
    const value = bundle({
      devices: [
        new Proxy(
          { id: 'synthetic-device' },
          {
            getOwnPropertyDescriptor() {
              throw new Error(privateMessage);
            }
          }
        )
      ]
    });
    let result;
    assert.doesNotThrow(() => {
      result = validateImportedActivityBundle(value);
    });
    assert.equal(result.ok, false);
    assert.ok(result.errors.some((item) => item.code === 'JSON_UNSAFE'));
    assert.equal(JSON.stringify(result).includes(privateMessage), false);
  });
});

test('ordinary invalid inputs return standard results without throwing', async (t) => {
  for (const input of [
    undefined,
    null,
    false,
    0,
    '',
    [],
    new Date(0),
    new Map()
  ]) {
    await t.test(String(input), () => {
      let result;
      assert.doesNotThrow(() => {
        result = validateImportedActivityBundle(input);
      });
      assert.deepEqual(Object.keys(result), [
        'ok',
        'errors',
        'warnings'
      ]);
      assert.equal(result.ok, false);
    });
  }
});
