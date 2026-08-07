import assert from 'node:assert/strict';
import { access, readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const ROOT_URL = new URL('../../', import.meta.url);
const ROOT_PATH = fileURLToPath(ROOT_URL);

const EXACT_ALLOWLIST = Object.freeze([
    'docs/tasks/pr-24-release-documentation.md',
    'README.md',
    'CHANGELOG.md',
    'docs/README.md',
    'docs/guides/migration-guide.md',
    'docs/guides/backup-guide.md',
    'docs/guides/known-limitations.md',
    'docs/guides/privacy-guide.md',
    'docs/guides/troubleshooting.md',
    'tests/docs/release-docs.test.js'
]);

const RELEASE_DOCS = Object.freeze(EXACT_ALLOWLIST.filter(file => (
    file.endsWith('.md') && !file.startsWith('docs/tasks/')
)));

async function source(relativePath) {
    return readFile(new URL(relativePath, ROOT_URL), 'utf8');
}

function localMarkdownLinks(markdown) {
    return Array.from(markdown.matchAll(/\[[^\]]*\]\(([^)]+)\)/g), match => (
        match[1].trim().replace(/^<|>$/g, '')
    )).filter(target => (
        target.length > 0
        && !target.startsWith('#')
        && !/^[a-z][a-z0-9+.-]*:/i.test(target)
    ));
}

test('PR-24 freezes the literal ten-path release-documentation scope', async () => {
    const brief = await source('docs/tasks/pr-24-release-documentation.md');
    const match = /exact cumulative hard maximum is these ten literal paths[\s\S]*?```text\n([\s\S]*?)\n```/.exec(brief);
    assert.notEqual(match, null);
    assert.deepEqual(match[1].split('\n'), EXACT_ALLOWLIST);
    assert.match(brief, /PASS`, `PARTIAL`, `BLOCKED`, `NOT RUN`, and `NOT APPLICABLE`/);
    assert.match(brief, /Ready is a post-Closure control-tower operation/);
});

test('all seven release-documentation surfaces exist and are substantive', async () => {
    assert.deepEqual(RELEASE_DOCS, [
        'README.md',
        'CHANGELOG.md',
        'docs/README.md',
        'docs/guides/migration-guide.md',
        'docs/guides/backup-guide.md',
        'docs/guides/known-limitations.md',
        'docs/guides/privacy-guide.md',
        'docs/guides/troubleshooting.md'
    ]);
    for (const file of RELEASE_DOCS) {
        const details = await stat(new URL(file, ROOT_URL));
        const markdown = await source(file);
        assert(details.isFile(), file);
        assert(markdown.length >= 500, `${file} is not substantive`);
        assert.match(markdown, /^# /, file);
    }
});

test('local Markdown links in release documents resolve inside the repository', async () => {
    for (const file of RELEASE_DOCS) {
        const markdown = await source(file);
        for (const target of localMarkdownLinks(markdown)) {
            const pathOnly = decodeURIComponent(target.split('#')[0]);
            if (pathOnly.length === 0 || pathOnly.startsWith('/')) continue;
            const absolute = path.resolve(ROOT_PATH, path.dirname(file), pathOnly);
            const relative = path.relative(ROOT_PATH, absolute);
            assert(
                relative === '' || (!relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative)),
                `${file} link escapes repository: ${target}`
            );
            await access(absolute);
        }
    }
});

test('README commands, routes, and release status match executable repository facts', async () => {
    const [readme, packageJson, sourceManager, backup, diagnostics] = await Promise.all([
        source('README.md'),
        source('package.json'),
        source('source-manager.html'),
        source('storage-backup.html'),
        source('diagnostics.html')
    ]);
    const packageData = JSON.parse(packageJson);
    assert.equal(packageData.version, '1.0.0');
    for (const command of [
        'npm ci',
        'npm run dev',
        'npm run check:syntax',
        'npm run check:privacy',
        'npm test'
    ]) assert.match(readme, new RegExp(command.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
    for (const route of [
        '/source-manager.html?mode=real',
        '/storage-backup.html',
        '/diagnostics.html'
    ]) assert.match(readme, new RegExp(route.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
    assert.match(sourceManager, /<title>Sources — StravaStats<\/title>/);
    assert.match(backup, /<title>Storage &amp; Backup — StravaStats<\/title>/);
    assert.match(diagnostics, /<title>Diagnostics — StravaStats<\/title>/);
    assert.match(readme, /not (?:a )?production[\s>]*release/i);
    assert.doesNotMatch(readme, /v2\.0\.0 (?:is |has been )?(?:released|deployed|published)/i);
});

test('guides freeze exact Canonical, V4, backup, privacy, and rollback facts', async () => {
    const [migration, backup, limitations, privacy, troubleshooting, flags, constants, codec] = await Promise.all([
        source('docs/guides/migration-guide.md'),
        source('docs/guides/backup-guide.md'),
        source('docs/guides/known-limitations.md'),
        source('docs/guides/privacy-guide.md'),
        source('docs/guides/troubleshooting.md'),
        source('js/app/feature-flags.js'),
        source('js/storage/constants.js'),
        source('js/backup/codec.js')
    ]);
    assert.match(flags, /dataRepositoryMode: 'canonical'/);
    assert.match(constants, /V2_DATABASE_VERSION = 4/);
    assert.match(constants, /V2_SCHEMA_ID = 'strava-stats-v2@4'/);
    assert.match(codec, /BACKUP_BYTE_LIMIT = 268_435_456/);
    for (const pattern of [
        /physical(?:ly)? (?:separate|isolated)/i,
        /no automatic (?:copy|migration)/i,
        /`legacy`[\s\S]*`shadow`[\s\S]*`canonical`/i,
        /First-run/i,
        /IndexedDB[^\n]*V4/i,
        /non-destructive rollback/i
    ]) assert.match(migration, pattern);
    for (const pattern of [
        /exact-current/i,
        /256 MiB/,
        /absent(?: V2 database)? or (?:an )?(?:exact )?empty/i,
        /`already_restored`/,
        /`TARGET_NOT_EMPTY`/,
        /`SETTINGS_PENDING`/
    ]) assert.match(backup, pattern);
    for (const pattern of [
        /production Service Worker/i,
        /Safari/i,
        /Firefox/i,
        /third-party CDN/i,
        /telemetry/i,
        /release[- ]owner/i
    ]) assert.match(limitations, pattern);
    for (const pattern of [
        /Token/,
        /Authorization/,
        /GPS/,
        /heart-rate/i,
        /power/,
        /synthetic/i,
        /Diagnostics[^\n]*not[^\n]*backup/i
    ]) assert.match(privacy, pattern);
    for (const code of [
        'VERSION_UNSUPPORTED',
        'SCHEMA_MISMATCH',
        'STORAGE_QUOTA_EXCEEDED',
        'TARGET_NOT_EMPTY',
        'SETTINGS_PENDING'
    ]) assert.match(troubleshooting, new RegExp(code));
});

test('release prose keeps compatibility and external-resource evidence qualified', async () => {
    const text = (await Promise.all(RELEASE_DOCS.map(source))).join('\n');
    assert.match(text, /Chromium|Chrome/);
    assert.match(text, /(?:not verified|not run|unverified)[^\n]*(?:Safari|Firefox)|(?:Safari|Firefox)[^\n]*(?:not verified|not run|unverified)/i);
    assert.match(text, /third-party CDN/i);
    assert.match(text, /telemetry/i);
    assert.match(text, /not fully offline/i);
    assert.match(text, /Ready[^\n]*not[^\n]*(?:merge|release)/i);
    assert.doesNotMatch(text, /(?:all|fully) cross-browser (?:tests? )?(?:pass|passed)/i);
    assert.doesNotMatch(text, /production (?:deployment|release|Service Worker)[^\n]*(?:pass|passed|complete)/i);
});

test('backup and privacy guides disclose shared Legacy-compatible settings truthfully', async () => {
    const [backup, privacy] = await Promise.all([
        source('docs/guides/backup-guide.md'),
        source('docs/guides/privacy-guide.md')
    ]);
    for (const document of [backup, privacy]) {
        assert.match(document, /shared Legacy-compatible (?:user )?settings/i);
        assert.match(document, /add(?:ed|itive)[^\n]*(?:restore|settings)|restore[^\n]*add(?:ed|itive)/i);
        assert.match(document, /does not include[^\n]*Legacy activity/i);
    }
    assert.match(backup, /TARGET_SETTINGS_CONFLICT/);
});

test('release blockers disclose inherited raw console and server logging', async () => {
    const [limitations, privacy, brief] = await Promise.all([
        source('docs/guides/known-limitations.md'),
        source('docs/guides/privacy-guide.md'),
        source('docs/tasks/pr-24-release-documentation.md')
    ]);
    for (const document of [limitations, privacy, brief]) {
        assert.match(document, /raw console[^\n]*(?:server|API)|(?:server|API)[^\n]*raw console/i);
        assert.match(document, /release blocker/i);
        assert.match(document, /exact (?:activity )?(?:location|coordinates)[^\n]*(?:date|external)|exact[^\n]*date[^\n]*(?:location|coordinates|external)/i);
    }
    assert.match(privacy, /safe Diagnostics[^\n]*does not[^\n]*all application logs/i);
});

test('release-gate status does not claim a conditional PASS', async () => {
    const brief = await source('docs/tasks/pr-24-release-documentation.md');
    assert.doesNotMatch(brief, /advances[^\n]*`PASS`[^\n]*subject to/i);
    assert.match(brief, /Migration\/Backup\/Privacy\/Troubleshooting docs complete \| (?:PARTIAL|PASS) \|/);
});

test('safe-code claims remain scoped to reviewed V2 boundaries', async () => {
    const readme = await source('README.md');
    assert.match(readme, /reviewed V2 (?:Import|import)[^\n]*(?:Backup|backup)[^\n]*Diagnostics[^\n]*safe codes/i);
    assert.doesNotMatch(readme, /Public errors and Diagnostics use fixed safe codes/i);
});

test('migration guide distinguishes partial overrides from invalid feature flags', async () => {
    const migration = await source('docs/guides/migration-guide.md');
    assert.match(migration, /omitted fields?[^\n]*(?:use|fall back to|default)/i);
    assert.doesNotMatch(migration, /invalid, incomplete[^\n]*fails? closed/i);
});

test('served routes are code, not root-absolute GitHub Markdown links', async () => {
    for (const file of RELEASE_DOCS) {
        for (const target of localMarkdownLinks(await source(file))) {
            assert(!target.startsWith('/'), `${file} has a root-absolute Markdown link: ${target}`);
        }
    }
});
