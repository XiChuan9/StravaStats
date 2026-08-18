import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const importIndex = new URL('../../js/import/index.js', import.meta.url);

test('Import Core public exports stay frozen and do not expand Repository', async () => {
    const module = await import(`${importIndex.href}?boundary=${Date.now()}`);
    assert.deepEqual(Object.keys(module).sort(), [
        'IMPORT_ERROR_CODE',
        'IMPORT_ITEM_STATUS',
        'IMPORT_JOB_STATUS',
        'ImportError',
        'SYNTHETIC_JSON_MEDIA_TYPE',
        'assertImportItemTransition',
        'assertImportJobTransition',
        'createBrowserImportWorker',
        'createDecoderRegistry',
        'createImportService',
        'createInlineImportWorker',
        'normalizeImportedActivity',
        'syntheticJsonDecoder'
    ]);
    const repository = await import('../../js/repository/index.js');
    assert.equal(Object.keys(repository).includes('importActivities'), false);
});

test('production Import Core has no provider, network, DOM, logging, or destructive storage seam', async () => {
    const files = [
        'activities-csv-decoder.js', 'activities-preview.js', 'csv-tokenizer.js',
        'decoder-registry.js', 'errors.js', 'import-service.js',
        'index.js', 'normalizer.js', 'safe-data.js', 'state-machine.js',
        'strava-provider-artifact.js', 'strava-zip.js', 'synthetic-import-worker.js',
        'synthetic-json-decoder.js', 'worker-client.js', 'zip-inspector.js'
    ];
    const source = (await Promise.all(files.map(file => readFile(
        new URL(`../../js/import/${file}`, import.meta.url),
        'utf8'
    )))).join('\n');
    assert.doesNotMatch(source, /fetch\s*\(|XMLHttpRequest|WebSocket|Authorization|Bearer/);
    assert.doesNotMatch(
        source,
        /console\.|document\.|localStorage|deleteDatabase|objectStore\([^)]*\)\.clear\s*\(/
    );
    assert.doesNotMatch(source, /strava\.com|DOMParser|FileReader/);
    assert.doesNotMatch(
        source,
        /TrainingCenterDatabase|topografix|FIT_EPOCH|parseXml|\.FIT.{0,40}(DataView|Uint8Array)/i
    );
    assert.doesNotMatch(source, /parseFit|decodeFit|parseTcx|decodeTcx|parseGpx|decodeGpx/i);
});

test('C3a mapper stays outside Import Core, Worker, and provider I/O boundaries', async () => {
    const mapper = await readFile(new URL(
        '../../js/connectors/strava/strava-import-mapper.js',
        import.meta.url
    ), 'utf8');
    assert.match(mapper, /\.\.\/\.\.\/data\/contracts\/index\.js/);
    assert.doesNotMatch(
        mapper,
        /from\s+['"][^'"]*(?:\/import\/|worker|storage|repository|backup|strava-api-connector)/i
    );
    assert.doesNotMatch(
        mapper,
        /fetch\s*\(|XMLHttpRequest|WebSocket|Bearer|strava\.com|\/api\/|localStorage|sessionStorage|indexedDB|Worker/
    );
    const publicImport = await import(`${importIndex.href}?c3a=${Date.now()}`);
    assert.equal(Object.hasOwn(publicImport, 'createStravaImportMapper'), false);
    assert.equal(Object.hasOwn(publicImport, 'mapActivities'), false);
});

test('C3b freezes the direct internal seam, approval, and exact sixteen-path ceiling', async () => {
    const direct = await import(
        `../../js/import/strava-provider-artifact.js?boundary=${Date.now()}`
    );
    const publicImport = await import(`${importIndex.href}?c3b=${Date.now()}`);
    assert.equal(Object.hasOwn(publicImport, 'createStravaProviderArtifacts'), false);
    assert.equal(Object.hasOwn(publicImport, 'STRAVA_PROVIDER_ARTIFACT_MEDIA_TYPE'), false);
    assert.deepEqual(Object.keys(direct).sort(), [
        'STRAVA_PROVIDER_ARTIFACT_ERROR_CODE',
        'STRAVA_PROVIDER_ARTIFACT_LIMITS',
        'STRAVA_PROVIDER_ARTIFACT_MEDIA_TYPE',
        'StravaProviderArtifactError',
        'createStravaProviderArtifacts',
        'stravaProviderArtifactDecoder'
    ]);
    const brief = await readFile(new URL(
        '../../docs/tasks/pr-43b-provider-artifact-import.md',
        import.meta.url
    ), 'utf8');
    const paths = [
        'docs/tasks/pr-43b-provider-artifact-import.md',
        'js/import/AGENTS.md',
        'js/import/strava-provider-artifact.js',
        'js/import/import-service.js',
        'js/import/synthetic-import-worker.js',
        'js/storage/import-store.js',
        'js/backup/backup-service.js',
        'tests/import/strava-provider-artifact.test.js',
        'tests/import/import-core.test.js',
        'tests/import/import-worker.test.js',
        'tests/import/decoder-registry-wiring.test.js',
        'tests/import/exact-identity-import.test.js',
        'tests/import/import-boundaries.test.js',
        'tests/backup/backup-service.test.js',
        'tests/backup/backup-boundaries.test.js',
        'tests/privacy/privacy-guard.test.js'
    ];
    assert.equal(new Set(paths).size, 16);
    for (const path of paths) assert.equal(brief.includes(path), true, path);
    assert.match(brief, /批准 C3b-P1 及完整合同和精确 16 路径上限/);
    assert.match(brief, /No seventeenth path is authorized/);
});

test('PR-09 keeps the literal 18-path allowlist and fixed archive boundaries', async () => {
    const brief = await readFile(new URL(
        '../../docs/tasks/pr-09-strava-zip.md',
        import.meta.url
    ), 'utf8');
    const allowed = [
        'docs/tasks/pr-09-strava-zip.md',
        'js/import/AGENTS.md',
        'js/import/errors.js',
        'js/import/activities-csv-decoder.js',
        'js/import/zip-inspector.js',
        'js/import/strava-zip.js',
        'js/import/synthetic-import-worker.js',
        'tests/fixtures/synthetic/strava/archive-fixture.js',
        'tests/fixtures/synthetic/strava/README.md',
        'tests/import/strava-zip.test.js',
        'tests/import/import-worker.test.js',
        'js/import/import-service.js',
        'js/storage/import-store.js',
        'tests/import/import-core.test.js',
        'tests/import/import-boundaries.test.js',
        'tests/storage/indexeddb-v2-boundaries.test.js',
        'tests/import/import-browser-smoke.html',
        'tests/shadow/shadow-boundaries.test.js'
    ];
    assert.equal(new Set(allowed).size, 18);
    for (const relative of allowed) assert.equal(brief.includes(relative), true, relative);
    assert.match(brief, /cumulative maximum is exactly 18 paths/i);
    assert.match(brief, /A nineteenth path requires/i);
    assert.match(brief, /Do not add a production dependency/i);
    assert.match(brief, /physical\/store\/index migration/i);
    assert.match(brief, /aggregate\/public Import API expansion/i);
});

test('PR-08 keeps the deterministic CSV fixture and literal 18-path allowlist', async () => {
    const fixture = await readFile(new URL(
        '../fixtures/synthetic/strava/activities.csv',
        import.meta.url
    ));
    assert.equal(
        createHash('sha256').update(fixture).digest('hex'),
        'e1a5927ae7e1bcc3f65c33f9f2dee7976b648a43981f8a1f85c7a51720cf9dec'
    );
    const brief = await readFile(new URL(
        '../../docs/tasks/pr-08-activities-csv.md',
        import.meta.url
    ), 'utf8');
    const allowed = [
        'docs/tasks/pr-08-activities-csv.md',
        'js/import/AGENTS.md',
        'js/import/index.js',
        'js/import/errors.js',
        'js/import/csv-tokenizer.js',
        'js/import/activities-csv-decoder.js',
        'js/import/synthetic-import-worker.js',
        'tests/fixtures/synthetic/strava/activities.csv',
        'tests/fixtures/synthetic/strava/README.md',
        'tests/import/activities-csv.test.js',
        'tests/import/import-worker.test.js',
        'js/import/import-service.js',
        'js/storage/import-store.js',
        'tests/import/import-core.test.js',
        'tests/import/import-boundaries.test.js',
        'tests/storage/indexeddb-v2-boundaries.test.js',
        'tests/import/import-browser-smoke.html',
        'tests/shadow/shadow-boundaries.test.js'
    ];
    assert.equal(new Set(allowed).size, 18);
    for (const relative of allowed) assert.equal(brief.includes(relative), true);
    assert.match(brief, /cumulative maximum[^\n]*18 paths/i);
    assert.match(brief, /nineteenth path requires/i);
});

test('PR-07 keeps the deterministic fixture and literal 34-path allowlist', async () => {
    const fixture = await readFile(new URL(
        '../fixtures/synthetic/canonical/import-run-summary.json',
        import.meta.url
    ));
    assert.equal(
        createHash('sha256').update(fixture).digest('hex'),
        'bb9a189dfc89b4948a7fe0a7e43a4c7ea655de34190a822cd08e2eca4d183058'
    );
    const brief = await readFile(new URL(
        '../../docs/tasks/pr-07-import-core.md',
        import.meta.url
    ), 'utf8');
    const allowed = [
        'docs/tasks/pr-07-import-core.md',
        'js/import/AGENTS.md',
        'js/import/activities-preview.js',
        'js/import/decoder-registry.js',
        'js/import/errors.js',
        'js/import/import-service.js',
        'js/import/index.js',
        'js/import/normalizer.js',
        'js/import/safe-data.js',
        'js/import/state-machine.js',
        'js/import/synthetic-import-worker.js',
        'js/import/synthetic-json-decoder.js',
        'js/import/worker-client.js',
        'js/storage/canonical-store.js',
        'js/storage/constants.js',
        'js/storage/database.js',
        'js/storage/import-store.js',
        'js/storage/index.js',
        'js/storage/migrations.js',
        'js/storage/schema.js',
        'tests/fixtures/synthetic/canonical/README.md',
        'tests/fixtures/synthetic/canonical/import-run-summary.json',
        'tests/import/import-boundaries.test.js',
        'tests/import/import-browser-smoke.html',
        'tests/import/import-core.test.js',
        'tests/import/import-state-machine.test.js',
        'tests/import/import-worker.test.js',
        'tests/shadow/shadow-boundaries.test.js',
        'tests/storage/backup-manifest.test.js',
        'tests/storage/canonical-store.test.js',
        'tests/storage/indexeddb-v2-boundaries.test.js',
        'tests/storage/indexeddb-v2-browser-smoke.html',
        'tests/storage/indexeddb-v2-schema.test.js',
        'tests/storage/indexeddb-v2-transactions.test.js'
    ];
    assert.equal(new Set(allowed).size, 34);
    for (const relative of allowed) assert.equal(brief.includes(relative), true);
    assert.match(brief, /cumulative maximum[^\n]*34 paths/i);
    assert.match(brief, /35th path requires a necessity record/i);
});
