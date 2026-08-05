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
        ['js/decoders/fit/decoder.js', 'f21961f5b417db97f5ac4abeb5a3365107ae03891d87dde106a5fcf91f29059b'],
        ['js/decoders/tcx/decoder.js', '6e5c03f190fa12500d6d1042800272e817c02ab8fb5e5b288fd05f78153cd868'],
        ['js/decoders/gpx/decoder.js', 'cb84f3d86c5d6d7cbfa5425b190573d0fab094a7d1ce9124f6231905f1ca664f'],
        ['package.json', '0406287a8b8be5d8c34ff994c8979a2bf585cd33b911617c898a83005842823a'],
        ['package-lock.json', '04c2a7fa76c5daaec25fbe291d33b0b76037166b9b50394929cd7ec21ed8751f'],
        ['sw.js', '2de27619d86023b65028cd379c80ccc839611930f3445d9c905f935bdb714798'],
        ['js/app/feature-flags.js', 'eb427fac0ed89027d10bfcbfdc913828765d5a7ccc58b31d15c1d74515c3e59f']
    ]);
    for (const [path, expected] of frozenHashes) {
        const digest = createHash('sha256').update(await readFile(new URL(path, ROOT))).digest('hex');
        assert.equal(digest, expected, path);
    }
});

test('literal scope guard supports untracked pre-commit and tracked depth-1 CI states', async () => {
    const brief = await source('docs/tasks/pr-14-decoder-registry.md');
    assert.equal(new Set(ALLOWED_PATHS).size, 15);
    for (const path of ALLOWED_PATHS) {
        assert.equal(brief.includes(path), true, path);
        await readFile(new URL(path, ROOT));
    }
    assert.match(brief, /maximum is the literal union above: fifteen paths/i);
    assert.match(brief, /sixteenth path needs a\s+necessity record/i);
    const harness = 'tests/import/decoder-registry-wiring.test.js';
    const indexEntries = execFileSync('git', ['ls-files', '--stage', '-z'], {
        cwd: new URL('.', ROOT),
        encoding: 'utf8'
    }).split('\0').filter(Boolean);
    const protectedEntries = indexEntries.filter(entry => {
        const separator = entry.indexOf('\t');
        return separator >= 0 && !ALLOWED_PATHS.includes(entry.slice(separator + 1));
    });
    const protectedDigest = createHash('sha256')
        .update(`${protectedEntries.join('\0')}\0`)
        .digest('hex');
    assert.equal(
        protectedDigest,
        'cb2913432053912bfbde24f27dea86cbcabf2e875b96f8a08f8d717139b69c9c'
    );
    let tracked = true;
    try {
        execFileSync('git', ['ls-files', '--error-unmatch', harness], {
            cwd: new URL('.', ROOT),
            stdio: 'ignore'
        });
    } catch {
        tracked = false;
    }
    if (!tracked) {
        const status = execFileSync(
            'git', ['status', '--porcelain=v1', '--untracked-files=all', '--', harness],
            { cwd: new URL('.', ROOT), encoding: 'utf8' }
        ).trim();
        assert.equal(status, `?? ${harness}`);
    }
    const untracked = execFileSync(
        'git', ['ls-files', '--others', '--exclude-standard', '-z'],
        { cwd: new URL('.', ROOT), encoding: 'utf8' }
    ).split('\0').filter(Boolean);
    assert.deepEqual(untracked, tracked ? [] : [harness]);
});
