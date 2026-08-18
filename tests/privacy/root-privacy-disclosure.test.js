import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { createLocalDevServer } from '../../scripts/local-dev-server.mjs';

const PROJECT_ROOT = new URL('../../', import.meta.url);
const EXPECTED_DISCLOSURE = 'Privacy Notice: Your activity library is stored locally in your browser by default. Only explicit actions or consents may contact external services for Strava provider operations, Weather, AI Coach, or OpenStreetMap tiles, each under its existing separate disclosure.';
const EXPECTED_DISCLOSURE_MARKUP = `<strong>Privacy Notice:</strong> ${EXPECTED_DISCLOSURE.replace('Privacy Notice: ', '')}`;
const NORMALIZED_BASE_ROOT_SHA256 = '0311db6888ae8683c363af2587a0259034b602c373a19a6342a97e8b397fbe62';
const ALLOWLIST = Object.freeze([
    'docs/tasks/pr-39-root-privacy-disclosure.md',
    'index.html',
    'tests/privacy/root-privacy-disclosure.test.js'
]);

async function source(relativePath) {
    return readFile(new URL(relativePath, PROJECT_ROOT), 'utf8');
}

function disclosureText(html) {
    const matches = [...html.matchAll(/<div class="privacy-policy"[^>]*>([\s\S]*?)<\/div>/g)];
    assert.equal(matches.length, 1, 'exactly one root privacy disclosure');
    const markup = matches[0][1].replace(/\s+/g, ' ').trim();
    assert.equal(markup, EXPECTED_DISCLOSURE_MARKUP, 'exact strong-plus-text structure');
    return markup
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

function rootWithoutDisclosureCopy(html) {
    const expression = /(<div class="privacy-policy"[^>]*>)[\s\S]*?(<\/div>)/g;
    assert.equal([...html.matchAll(expression)].length, 1, 'one replaceable disclosure');
    return html.replace(expression, '$1PR39_DISCLOSURE$2');
}

test('root static disclosure states the exact bounded local-first truth', async () => {
    const html = await source('index.html');
    const disclosure = disclosureText(html);

    assert.equal(disclosure, EXPECTED_DISCLOSURE);
    assert.doesNotMatch(disclosure, /processed in your browser only/i);
    assert.doesNotMatch(disclosure, /nothing is stored or sent to any server/i);

    for (const phrase of [
        'stored locally in your browser by default',
        'explicit actions or consents',
        'Strava provider operations',
        'Weather',
        'AI Coach',
        'OpenStreetMap tiles',
        'existing separate disclosure'
    ]) assert.equal(disclosure.includes(phrase), true, phrase);

    assert.doesNotMatch(disclosure, /https?:|\/api\/|\.com\b|token|authorization|activity IDs?|coordinates?|heart rate|power/i);
});

test('only the root disclosure copy differs from the exact integration base', async () => {
    const html = await source('index.html');
    const normalized = rootWithoutDisclosureCopy(html);
    assert.equal(
        createHash('sha256').update(normalized).digest('hex'),
        NORMALIZED_BASE_ROOT_SHA256
    );
});

test('Task Brief freezes the literal three-path maximum and unchanged contracts', async () => {
    const brief = await source('docs/tasks/pr-39-root-privacy-disclosure.md');
    const block = brief.match(/The exact maximum is three paths:\n\n```text\n([\s\S]*?)\n```/);
    assert.ok(block, 'literal cumulative allowlist block');
    assert.deepEqual(block[1].split('\n'), ALLOWLIST);
    assert.match(brief, /R6 Weather, R7 AI Coach, R8 maps, R9 request\/response policy, R10 Source Manager, R11/);
    assert.match(brief, /Service Worker lifecycle remain behaviorally unchanged/);
    assert.match(brief, /No migration or destructive operation is authorized/);
});

test('actual served root and SPA rewrite expose the same corrected disclosure', async t => {
    const server = createLocalDevServer();
    await new Promise((resolve, reject) => {
        server.once('error', reject);
        server.listen(0, '127.0.0.1', resolve);
    });
    t.after(() => new Promise(resolve => server.close(resolve)));

    const address = server.address();
    assert.ok(address && typeof address === 'object');
    for (const pathname of ['/', '/ai-coach']) {
        const response = await fetch(`http://127.0.0.1:${address.port}${pathname}`, {
            cache: 'no-store',
            redirect: 'error'
        });
        assert.equal(response.status, 200, pathname);
        assert.match(response.headers.get('content-type') || '', /^text\/html\b/);
        assert.equal(disclosureText(await response.text()), EXPECTED_DISCLOSURE, pathname);
    }
});
