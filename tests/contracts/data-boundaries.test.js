import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import {
  validateCanonicalActivity,
  validateCanonicalStreamSet,
  validateImportedActivityBundle
} from '../../js/data/contracts/index.js';

const CONTRACT_FILES = [
  '../../js/data/contracts/errors.js',
  '../../js/data/contracts/primitives.js',
  '../../js/data/contracts/canonical-activity.js',
  '../../js/data/contracts/canonical-streams.js',
  '../../js/data/contracts/imported-activity-bundle.js',
  '../../js/data/contracts/index.js'
];

function minimalActivity() {
  return {
    schemaVersion: 1,
    id: 'boundary-test',
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
    }
  };
}

function minimalBundle() {
  return {
    schemaVersion: 1,
    activity: minimalActivity(),
    streams: {
      activityId: 'boundary-test',
      series: []
    },
    laps: [],
    events: [],
    sources: [
      {
        id: 'boundary-source',
        activityId: 'boundary-test',
        provider: 'synthetic-provider',
        acquisitionMethod: 'synthetic-test',
        importedAt: '2026-01-02T03:04:05.006Z'
      }
    ],
    devices: [],
    warnings: [],
    versionMetadata: {
      schemaVersion: 1
    }
  };
}

async function contractSources() {
  return Promise.all(
    CONTRACT_FILES.map(async (relativePath) => ({
      relativePath,
      source: await readFile(new URL(relativePath, import.meta.url), 'utf8')
    }))
  );
}

test('Node imports the B2 public ESM entry directly', async () => {
  const module = await import('../../js/data/contracts/index.js');
  assert.deepEqual(Object.keys(module), [
    'validateCanonicalActivity',
    'validateCanonicalStreamSet',
    'validateImportedActivityBundle'
  ]);
  assert.deepEqual(module.validateCanonicalActivity(minimalActivity()), {
    ok: true,
    errors: [],
    warnings: []
  });
  assert.deepEqual(
    module.validateCanonicalStreamSet({
      activityId: 'boundary-test',
      series: []
    }),
    {
      ok: true,
      errors: [],
      warnings: []
    }
  );
  assert.deepEqual(
    module.validateImportedActivityBundle(minimalBundle()),
    {
      ok: true,
      errors: [],
      warnings: []
    }
  );
});

test('contract modules import no app, storage, analysis, or provider runtime', async () => {
  const forbiddenImportSegments = [
    '/app/',
    '/services/',
    '/models/',
    '/analysis/',
    '/demo/',
    '/pages/',
    '/tabs/',
    '/api/',
    '/storage/',
    '/repository/',
    '/providers/',
    '/connectors/',
    '/decoders/'
  ];

  for (const { relativePath, source } of await contractSources()) {
    const imports = [
      ...source.matchAll(
        /(?:from\s+|import\s*\()\s*['"]([^'"]+)['"]/g
      )
    ].map((match) => match[1].toLowerCase());

    for (const specifier of imports) {
      assert.equal(
        forbiddenImportSegments.some((segment) => specifier.includes(segment)),
        false,
        `${relativePath} imports forbidden runtime ${specifier}`
      );
    }
  }
});

test('contract source contains no network, storage, DOM, or runtime compilation access', async () => {
  const forbiddenTokens = [
    'fetch',
    'indexedDB',
    'localStorage',
    'document',
    'window',
    'serviceWorker',
    'eval(',
    'new Function'
  ];

  for (const { relativePath, source } of await contractSources()) {
    for (const token of forbiddenTokens) {
      assert.equal(
        source.includes(token),
        false,
        `${relativePath} contains forbidden token ${token}`
      );
    }
  }
});

test('import and validation perform zero network or storage side effects', async () => {
  const names = [
    'fetch',
    'indexedDB',
    'localStorage',
    'document',
    'window'
  ];
  const originalDescriptors = new Map(
    names.map((name) => [
      name,
      Object.getOwnPropertyDescriptor(globalThis, name)
    ])
  );
  let accesses = 0;

  try {
    for (const name of names) {
      Object.defineProperty(globalThis, name, {
        configurable: true,
        get() {
          accesses += 1;
          throw new Error(`Forbidden global access: ${name}`);
        }
      });
    }

    const moduleUrl = new URL(
      '../../js/data/contracts/index.js?boundary=b2',
      import.meta.url
    );
    const module = await import(moduleUrl.href);
    assert.equal(module.validateCanonicalActivity(minimalActivity()).ok, true);
    assert.equal(
      module.validateCanonicalStreamSet({
        activityId: 'boundary-test',
        series: []
      }).ok,
      true
    );
    assert.equal(
      module.validateImportedActivityBundle(minimalBundle()).ok,
      true
    );
    assert.equal(accesses, 0);
  } finally {
    for (const name of names) {
      const descriptor = originalDescriptors.get(name);
      if (descriptor) {
        Object.defineProperty(globalThis, name, descriptor);
      } else {
        delete globalThis[name];
      }
    }
  }
});

test('B2 exposes only contract validators, not downstream runtime APIs', async () => {
  const module = await import('../../js/data/contracts/index.js');
  assert.deepEqual(Object.keys(module), [
    'validateCanonicalActivity',
    'validateCanonicalStreamSet',
    'validateImportedActivityBundle'
  ]);

  const source = await readFile(
    new URL('../../js/data/contracts/index.js', import.meta.url),
    'utf8'
  );
  for (const forbiddenName of [
    'Repository',
    'Storage',
    'Decoder',
    'ImportJob',
    'Projection',
    'Analysis'
  ]) {
    assert.equal(
      source.includes(forbiddenName),
      false,
      `public index exposes forbidden ${forbiddenName} API`
    );
  }
});

test('boundary tests use only inline synthetic data', () => {
  const activity = minimalActivity();
  assert.equal(activity.id, 'boundary-test');
  assert.equal(validateCanonicalActivity(activity).ok, true);
  assert.equal(
    validateCanonicalStreamSet({
      activityId: 'boundary-test',
      series: []
    }).ok,
    true
  );
  assert.equal(
    validateImportedActivityBundle(minimalBundle()).ok,
    true
  );
});
