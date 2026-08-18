import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { findContentViolation } from '../../scripts/check-privacy.mjs';

const MAPPER = new URL(
    '../../js/connectors/strava/strava-import-mapper.js',
    import.meta.url
);
const FIXTURE = new URL(
    '../fixtures/synthetic/strava/api-import-fixture.js',
    import.meta.url
);
const C3B_FILES = Object.freeze([
    '../../js/import/strava-provider-artifact.js',
    '../../js/import/import-service.js',
    '../../js/import/synthetic-import-worker.js',
    '../../js/storage/import-store.js',
    '../../js/backup/backup-service.js'
]);
const C1_BROWSER_FILES = Object.freeze([
    '../../js/source-manager.js',
    '../../js/app/source-manager.js',
    '../../js/app/source-manager-connection.js',
    '../../js/app/source-manager-authorization.js',
    '../../js/pages/source-manager/source-manager.js'
]);
const C3C_BROWSER_FILES = Object.freeze([
    '../../js/app/source-manager.js',
    '../../js/app/source-manager-provider-sync.js',
    '../../js/connectors/strava/strava-sync-connector.js',
    '../../js/pages/source-manager/source-manager.js'
]);

test('C3a production mapper contains no credential, storage, provider route, or logging seam', async () => {
    const source = await readFile(MAPPER, 'utf8');
    assert.doesNotMatch(
        source,
        /access_token|refresh_token|client_secret|Bearer\s|https?:\/\/|strava\.com|\/api\//i
    );
    assert.doesNotMatch(
        source,
        /localStorage|sessionStorage|indexedDB|document\.|window\.|console\.|fetch\s*\(|XMLHttpRequest|WebSocket/
    );
    assert.doesNotMatch(source, /tests\/fixtures\/private|profile\s*\.|athlete\s*\./);
    assert.equal(findContentViolation('strava-import-mapper.js', source), null);
});

test('C3a fixture is tracked synthetic code, not an account response or export', async () => {
    const source = await readFile(FIXTURE, 'utf8');
    assert.doesNotMatch(
        source,
        /access_token|refresh_token|client_secret|Bearer\s|https?:\/\/|strava\.com|tests\/fixtures\/private/i
    );
    assert.doesNotMatch(source, /parseInt|parseFloat|BigInt|Number\s*\(/);
    assert.match(source, /SYNTHETIC/g);
    assert.equal(findContentViolation(
        'tests/fixtures/synthetic/strava/api-import-fixture.js',
        source
    ), null);
});

test('C3a mapper drops provider profile, route, gear, device, and name fields', async () => {
    const source = await readFile(MAPPER, 'utf8');
    for (const field of ['name', 'athlete', 'map', 'gear_id', 'device_name']) {
        assert.match(source, new RegExp(`['"]${field}['"]`));
    }
    assert.match(source, /PRIVATE_FIELDS_DROPPED/);
    assert.doesNotMatch(source, /summary_polyline|serial_number|device_serial|route_url/);
});

test('C3b provider artifact path has no credential, network, logging, or private-fixture seam', async () => {
    const sources = await Promise.all(C3B_FILES.map(async relative => ({
        relative,
        source: await readFile(new URL(relative, import.meta.url), 'utf8')
    })));
    for (const { relative, source } of sources) {
        assert.doesNotMatch(
            source,
            /access_token|refresh_token|client_secret|Bearer\s|https?:\/\/|strava\.com|tests\/fixtures\/private/i,
            relative
        );
        assert.doesNotMatch(
            source,
            /console\.|fetch\s*\(|XMLHttpRequest|WebSocket|localStorage|sessionStorage/,
            relative
        );
        assert.equal(findContentViolation(relative, source), null, relative);
    }
});

test('C1.1 browser authorization stays same-origin, redacted, and outside page/provider selection', async () => {
    const sources = await Promise.all(C1_BROWSER_FILES.map(async relative => ({
        relative,
        source: await readFile(new URL(relative, import.meta.url), 'utf8')
    })));
    for (const { relative, source } of sources) {
        assert.doesNotMatch(source, /console\.|tests\/fixtures\/private/i, relative);
        assert.doesNotMatch(source, /client_secret|Authorization\s*:/, relative);
        assert.equal(findContentViolation(relative, source), null, relative);
    }
    const authorization = sources.find(item => item.relative.endsWith('source-manager-authorization.js')).source;
    assert.match(authorization, /\/api\/config/);
    assert.match(authorization, /\/api\/strava-auth/);
    assert.match(authorization, /\/api\/strava-revoke/);
    assert.match(authorization, /credentials: 'same-origin'/);
    assert.doesNotMatch(authorization, /oauth\/deauthorize|fetch\(['"]https:\/\/www\.strava\.com/);

    const page = sources.find(item => item.relative.endsWith('pages/source-manager/source-manager.js')).source;
    assert.doesNotMatch(page, /access_token|refresh_token|subject_id|granted_scopes|localStorage|sessionStorage/);
});

test('C3c provider Sync keeps credentials and provider selection outside page/DOM/log surfaces', async () => {
    const sources = await Promise.all(C3C_BROWSER_FILES.map(async relative => ({
        relative,
        source: await readFile(new URL(relative, import.meta.url), 'utf8')
    })));
    for (const { relative, source } of sources) {
        assert.doesNotMatch(source, /console\.|tests\/fixtures\/private/i, relative);
        assert.equal(findContentViolation(relative, source), null, relative);
    }

    const app = sources.find(item => item.relative.endsWith('app/source-manager.js')).source;
    const controller = sources.find(item => item.relative.endsWith('source-manager-provider-sync.js')).source;
    const connector = sources.find(item => item.relative.endsWith('strava-sync-connector.js')).source;
    const page = sources.find(item => item.relative.endsWith('pages/source-manager/source-manager.js')).source;
    assert.doesNotMatch(app, /access_token|refresh_token|Authorization\s*:|https?:\/\//i);
    assert.doesNotMatch(controller, /access_token|refresh_token|Authorization\s*:|https?:\/\/|localStorage|sessionStorage/i);
    assert.doesNotMatch(page, /access_token|refresh_token|subject_id|granted_scopes|localStorage|sessionStorage|\/api\//i);
    assert.match(connector, /fetchImpl\('\/api\/strava-sync'/);
    assert.match(connector, /credentials: 'same-origin'/);
    assert.match(connector, /cache: 'no-store'/);
    assert.match(connector, /referrerPolicy: 'no-referrer'/);
    assert.doesNotMatch(connector, /fetchImpl\([^\n]*activityId|strava\.com|https?:\/\//i);
});
