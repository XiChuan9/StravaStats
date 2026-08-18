import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { webcrypto } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import {
    IMPORT_ERROR_CODE,
    createDecoderRegistry,
    createImportService,
    createInlineImportWorker
} from '../../js/import/index.js';
import { IDBFactory, IDBKeyRange } from 'fake-indexeddb';
import { createImportStore } from '../../js/storage/index.js';
import { createSyntheticFitActivity, syntheticFitDescriptor } from
    '../fixtures/synthetic/fit/fit-fixture.js';
import { syntheticTcxDescriptor } from
    '../fixtures/synthetic/tcx/tcx-fixture.js';
import { syntheticGpxDescriptor } from
    '../fixtures/synthetic/gpx/gpx-fixture.js';

const ROOT = new URL('../../', import.meta.url);
const ALLOWED_PATHS = Object.freeze([
    'docs/tasks/pr-14-decoder-registry.md',
    'source-manager.html',
    'js/import/decoder-registry.js',
    'js/import/synthetic-import-worker.js',
    'js/import/import-service.js',
    'js/storage/import-store.js',
    'js/pages/source-manager/source-manager.js',
    'tests/import/decoder-registry-wiring.test.js',
    'tests/import/import-worker.test.js',
    'tests/import/import-core.test.js',
    'tests/import/import-boundaries.test.js',
    'tests/storage/indexeddb-v2-boundaries.test.js',
    'tests/source-manager/source-manager.test.js',
    'tests/source-manager/source-manager-boundaries.test.js',
    'tests/source-manager/source-manager-browser-smoke.html'
]);

async function source(path) {
    return readFile(new URL(path, ROOT), 'utf8');
}

function createIds() {
    let sequence = 0;
    return kind => `pr14-${kind}-${++sequence}`;
}

function createService(
    indexedDB,
    worker = createInlineImportWorker(),
    crypto = webcrypto
) {
    const importStore = createImportStore({
        indexedDB,
        IDBKeyRange,
        now: () => Date.parse('2033-01-02T03:04:05.006Z'),
        applicationVersion: 'pr14-registry-test@1'
    });
    return {
        importStore,
        service: createImportService({
            importStore,
            worker,
            crypto,
            createId: createIds()
        })
    };
}

test('production Worker Registry dispatches FIT, TCX, and GPX exactly once', async () => {
    const worker = createInlineImportWorker();
    try {
        const descriptors = [
            syntheticFitDescriptor(createSyntheticFitActivity()),
            syntheticTcxDescriptor(),
            syntheticGpxDescriptor()
        ];
        const expected = ['fit', 'tcx', 'gpx'];
        for (let index = 0; index < descriptors.length; index += 1) {
            const result = await worker.process({
                ...descriptors[index],
                rawArtifactId: `raw:synthetic-${expected[index]}`
            });
            assert.equal(result.ok, true, expected[index]);
            assert.equal(result.decoded.sources[0].provider, expected[index]);
            assert.equal(Object.isFrozen(result.decoded), true);
        }
    } finally {
        worker.close();
    }
});

test('FIT, TCX, and GPX traverse ImportService, Storage, Log, Preview, and duplicate paths', async () => {
    const cases = [
        ['fit', syntheticFitDescriptor(createSyntheticFitActivity())],
        ['tcx', syntheticTcxDescriptor()],
        ['gpx', syntheticGpxDescriptor()]
    ];
    for (const [provider, descriptor] of cases) {
        const { importStore, service } = createService(new IDBFactory());
        await service.initialize();
        try {
            const first = await service.importArtifacts([descriptor]);
            const firstReport = await service.waitForJob(first.jobId);
            assert.equal(firstReport.totals.completed, 1, provider);
            assert.equal(firstReport.totals.failed, 0, provider);
            assert.equal((await service.previewActivities()).total, 1, provider);
            const [firstItem] = await importStore.listImportItems(first.jobId);
            const stored = await importStore.getRawArtifact(firstItem.artifactId);
            assert.equal(stored.mediaType, descriptor.mediaType, provider);
            assert.equal(stored.state, 'committed', provider);

            const duplicate = await service.importArtifacts([descriptor]);
            const duplicateReport = await service.waitForJob(duplicate.jobId);
            assert.equal(duplicateReport.totals.skippedExactDuplicate, 1, provider);
            assert.equal((await service.previewActivities()).total, 1, provider);
        } finally {
            await service.close();
        }
    }
});

test('malformed registered artifacts map to redacted durable decode failures', async () => {
    const validFit = createSyntheticFitActivity();
    const cases = [
        syntheticFitDescriptor(validFit.subarray(0, 14)),
        syntheticTcxDescriptor(
            '<?xml version="1.0"?><TrainingCenterDatabase xmlns="http://www.garmin.com/xmlschemas/TrainingCenterDatabase/v2">private-tcx-canary'
        ),
        syntheticGpxDescriptor(
            '<?xml version="1.0"?><gpx xmlns="http://www.topografix.com/GPX/1/1" version="1.1">private-gpx-canary'
        )
    ];
    for (const descriptor of cases) {
        const { service } = createService(new IDBFactory());
        await service.initialize();
        try {
            const run = await service.importArtifacts([descriptor]);
            const report = await service.waitForJob(run.jobId);
            assert.equal(report.status, 'completed_with_warnings');
            assert.equal(report.items[0].outcome, 'failed_decode');
            assert.equal(report.items[0].errorCode, IMPORT_ERROR_CODE.FILE_CORRUPTED);
            assert.equal(report.items[0].retryable, false);
            assert.equal((await service.previewActivities()).total, 0);
            assert.doesNotMatch(JSON.stringify(report), /private-(?:tcx|gpx)-canary/);
        } finally {
            await service.close();
        }
    }
});

test('FIT import cancellation preserves the raw artifact and commits no Canonical activity', async () => {
    let releaseDigest;
    const digestGate = new Promise(resolve => { releaseDigest = resolve; });
    const crypto = { subtle: { digest: async () => digestGate } };
    const { importStore, service } = createService(
        new IDBFactory(),
        createInlineImportWorker(),
        crypto
    );
    await service.initialize();
    try {
        const run = await service.importArtifacts([
            syntheticFitDescriptor(createSyntheticFitActivity())
        ]);
        while ((await importStore.getImportJob(run.jobId)).status !== 'hashing') {
            await new Promise(resolve => setImmediate(resolve));
        }
        assert.deepEqual(await service.cancelJob(run.jobId), {
            status: 'cancellation-requested'
        });
        releaseDigest(new Uint8Array(32).buffer);
        const report = await service.waitForJob(run.jobId);
        assert.equal(report.status, 'cancelled');
        assert.equal(report.totals.cancelled, 1);
        const [item] = await importStore.listImportItems(run.jobId);
        assert.ok(await importStore.getRawArtifact(item.artifactId));
        assert.equal((await service.previewActivities()).total, 0);
    } finally {
        await service.close();
    }
});

test('production Worker rejects accessors and revoked Proxies without executing them', async () => {
    const worker = createInlineImportWorker();
    let getters = 0;
    try {
        const hostile = {
            content: syntheticTcxDescriptor().content,
            rawArtifactId: 'raw:hostile'
        };
        Object.defineProperty(hostile, 'mediaType', {
            enumerable: true,
            get() {
                getters += 1;
                return syntheticTcxDescriptor().mediaType;
            }
        });
        const result = await worker.process(hostile);
        assert.deepEqual(result, {
            ok: false,
            code: IMPORT_ERROR_CODE.DECODER_FAILED,
            retryable: false
        });
        assert.equal(getters, 0);

        const revoked = Proxy.revocable({
            ...syntheticGpxDescriptor(),
            rawArtifactId: 'raw:revoked'
        }, {});
        revoked.revoke();
        assert.deepEqual(await worker.process(revoked.proxy), {
            ok: false,
            code: IMPORT_ERROR_CODE.DECODER_FAILED,
            retryable: false
        });
    } finally {
        worker.close();
    }
});

test('generic Registry performs one decoder call and keeps exact unknown-media error', () => {
    let calls = 0;
    const decoder = Object.freeze({
        id: 'single-call',
        mediaType: 'application/x-single-call',
        decode(input) {
            calls += 1;
            return input;
        }
    });
    const registry = createDecoderRegistry([decoder]);
    const input = Object.freeze({ marker: true });
    assert.equal(registry.select(decoder.mediaType).decode(input), input);
    assert.equal(calls, 1);
    assert.throws(
        () => registry.select('application/x-unknown'),
        error => error.code === IMPORT_ERROR_CODE.UNSUPPORTED_FORMAT
    );
    assert.equal(calls, 1);
});

test('production Worker owns one literal unique six-decoder Registry', async () => {
    const worker = await source('js/import/synthetic-import-worker.js');
    for (const binding of [
        'syntheticJsonDecoder', 'activitiesCsvDecoder',
        'stravaArchiveRowDecoder', 'fitDecoder', 'tcxDecoder', 'gpxDecoder'
    ]) {
        assert.equal((worker.match(new RegExp(`\\b${binding}\\b`, 'g')) || []).length, 2, binding);
    }
    assert.equal((worker.match(/createDecoderRegistry\s*\(/g) || []).length, 1);
});

test('PR-14 keeps public/schema/runtime boundaries and decoder sources frozen', async () => {
    const importModule = await import(`../../js/import/index.js?pr14=${Date.now()}`);
    assert.deepEqual(Object.keys(importModule).sort(), [
        'IMPORT_ERROR_CODE', 'IMPORT_ITEM_STATUS', 'IMPORT_JOB_STATUS',
        'ImportError', 'SYNTHETIC_JSON_MEDIA_TYPE',
        'assertImportItemTransition', 'assertImportJobTransition',
        'createBrowserImportWorker', 'createDecoderRegistry',
        'createImportService', 'createInlineImportWorker',
        'normalizeImportedActivity', 'syntheticJsonDecoder'
    ]);
    const frozenHashes = new Map([
        ['js/decoders/fit/decoder.js', '4553f274d365bb032768aaeb203dacf7f7cca18b7f7208dd26dc3b28eacc43fe'],
        ['js/decoders/tcx/decoder.js', 'e94c8164b0d153fef988934e4455b4edbb5b8c978e789cadd416b470eee977ce'],
        ['js/decoders/gpx/decoder.js', 'cb84f3d86c5d6d7cbfa5425b190573d0fab094a7d1ce9124f6231905f1ca664f']
    ]);
    for (const [path, expected] of frozenHashes) {
        const digest = createHash('sha256').update(await readFile(new URL(path, ROOT))).digest('hex');
        assert.equal(digest, expected, path);
    }

    const packageJson = JSON.parse(await source('package.json'));
    const packageLock = JSON.parse(await source('package-lock.json'));
    assert.deepEqual(packageJson.dependencies, {
        '@vercel/speed-insights': '^2.0.0',
        'node-fetch': '^2.6.7'
    });
    assert.deepEqual(packageJson.devDependencies, { 'fake-indexeddb': '^6.2.5' });
    assert.deepEqual(packageLock.packages[''].dependencies, packageJson.dependencies);
    assert.deepEqual(packageLock.packages[''].devDependencies, packageJson.devDependencies);
    const lockedArtifacts = Object.fromEntries(
        Object.entries(packageLock.packages)
            .filter(([path]) => path !== '')
            .map(([path, record]) => [path, {
                version: record.version,
                resolved: record.resolved,
                integrity: record.integrity,
                dev: record.dev === true
            }])
    );
    assert.deepEqual(lockedArtifacts, {
        'node_modules/@vercel/speed-insights': {
            version: '2.0.0', resolved: 'https://registry.npmjs.org/@vercel/speed-insights/-/speed-insights-2.0.0.tgz',
            integrity: 'sha512-jwkNcrTeafWxjmWq4AHBaptSqZiJkYU5adLC9QBSqeim0GcqDMgN5Ievh8OG1rJ6W3A4l1oiP7qr9CWxGuzu3w==', dev: false
        },
        'node_modules/fake-indexeddb': {
            version: '6.2.5', resolved: 'https://registry.npmjs.org/fake-indexeddb/-/fake-indexeddb-6.2.5.tgz',
            integrity: 'sha512-CGnyrvbhPlWYMngksqrSSUT1BAVP49dZocrHuK0SvtR0D5TMs5wP0o3j7jexDJW01KSadjBp1M/71o/KR3nD1w==', dev: true
        },
        'node_modules/node-fetch': {
            version: '2.7.0', resolved: 'https://registry.npmjs.org/node-fetch/-/node-fetch-2.7.0.tgz',
            integrity: 'sha512-c4FRfUm/dbcWZ7U+1Wq0AwCyFL+3nt2bEw05wfxSz+DWpWsitgmSgYmy2dQdWyKC1694ELPqMs/YzUSNozLt8A==', dev: false
        },
        'node_modules/tr46': {
            version: '0.0.3', resolved: 'https://registry.npmjs.org/tr46/-/tr46-0.0.3.tgz',
            integrity: 'sha512-N3WMsuqV66lT30CrXNbEjx4GEwlow3v6rr4mCcv6prnfwhS01rkgyFdjPNBYd9br7LpXV1+Emh01fHnq2Gdgrw==', dev: false
        },
        'node_modules/webidl-conversions': {
            version: '3.0.1', resolved: 'https://registry.npmjs.org/webidl-conversions/-/webidl-conversions-3.0.1.tgz',
            integrity: 'sha512-2JAn3z8AR6rjK8Sm8orRC0h/bcl/DqL7tRPdGZ4I1CjdF+EaMLmYxBHyXuKL849eucPFhvBoxMsflfOb8kxaeQ==', dev: false
        },
        'node_modules/whatwg-url': {
            version: '5.0.0', resolved: 'https://registry.npmjs.org/whatwg-url/-/whatwg-url-5.0.0.tgz',
            integrity: 'sha512-saE57nupxk6v3HY35+jzBwYa0rKSy0XR8JSxZPwgLr7ys0IBzhGviA1/TUGJLmSVqs8pb9AnvICXEuOHLprYTw==', dev: false
        }
    });

    const featureFlags = await import(`../../js/app/feature-flags.js?pr14=${Date.now()}`);
    assert.deepEqual(Object.keys(featureFlags).sort(), [
        'DEFAULT_FEATURE_FLAGS',
        'getFeatureFlags',
        'resolveFeatureFlags'
    ]);
    assert.deepEqual(featureFlags.DEFAULT_FEATURE_FLAGS, {
        dataRepositoryMode: 'canonical',
        localImportEnabled: false,
        canonicalShadowWriteEnabled: false
    });
    assert.equal(Object.isFrozen(featureFlags.DEFAULT_FEATURE_FLAGS), true);

    for (const mode of ['legacy', 'shadow', 'canonical']) {
        const resolved = featureFlags.getFeatureFlags({
            dataRepositoryMode: mode,
            localImportEnabled: false,
            canonicalShadowWriteEnabled: true
        });
        assert.equal(resolved.dataRepositoryMode, mode);
        assert.equal(resolved.localImportEnabled, false);
        assert.equal(resolved.canonicalShadowWriteEnabled, mode === 'shadow');
        assert.equal(Object.isFrozen(resolved), true);
    }

    let getterCalls = 0;
    const hostile = {};
    Object.defineProperty(hostile, 'dataRepositoryMode', {
        enumerable: true,
        get() {
            getterCalls += 1;
            return 'legacy';
        }
    });
    for (const invalid of [{ dataRepositoryMode: 'unknown' }, hostile]) {
        assert.deepEqual(featureFlags.resolveFeatureFlags(invalid), {
            dataRepositoryMode: 'canonical',
            localImportEnabled: false,
            canonicalShadowWriteEnabled: false
        });
    }
    assert.equal(getterCalls, 0);
});

test('literal scope guard preserves the finalized PR-14 path lifecycle', async () => {
    const brief = await source('docs/tasks/pr-14-decoder-registry.md');
    assert.equal(new Set(ALLOWED_PATHS).size, 15);
    for (const path of ALLOWED_PATHS) {
        assert.equal(brief.includes(path), true, path);
        await readFile(new URL(path, ROOT));
    }
    assert.match(brief, /maximum is the literal union above: fifteen paths/i);
    assert.match(brief, /sixteenth path needs a\s+necessity record/i);
    const harness = 'tests/source-manager/source-manager-browser-smoke.html';
    const indexEntries = execFileSync('git', ['ls-files', '--stage', '-z'], {
        cwd: new URL('.', ROOT),
        encoding: 'utf8'
    }).split('\0').filter(Boolean);
    const harnessEntries = indexEntries.filter(entry => entry.endsWith(`\t${harness}`));
    assert.equal(harnessEntries.length, 1);
    assert.match(harnessEntries[0], /^100644 [0-9a-f]{40} 0\t/);
});
