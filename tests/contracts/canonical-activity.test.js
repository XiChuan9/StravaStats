import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

import { validateCanonicalActivity } from '../../js/data/contracts/index.js';

const REQUIRED_FIELDS = [
  'schemaVersion',
  'id',
  'sportCategory',
  'sportVariant',
  'startTimeUtc',
  'timeZone',
  'capabilities'
];

const SPORT_CATEGORIES = [
  'run',
  'ride',
  'swim',
  'walk',
  'hike',
  'workout',
  'winter',
  'team',
  'racket',
  'other'
];

function minimalActivity(overrides = {}) {
  return {
    schemaVersion: 1,
    id: 'activity-001',
    sportCategory: 'run',
    sportVariant: null,
    startTimeUtc: '2026-07-30T01:02:03.004Z',
    timeZone: {
      ianaName: 'Asia/Shanghai',
      utcOffsetMinutes: 480
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

function errorCodes(result) {
  return result.errors.map((item) => item.code);
}

function deepFreeze(value) {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value)) deepFreeze(child);
  }
  return value;
}

test('accepts a minimal CanonicalActivity', () => {
  assert.deepEqual(validateCanonicalActivity(minimalActivity()), {
    ok: true,
    errors: [],
    warnings: []
  });
});

test('accepts all optional nullable summary fields', () => {
  const activity = minimalActivity({
    name: 'Synthetic morning run',
    distanceMeters: 10_000,
    movingTimeSeconds: 3_000,
    elapsedTimeSeconds: 3_200,
    elevationGainMeters: 120,
    averageHeartRateBpm: 150,
    averagePowerWatts: 250,
    averageCadence: 88,
    extensions: {
      syntheticSource: {
        confidence: 0.95,
        labels: ['deterministic', null]
      }
    }
  });

  assert.equal(validateCanonicalActivity(activity).ok, true);
});

test('rejects numeric, empty, and whitespace IDs but accepts numeric-looking strings', async (t) => {
  for (const id of [123, '', '   ']) {
    await t.test(`rejects ${JSON.stringify(id)}`, () => {
      const result = validateCanonicalActivity(minimalActivity({ id }));
      assert.equal(result.ok, false);
      assert.ok(errorCodes(result).includes('ID_INVALID'));
    });
  }

  const activity = minimalActivity({ id: '123' });
  assert.equal(validateCanonicalActivity(activity).ok, true);
  assert.equal(activity.id, '123');
});

test('accepts schema version 1 and rejects invalid or unsupported versions', async (t) => {
  assert.equal(validateCanonicalActivity(minimalActivity()).ok, true);

  for (const schemaVersion of [0, 2, -1]) {
    await t.test(`unsupported version ${schemaVersion}`, () => {
      const result = validateCanonicalActivity(
        minimalActivity({ schemaVersion })
      );
      assert.ok(errorCodes(result).includes('VERSION_UNSUPPORTED'));
    });
  }

  for (const schemaVersion of ['1', 1.5, null]) {
    await t.test(`invalid version ${String(schemaVersion)}`, () => {
      const result = validateCanonicalActivity(
        minimalActivity({ schemaVersion })
      );
      assert.ok(errorCodes(result).includes('VERSION_INVALID'));
    });
  }
});

test('reports every missing required field at its JSON Pointer path', async (t) => {
  for (const field of REQUIRED_FIELDS) {
    await t.test(field, () => {
      const activity = minimalActivity();
      delete activity[field];

      const result = validateCanonicalActivity(activity);
      assert.ok(
        result.errors.some(
          (item) =>
            item.code === 'REQUIRED_FIELD_MISSING' &&
            item.path === `/activity/${field}`
        )
      );
    });
  }
});

test('accepts exactly the approved sport categories', async (t) => {
  for (const sportCategory of SPORT_CATEGORIES) {
    await t.test(sportCategory, () => {
      const result = validateCanonicalActivity(
        minimalActivity({ sportCategory })
      );
      assert.equal(result.ok, true);
    });
  }
});

test('supports unknown sports as other plus a normalized variant', () => {
  const result = validateCanonicalActivity(
    minimalActivity({
      sportCategory: 'other',
      sportVariant: 'synthetic-board-sport'
    })
  );
  assert.equal(result.ok, true);
});

test('rejects unsupported categories and non-normalized variants', async (t) => {
  const unsupported = validateCanonicalActivity(
    minimalActivity({ sportCategory: 'rowing' })
  );
  assert.ok(errorCodes(unsupported).includes('VALUE_INVALID'));

  for (const sportVariant of ['', 'TrailRun', ' trail', 'open_water', 42]) {
    await t.test(`variant ${JSON.stringify(sportVariant)}`, () => {
      const result = validateCanonicalActivity(
        minimalActivity({ sportVariant })
      );
      assert.ok(errorCodes(result).includes('VALUE_INVALID'));
    });
  }
});

test('requires all five capabilities to be strict booleans', async (t) => {
  const fields = [
    'hasGps',
    'hasHeartRate',
    'hasPower',
    'hasCadence',
    'hasLaps'
  ];

  for (const field of fields) {
    await t.test(`missing ${field}`, () => {
      const activity = minimalActivity();
      delete activity.capabilities[field];
      const result = validateCanonicalActivity(activity);
      assert.ok(
        result.errors.some(
          (item) =>
            item.code === 'REQUIRED_FIELD_MISSING' &&
            item.path === `/activity/capabilities/${field}`
        )
      );
    });

    await t.test(`non-boolean ${field}`, () => {
      const activity = minimalActivity();
      activity.capabilities[field] = 1;
      const result = validateCanonicalActivity(activity);
      assert.ok(
        result.errors.some(
          (item) =>
            item.code === 'TYPE_INVALID' &&
            item.path === `/activity/capabilities/${field}`
        )
      );
    });
  }
});

test('rejects truthy tri-state capability strings', async (t) => {
  for (const state of ['available', 'unavailable', 'unknown']) {
    await t.test(state, () => {
      const activity = minimalActivity();
      activity.capabilities.hasGps = state;
      const result = validateCanonicalActivity(activity);
      assert.equal(result.ok, false);
      assert.ok(errorCodes(result).includes('TYPE_INVALID'));
    });
  }
});

test('accepts only fixed-millisecond RFC 3339 UTC instants', async (t) => {
  const valid = [
    '2024-02-29T00:00:00.000Z',
    '2026-12-31T23:59:59.999Z'
  ];
  for (const startTimeUtc of valid) {
    await t.test(`accepts ${startTimeUtc}`, () => {
      assert.equal(
        validateCanonicalActivity(minimalActivity({ startTimeUtc })).ok,
        true
      );
    });
  }

  const invalid = [
    '2026-07-30T01:02:03Z',
    '2026-07-30T01:02:03.0000Z',
    '2026-07-30T01:02:03.000+08:00',
    '2026-07-30T01:02:03.000',
    '2026-13-01T00:00:00.000Z',
    '2026-02-29T00:00:00.000Z',
    '2026-04-31T00:00:00.000Z',
    '2026-01-01T24:00:00.000Z',
    '2026-01-01T00:60:00.000Z',
    '2026-01-01T00:00:60.000Z'
  ];
  for (const startTimeUtc of invalid) {
    await t.test(`rejects ${startTimeUtc}`, () => {
      const result = validateCanonicalActivity(
        minimalActivity({ startTimeUtc })
      );
      assert.ok(errorCodes(result).includes('TIMESTAMP_INVALID'));
    });
  }
});

test('accepts null time zone metadata and a real zero offset', () => {
  assert.equal(
    validateCanonicalActivity(
      minimalActivity({
        timeZone: { ianaName: null, utcOffsetMinutes: null }
      })
    ).ok,
    true
  );

  const zeroOffset = minimalActivity({
    timeZone: { ianaName: 'Etc/UTC', utcOffsetMinutes: 0 }
  });
  assert.equal(validateCanonicalActivity(zeroOffset).ok, true);
  assert.equal(zeroOffset.timeZone.utcOffsetMinutes, 0);
});

test('accepts UTC offset boundaries and rejects invalid offsets', async (t) => {
  for (const utcOffsetMinutes of [-840, 840]) {
    assert.equal(
      validateCanonicalActivity(
        minimalActivity({
          timeZone: { ianaName: null, utcOffsetMinutes }
        })
      ).ok,
      true
    );
  }

  for (const utcOffsetMinutes of [-841, 841, 1.5, '0', Infinity]) {
    await t.test(`rejects ${String(utcOffsetMinutes)}`, () => {
      const result = validateCanonicalActivity(
        minimalActivity({
          timeZone: { ianaName: null, utcOffsetMinutes }
        })
      );
      assert.equal(result.ok, false);
      assert.ok(
        errorCodes(result).some(
          (code) => code === 'NUMBER_INVALID' || code === 'RANGE_INVALID'
        )
      );
    });
  }
});

test('checks IANA name format without consulting host tzdb', async (t) => {
  for (const ianaName of ['Etc/UTC', 'America/Argentina/Buenos_Aires', 'UTC']) {
    assert.equal(
      validateCanonicalActivity(
        minimalActivity({
          timeZone: { ianaName, utcOffsetMinutes: null }
        })
      ).ok,
      true
    );
  }

  for (const ianaName of ['', 'Asia Shanghai', '/Etc/UTC', 'Etc/UTC/']) {
    await t.test(`rejects ${JSON.stringify(ianaName)}`, () => {
      const result = validateCanonicalActivity(
        minimalActivity({
          timeZone: { ianaName, utcOffsetMinutes: null }
        })
      );
      assert.ok(errorCodes(result).includes('VALUE_INVALID'));
    });
  }
});

test('preserves the distinction between absent, null, and zero summaries', () => {
  const absent = minimalActivity();
  const nullable = minimalActivity({
    distanceMeters: null,
    movingTimeSeconds: null,
    elapsedTimeSeconds: null
  });
  const zero = minimalActivity({
    distanceMeters: 0,
    movingTimeSeconds: 0,
    elapsedTimeSeconds: 0,
    elevationGainMeters: 0,
    averagePowerWatts: 0,
    averageCadence: 0
  });

  assert.equal(validateCanonicalActivity(absent).ok, true);
  assert.equal(validateCanonicalActivity(nullable).ok, true);
  assert.equal(validateCanonicalActivity(zero).ok, true);
  assert.equal('distanceMeters' in absent, false);
  assert.equal(nullable.distanceMeters, null);
  assert.equal(zero.distanceMeters, 0);
});

test('rejects non-finite summary numbers', async (t) => {
  for (const invalidNumber of [NaN, Infinity, -Infinity]) {
    await t.test(String(invalidNumber), () => {
      const result = validateCanonicalActivity(
        minimalActivity({ distanceMeters: invalidNumber })
      );
      assert.ok(errorCodes(result).includes('NUMBER_INVALID'));
      assert.ok(errorCodes(result).includes('JSON_UNSAFE'));
    });
  }
});

test('rejects negative non-negative summary fields', async (t) => {
  const fields = [
    'distanceMeters',
    'movingTimeSeconds',
    'elapsedTimeSeconds',
    'elevationGainMeters',
    'averagePowerWatts',
    'averageCadence'
  ];

  for (const field of fields) {
    await t.test(field, () => {
      const result = validateCanonicalActivity(
        minimalActivity({ [field]: -1 })
      );
      assert.ok(errorCodes(result).includes('RANGE_INVALID'));
    });
  }
});

test('enforces heart-rate hard bounds', async (t) => {
  for (const averageHeartRateBpm of [0, -1, 301]) {
    await t.test(`rejects ${averageHeartRateBpm}`, () => {
      const result = validateCanonicalActivity(
        minimalActivity({ averageHeartRateBpm })
      );
      assert.ok(errorCodes(result).includes('RANGE_INVALID'));
    });
  }

  for (const averageHeartRateBpm of [0.1, 300]) {
    assert.equal(
      validateCanonicalActivity(
        minimalActivity({ averageHeartRateBpm })
      ).ok,
      true
    );
  }
});

test('rejects moving time greater than elapsed time', () => {
  const result = validateCanonicalActivity(
    minimalActivity({
      movingTimeSeconds: 61,
      elapsedTimeSeconds: 60
    })
  );
  assert.ok(errorCodes(result).includes('RELATION_INVALID'));
});

test('accepts plain JSON-safe extensions without warning on extension keys', () => {
  const result = validateCanonicalActivity(
    minimalActivity({
      extensions: {
        providerNeutralEnvelope: {
          values: [0, null, false, 'synthetic']
        }
      }
    })
  );
  assert.deepEqual(result, { ok: true, errors: [], warnings: [] });
});

test('rejects non-JSON-safe extension values', async (t) => {
  class SyntheticClass {
    constructor() {
      this.value = 1;
    }
  }

  const cycle = {};
  cycle.self = cycle;

  const cases = [
    ['undefined', { value: undefined }],
    ['NaN', { value: NaN }],
    ['Infinity', { value: Infinity }],
    ['bigint', { value: 1n }],
    ['symbol', { value: Symbol('synthetic') }],
    ['function', { value: () => 1 }],
    ['Date', { value: new Date(0) }],
    ['Map', { value: new Map([['synthetic', 1]]) }],
    ['Set', { value: new Set(['synthetic']) }],
    ['class instance', { value: new SyntheticClass() }],
    ['cycle', cycle]
  ];

  for (const [label, extensions] of cases) {
    await t.test(label, () => {
      const result = validateCanonicalActivity(
        minimalActivity({ extensions })
      );
      assert.equal(result.ok, false);
      assert.ok(errorCodes(result).includes('JSON_UNSAFE'));
    });
  }
});

test('never executes top-level accessors during validation', async (t) => {
  await t.test('optional throwing name getter', () => {
    const activity = minimalActivity();
    let getterCalls = 0;
    Object.defineProperty(activity, 'name', {
      enumerable: true,
      get() {
        getterCalls += 1;
        throw new Error('GETTER_EXECUTED');
      }
    });

    let result;
    assert.doesNotThrow(() => {
      result = validateCanonicalActivity(activity);
    });
    assert.equal(getterCalls, 0);
    assert.equal(result.ok, false);
    assert.ok(
      result.errors.some(
        (item) =>
          item.code === 'JSON_UNSAFE' &&
          item.path === '/activity/name'
      )
    );
    assert.equal(JSON.stringify(result).includes('GETTER_EXECUTED'), false);
  });

  await t.test('required id getter', () => {
    const activity = minimalActivity();
    let getterCalls = 0;
    Object.defineProperty(activity, 'id', {
      enumerable: true,
      get() {
        getterCalls += 1;
        return 'GETTER_VALUE_MUST_NOT_BE_READ';
      }
    });

    const result = validateCanonicalActivity(activity);
    assert.equal(getterCalls, 0);
    assert.equal(result.ok, false);
    assert.ok(
      result.errors.some(
        (item) =>
          item.code === 'JSON_UNSAFE' &&
          item.path === '/activity/id'
      )
    );
    assert.equal(
      JSON.stringify(result).includes('GETTER_VALUE_MUST_NOT_BE_READ'),
      false
    );
  });

  await t.test('observable non-throwing getter', () => {
    const activity = minimalActivity();
    let getterCalls = 0;
    Object.defineProperty(activity, 'distanceMeters', {
      enumerable: true,
      get() {
        getterCalls += 1;
        return 42;
      }
    });

    const result = validateCanonicalActivity(activity);
    assert.equal(getterCalls, 0);
    assert.equal(result.ok, false);
    assert.ok(
      result.errors.some(
        (item) =>
          item.code === 'JSON_UNSAFE' &&
          item.path === '/activity/distanceMeters'
      )
    );
  });

  await t.test('setter-only property', () => {
    const activity = minimalActivity();
    let setterCalls = 0;
    Object.defineProperty(activity, 'name', {
      enumerable: true,
      set() {
        setterCalls += 1;
      }
    });

    const result = validateCanonicalActivity(activity);
    assert.equal(setterCalls, 0);
    assert.equal(result.ok, false);
    assert.ok(
      result.errors.some(
        (item) =>
          item.code === 'JSON_UNSAFE' &&
          item.path === '/activity/name'
      )
    );
  });
});

test('never executes nested accessors during validation', async (t) => {
  const cases = [
    {
      label: 'timeZone.ianaName',
      path: '/activity/timeZone/ianaName',
      target(activity) {
        return activity.timeZone;
      },
      field: 'ianaName'
    },
    {
      label: 'capabilities.hasGps',
      path: '/activity/capabilities/hasGps',
      target(activity) {
        return activity.capabilities;
      },
      field: 'hasGps'
    },
    {
      label: 'extensions nested field',
      path: '/activity/extensions/syntheticValue',
      target(activity) {
        activity.extensions = {};
        return activity.extensions;
      },
      field: 'syntheticValue'
    }
  ];

  for (const testCase of cases) {
    await t.test(testCase.label, () => {
      const activity = minimalActivity();
      const target = testCase.target(activity);
      let getterCalls = 0;
      Object.defineProperty(target, testCase.field, {
        enumerable: true,
        get() {
          getterCalls += 1;
          throw new Error('NESTED_GETTER_EXECUTED');
        }
      });

      let result;
      assert.doesNotThrow(() => {
        result = validateCanonicalActivity(activity);
      });
      assert.equal(getterCalls, 0);
      assert.equal(result.ok, false);
      assert.ok(
        result.errors.some(
          (item) =>
            item.code === 'JSON_UNSAFE' &&
            item.path === testCase.path
        )
      );
      assert.equal(
        JSON.stringify(result).includes('NESTED_GETTER_EXECUTED'),
        false
      );
    });
  }
});

test('fails closed on non-enumerable data and accessor properties', async (t) => {
  await t.test('non-enumerable data property', () => {
    const activity = minimalActivity();
    Object.defineProperty(activity, 'name', {
      enumerable: false,
      value: 'synthetic'
    });

    const result = validateCanonicalActivity(activity);
    assert.equal(result.ok, false);
    assert.ok(
      result.errors.some(
        (item) =>
          item.code === 'JSON_UNSAFE' &&
          item.path === '/activity/name'
      )
    );
  });

  await t.test('non-enumerable throwing accessor', () => {
    const activity = minimalActivity();
    let getterCalls = 0;
    Object.defineProperty(activity, 'name', {
      enumerable: false,
      get() {
        getterCalls += 1;
        throw new Error('NON_ENUMERABLE_GETTER_EXECUTED');
      }
    });

    const result = validateCanonicalActivity(activity);
    assert.equal(getterCalls, 0);
    assert.equal(result.ok, false);
    assert.ok(
      result.errors.some(
        (item) =>
          item.code === 'JSON_UNSAFE' &&
          item.path === '/activity/name'
      )
    );
    assert.equal(
      JSON.stringify(result).includes('NON_ENUMERABLE_GETTER_EXECUTED'),
      false
    );
  });
});

test('warns for top-level and nested unknown fields with escaped paths', () => {
  const activity = minimalActivity({
    'provider~/raw': 'synthetic'
  });
  activity.timeZone['source~/zone'] = true;
  activity.capabilities['source~/capability'] = false;

  const result = validateCanonicalActivity(activity);
  assert.equal(result.ok, true);
  assert.deepEqual(
    result.warnings.map(({ code, path }) => ({ code, path })),
    [
      {
        code: 'UNKNOWN_FIELD',
        path: '/activity/capabilities/source~0~1capability'
      },
      {
        code: 'UNKNOWN_FIELD',
        path: '/activity/provider~0~1raw'
      },
      {
        code: 'UNKNOWN_FIELD',
        path: '/activity/timeZone/source~0~1zone'
      }
    ]
  );
  assert.equal(activity['provider~/raw'], 'synthetic');
});

test('does not mutate input and does not return a normalized copy', () => {
  const activity = minimalActivity({
    id: '  opaque-with-edge-space  ',
    distanceMeters: 0,
    extensions: { synthetic: true }
  });
  const before = structuredClone(activity);

  const result = validateCanonicalActivity(activity);

  assert.deepEqual(activity, before);
  assert.equal(activity.id, '  opaque-with-edge-space  ');
  assert.deepEqual(Object.keys(result), ['ok', 'errors', 'warnings']);
  assert.equal('value' in result, false);
});

test('validates deeply frozen input', () => {
  const activity = deepFreeze(
    minimalActivity({
      distanceMeters: 0,
      extensions: { values: [1, null, false] }
    })
  );

  assert.doesNotThrow(() => validateCanonicalActivity(activity));
  assert.equal(validateCanonicalActivity(activity).ok, true);
});

test('accepts structuredClone and JSON round-trip copies of valid data', () => {
  const activity = minimalActivity({
    distanceMeters: 0,
    extensions: {
      synthetic: [1, null, false, 'value']
    }
  });

  const cloned = structuredClone(activity);
  const roundTripped = JSON.parse(JSON.stringify(activity));

  assert.deepEqual(cloned, activity);
  assert.deepEqual(roundTripped, activity);
  assert.equal(validateCanonicalActivity(cloned).ok, true);
  assert.equal(validateCanonicalActivity(roundTripped).ok, true);
});

test('produces identical validation results across host timezones', () => {
  const indexUrl = new URL(
    '../../js/data/contracts/index.js',
    import.meta.url
  ).href;
  const script = `
    const { validateCanonicalActivity } = await import(process.argv[1]);
    const activity = {
      schemaVersion: 1,
      id: "timezone-test",
      sportCategory: "run",
      sportVariant: null,
      startTimeUtc: "2024-02-29T23:59:59.999Z",
      timeZone: { ianaName: "America/New_York", utcOffsetMinutes: -300 },
      capabilities: {
        hasGps: false,
        hasHeartRate: false,
        hasPower: false,
        hasCadence: false,
        hasLaps: false
      }
    };
    process.stdout.write(JSON.stringify(validateCanonicalActivity(activity)));
  `;

  const outputs = ['UTC', 'Pacific/Kiritimati', 'America/Los_Angeles'].map(
    (timezone) => {
      const result = spawnSync(
        process.execPath,
        ['--input-type=module', '-e', script, indexUrl],
        {
          encoding: 'utf8',
          env: { TZ: timezone }
        }
      );
      assert.equal(result.status, 0, result.stderr);
      return result.stdout;
    }
  );

  assert.equal(new Set(outputs).size, 1);
  assert.deepEqual(JSON.parse(outputs[0]), {
    ok: true,
    errors: [],
    warnings: []
  });
});
