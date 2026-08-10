import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import * as storage from '../../js/storage/index.js';

const ALLOWLIST = Object.freeze([
    'docs/tasks/pr-19-exact-identity.md',
    'docs/migrations/indexeddb-v2.md',
    'js/storage/constants.js',
    'js/storage/schema.js',
    'js/storage/migrations.js',
    'js/storage/database.js',
    'js/storage/exact-identity-resolver.js',
    'js/storage/import-store.js',
    'tests/storage/indexeddb-v2-schema.test.js',
    'tests/storage/indexeddb-v2-browser-smoke.html',
    'tests/storage/backup-manifest.test.js',
    'tests/storage/exact-identity-resolver.test.js',
    'tests/storage/exact-identity-transactions.test.js',
    'tests/storage/exact-identity-boundaries.test.js',
    'tests/storage/exact-identity-performance.test.js',
    'tests/import/exact-identity-import.test.js',
    'tests/import/import-core.test.js',
    'tests/storage/exact-identity-browser-smoke.html',
    'tests/shadow/shadow-boundaries.test.js'
]);

function source(relativePath) {
    return readFile(new URL(`../../${relativePath}`, import.meta.url), 'utf8');
}

test('public storage exports remain the frozen eight-member surface', () => {
    assert.deepEqual(Object.keys(storage).sort(), [
        'STORAGE_ERROR_CODE',
        'StorageError',
        'V2_DATABASE_NAME',
        'V2_DATABASE_VERSION',
        'V2_SCHEMA',
        'createCanonicalStore',
        'createImportStore',
        'createSourceConnectionStore'
    ]);
});

test('Task Brief freezes exactly the approved nineteen literal paths', async () => {
    const brief = await source('docs/tasks/pr-19-exact-identity.md');
    const boundary = brief.match(
        /exactly these 19 cumulative paths[^`]+```text\n([^`]+)```/
    );
    assert.ok(boundary);
    assert.deepEqual(boundary[1].trim().split('\n'), ALLOWLIST);
});

test('resolver depends only on exact storage facts and exposes no public API', async () => {
    const [resolver, publicIndex] = await Promise.all([
        source('js/storage/exact-identity-resolver.js'),
        source('js/storage/index.js')
    ]);
    assert.match(resolver, /byProviderAndExternalId/);
    assert.match(resolver, /fit-session:/);
    assert.doesNotMatch(resolver, /startTimeUtc|distanceMeters|filename|route|statistics/);
    assert.doesNotMatch(resolver, /fetch\s*\(|XMLHttpRequest|WebSocket|console\.|localStorage/);
    assert.doesNotMatch(publicIndex, /exact-identity-resolver/);
});

test('resolver module import performs no I/O, scheduling, logging, or DOM access', async () => {
    const calls = [];
    const originals = {
        fetch: globalThis.fetch,
        setTimeout: globalThis.setTimeout,
        setInterval: globalThis.setInterval,
        log: console.log,
        warn: console.warn,
        error: console.error
    };
    globalThis.fetch = () => { calls.push('fetch'); };
    globalThis.setTimeout = () => { calls.push('timeout'); };
    globalThis.setInterval = () => { calls.push('interval'); };
    console.log = () => { calls.push('log'); };
    console.warn = () => { calls.push('warn'); };
    console.error = () => { calls.push('error'); };
    try {
        const module = await import(
            `../../js/storage/exact-identity-resolver.js?boundary=${Date.now()}`
        );
        assert.equal(typeof module.resolveExactIdentityCandidates, 'function');
        assert.deepEqual(calls, []);
    } finally {
        globalThis.fetch = originals.fetch;
        globalThis.setTimeout = originals.setTimeout;
        globalThis.setInterval = originals.setInterval;
        console.log = originals.log;
        console.warn = originals.warn;
        console.error = originals.error;
    }
});
