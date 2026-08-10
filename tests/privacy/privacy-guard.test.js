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
