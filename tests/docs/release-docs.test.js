import assert from 'node:assert/strict';
import { access, readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const ROOT_URL = new URL('../../', import.meta.url);
const ROOT_PATH = fileURLToPath(ROOT_URL);
const PUBLIC_SCOPE_BASE = '6924e7c77036c9a743f908936a28a2719936b726';
const PUBLIC_SCOPE_TREE = '7e771d4202e6b2be45521aaedf1fb0704fbf6426';
const PUBLIC_SCOPE_BRIEF = 'docs/tasks/public-local-import-core-freeze.md';

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

const FINAL_ROADMAP_ALLOWLIST = Object.freeze([
    'docs/tasks/pr-47-final-v2-release-roadmap.md',
    'docs/engineering/release-gates.md',
    'docs/guides/known-limitations.md',
    'docs/README.md',
    'tests/docs/release-docs.test.js'
]);

const ALPHA_CONTRACT_ALLOWLIST = Object.freeze([
    'docs/tasks/pr-48-alpha-contract.md',
    'docs/engineering/release-gates.md',
    'tests/docs/release-docs.test.js'
]);

const REMAINING_GATE_ROWS = Object.freeze([
    ['G2', 'C', 'NOT RUN', 'RC / production'],
    ['G3', 'B + C', 'PARTIAL', 'RC / production'],
    ['G5', 'C', 'NOT RUN', 'RC / production'],
    ['G6', 'C', 'NOT RUN', 'RC / production'],
    ['G7', 'B + C', 'BLOCKED', 'RC / production'],
    ['G8', 'B', 'PARTIAL', 'RC / production after 2026-11-12'],
    ['G9', 'B + C', 'BLOCKED', 'RC / production'],
    ['G10', 'B + D', 'BLOCKED', 'RC / production'],
    ['G12', 'A', 'NOT RUN', 'Alpha / Beta / RC / production'],
    ['G13', 'F', 'PARTIAL', 'Alpha / Beta / RC / production']
]);

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

test('pre-freeze PR-24 historical record freezes its literal ten-path scope', async () => {
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

test('README presents the current public local-import core and executable repository facts', async () => {
    const [readme, packageJson, sourceManager, backup, diagnostics] = await Promise.all([
        source('README.md'),
        source('package.json'),
        source('source-manager.html'),
        source('storage-backup.html'),
        source('diagnostics.html')
    ]);
    const packageData = JSON.parse(packageJson);
    assert.equal(packageData.version, '2.0.0-alpha.1');
    for (const command of [
        'npm ci',
        'npm run dev',
        'npm run check:syntax',
        'npm run check:privacy',
        'npm test',
        'git diff --check'
    ]) assert.match(readme, new RegExp(command.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
    for (const route of [
        '/source-manager.html?mode=real',
        '/storage-backup.html',
        '/diagnostics.html'
    ]) assert.match(readme, new RegExp(route.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
    assert.match(sourceManager, /<title>Sources — StravaStats<\/title>/);
    assert.match(backup, /<title>Storage &amp; Backup — StravaStats<\/title>/);
    assert.match(diagnostics, /<title>Diagnostics — StravaStats<\/title>/);
    assert.match(readme, /public local-import core/i);
    assert.match(readme, /source-neutral[\s\S]{0,120}Canonical/i);
    assert.match(readme, /FIT, TCX, GPX, CSV, ZIP/i);
    assert.match(readme, /Source Manager/i);
    assert.match(readme, /Repository/i);
    assert.match(readme, /Backup\/Restore/i);
    assert.match(readme, /Diagnostics/i);
    assert.match(readme, /not an Alpha, Beta, Release Candidate, production release/i);
    assert.doesNotMatch(readme, /v2\.0\.0 (?:is |has been )?(?:released|deployed|published)/i);
});

test('current documentation index and changelog share the public scope-freeze authority', async () => {
    const [index, changelog] = await Promise.all([
        source('docs/README.md'),
        source('CHANGELOG.md')
    ]);
    for (const document of [index, changelog]) {
        assert.match(document, new RegExp(PUBLIC_SCOPE_BASE));
        assert.match(document, new RegExp(PUBLIC_SCOPE_TREE));
        assert.match(document, /Public Local Import Core/i);
        assert.match(document, /not an Alpha, Beta, Release Candidate, production release/i);
    }
    assert.match(index, /Current public-scope authority[\s\S]{0,160}public-local-import-core-freeze\.md/i);
    assert.match(index, /pre-freeze point-in-time/i);
    assert.match(changelog, /FIT, TCX, GPX, CSV, and ZIP/i);
    assert.match(changelog, /IndexedDB version, schema, migrations, and backup format are unchanged/i);
});

test('current public scope brief freezes retained capabilities and non-destructive boundaries', async () => {
    const brief = await source(PUBLIC_SCOPE_BRIEF);
    assert(brief.includes(`| Base commit | \`${PUBLIC_SCOPE_BASE}\` |`));
    assert(brief.includes(`| Base tree | \`${PUBLIC_SCOPE_TREE}\` |`));
    for (const pattern of [
        /Canonical activities and streams/i,
        /Repository, Projection, and Source Manager/i,
        /local FIT and TCX import/i,
        /CSV, ZIP, and GPX import/i,
        /Exact Identity/i,
        /Backup\/Restore/i,
        /Diagnostics/i,
        /optional Strava source/i
    ]) assert.match(brief, pattern);

    assert.match(brief, /public tree no longer exposes[\s\S]{0,180}navigation, tabs, routes[\s\S]{0,80}styles/i);
    assert.match(brief, /IndexedDB V2 version, schema, stores, indexes, migrations/i);
    assert.match(brief, /Existing Cache Storage entries are not cleared or migrated/i);
    assert.match(brief, /must not read, remove, rename, rewrite, migrate, or exclude/i);

    const retiredNamespace = ['run', 'plus'].join('_');
    const retiredSubproduct = ['ns', 'm'].join('');
    const expectedKeys = [
        `${retiredNamespace}_capacity_inputs_v1`,
        `${retiredNamespace}_${retiredSubproduct}_settings_v1`,
        `${retiredNamespace}_${retiredSubproduct}_activity_tags_v1`,
        `${retiredNamespace}_${retiredSubproduct}_session_inputs_v1`,
        `${retiredNamespace}_${retiredSubproduct}_tests_v1`,
        `${retiredNamespace}_${retiredSubproduct}_interval_analysis_v1`
    ];
    for (const key of expectedKeys) assert.match(brief, new RegExp(`^${key}$`, 'm'));

    assert.match(brief, /Alpha, Beta, RC, or production claim is authorized/i);
    assert.match(brief, /License change \\| Not part of this pull request/i);
    assert.match(brief, /does not delete branches, rewrite history, clear caches, remove LocalStorage/i);
});

test('guides freeze exact Canonical, V6, backup compatibility, privacy, and rollback facts', async () => {
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
    assert.match(constants, /V2_DATABASE_VERSION = 6/);
    assert.match(constants, /V2_SCHEMA_ID = 'strava-stats-v2@6'/);
    assert.match(codec, /BACKUP_BYTE_LIMIT = 268_435_456/);
    for (const pattern of [
        /physical(?:ly)? (?:separate|isolated)/i,
        /no automatic (?:copy|migration)/i,
        /`legacy`[\s\S]*`shadow`[\s\S]*`canonical`/i,
        /First-run/i,
        /IndexedDB[^\n]*V6/i,
        /non-destructive rollback/i
    ]) assert.match(migration, pattern);
    for (const pattern of [
        /exact-current/i,
        /256 MiB/,
        /absent(?: V2 database)? or (?:an )?(?:exact )?empty/i,
        /`already_restored`/,
        /`TARGET_NOT_EMPTY`/,
        /`SETTINGS_PENDING`/,
        /format 1\/V4/i,
        /format 2\/V5/i,
        /format 3\/V6/i,
        /ACTIVE_SOURCE_OPERATION/,
        /reconnect_required/
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
    assert.match(text, /scope freeze[^\n]*(?:not|does not)[^\n]*(?:release|deployment)/i);
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

test('current public prose preserves provider, privacy, cache, and rollback boundaries', async () => {
    const [readme, gates, limitations, privacy] = await Promise.all([
        source('README.md'),
        source('docs/engineering/release-gates.md'),
        source('docs/guides/known-limitations.md'),
        source('docs/guides/privacy-guide.md')
    ]);

    assert.doesNotMatch(readme, /Connect later/i);
    for (const pattern of [
        /Connect\/Reconnect|Connect[^\n]*Reconnect/i,
        /Sync latest 25/,
        /Disconnect/,
        /Recover\/Abandon|Recover[^\n]*Abandon/i,
        /eligible[^\n]*Retry|Retry[^\n]*eligible/i
    ]) assert.match(readme, pattern);
    assert.match(readme, /Connect\/Reconnect[\s\S]{0,120}provider authorization/i);
    assert.match(readme, /callback exchange[\s\S]{0,120}same-origin/i);
    assert.match(readme, /Disconnect[\s\S]{0,120}(?:revoke|revocation)[\s\S]{0,120}same-origin/i);
    assert.match(readme, /Sync latest 25[\s\S]{0,120}same-origin/i);
    assert.match(readme, /Legacy\s+provider/i);
    assert.match(readme, /weather[\s\S]{0,100}map[\s\S]{0,100}AI[\s\S]{0,100}(?:separate|consent)/i);

    assert.match(gates, /Current public scope-freeze gate/i);
    assert.match(gates, new RegExp(PUBLIC_SCOPE_BASE));
    assert.match(gates, new RegExp(PUBLIC_SCOPE_TREE));
    assert.match(gates, /FIT\/TCX\/GPX\/CSV\/ZIP imports/i);
    assert.match(gates, /no IndexedDB version, schema, store, migration/i);
    assert.match(gates, /no Cache Storage cleanup is introduced/i);
    for (const pattern of [
        /\| Real account \/ private library \| (?:PARTIAL|BLOCKED|NOT RUN) \|/i,
        /\| Browser \/ platform \| (?:PARTIAL|BLOCKED|NOT RUN) \|/i,
        /\| Production Service Worker \/ deployment \/ combined rollback \| (?:PARTIAL|BLOCKED|NOT RUN) \|/i,
        /\| Version \/ tag \/ artifact \/ release owner \| (?:PARTIAL|BLOCKED|NOT RUN) \|/i
    ]) assert.match(gates, pattern);
    for (const pattern of [
        /\| Real account \/ private library \| PASS \|/i,
        /\| Browser \/ platform \| PASS \|/i,
        /\| Production Service Worker \/ deployment \/ combined rollback \| PASS \|/i,
        /\| Version \/ tag \/ artifact \/ release owner \| PASS \|/i
    ]) assert.doesNotMatch(gates, pattern);
    assert.match(gates, /\| R3 public Git history \| CLOSED BY DISPOSITION \|/i);
    assert.match(gates, /no-rewrite[\s\S]{0,120}not erasure/i);

    for (const document of [limitations, privacy]) {
        assert.doesNotMatch(
            document,
            /raw console[^\n]*(?:server|API)[^\n]*(?:release blocker|发布阻断)|(?:server|API)[^\n]*raw console[^\n]*(?:release blocker|发布阻断)/i
        );
        assert.doesNotMatch(
            document,
            /exact (?:activity )?(?:location|coordinates)[^\n]*(?:release blocker|production privacy release blocker)/i
        );
    }

    for (const document of [limitations, privacy]) {
        assert.match(document, /rounded to (?:two|2) decimals|two-decimal|2-decimal/i);
        assert.match(document, /exact local (?:calendar )?date/i);
        assert.match(document, /explicit|consent/i);
        assert.match(document, /public (?:Git )?history|Git history/i);
    }
    assert.match(limitations, /BLOCKED/);

    assert.match(limitations, /stravastats-static-v2-000001/);
    assert.match(limitations, /strava-dashboard-v1[^\n]*(?:legacy|previous|preserved|recognized)/i);
    assert.doesNotMatch(limitations, /unresolved[^\n]*Service Worker API-cache/i);
    assert.match(limitations, /Option B|empty V1 (?:database )?shell/i);
    assert.match(limitations, /provider[^\n]*no automatic retry|no automatic retry[^\n]*provider/i);
    assert.match(limitations, /retained[^\n]*(?:bytes|byte)[^\n]*Retry|Retry[^\n]*retained[^\n]*(?:bytes|byte)/i);
});

test('pre-freeze PR-24 historical status does not claim a conditional PASS', async () => {
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

test('pre-freeze PR-47 historical record freezes its five-path scope', async () => {
    const brief = await source('docs/tasks/pr-47-final-v2-release-roadmap.md');
    const approval = brief.split('## Owner approval and frozen implementation contract')[1];
    assert.notEqual(approval, undefined);
    const match = /### 1\. Exact cumulative allowlist[\s\S]*?```text\n([\s\S]*?)\n```/.exec(approval);
    assert.notEqual(match, null);
    assert.deepEqual(match[1].split('\n'), FINAL_ROADMAP_ALLOWLIST);
    assert.match(approval, /five paths are the cumulative hard maximum/i);
    assert.match(approval, /sixth path requires a new owner decision/i);
    assert.match(
        approval,
        /G13[\s\S]{0,100}(?:versioned Alpha candidate|candidate build)[\s\S]{0,160}G12[\s\S]{0,160}G13[\s\S]{0,120}(?:publication|tag|Release)/i
    );
});

test('pre-freeze PR-48 historical record freezes its three-path scope', async () => {
    const brief = await source('docs/tasks/pr-48-alpha-contract.md');
    const match = /### Frozen literal cumulative allowlist[\s\S]*?```text\n([\s\S]*?)\n```/.exec(brief);
    assert.notEqual(match, null);
    assert.deepEqual(match[1].split('\n'), ALPHA_CONTRACT_ALLOWLIST);
    assert.match(brief, /three-path literal cumulative hard maximum/i);
    assert.match(brief, /package\.json[\s\S]{0,120}package-lock\.json/);
    assert.match(brief, /workflow[\s\S]{0,120}Service Worker[\s\S]{0,120}deployment/i);
    assert.match(brief, /fourth path[\s\S]{0,100}(?:new owner decision|immediate stop)/i);
});

test('release gates separate the current public base from pre-freeze roadmap history', async () => {
    const gates = await source('docs/engineering/release-gates.md');
    const current = gates.split('## 2. Current public scope-freeze gate')[1]
        ?.split('## 3. Pre-freeze')[0];
    assert.notEqual(current, undefined);
    assert.match(current, new RegExp(PUBLIC_SCOPE_BASE));
    assert.match(current, new RegExp(PUBLIC_SCOPE_TREE));
    assert.doesNotMatch(current, /4375d699fb1fc1142d399c158b9ad0c4e7e730dc/);
    assert.doesNotMatch(current, /1,919\/1,919/);
    assert.match(gates, /Sections 3 through 6[\s\S]{0,200}pre-freeze point-in-time[\s\S]{0,20}history/i);
    assert.match(gates, /not a live roadmap/i);
});

test('pre-freeze historical G1 contract records local distribution and support', async () => {
    const gates = await source('docs/engineering/release-gates.md');
    const contract = gates.split('## 4.1 Pre-freeze closed G1 Alpha acceptance contract (historical)')[1]
        ?.split('## 5. Pre-freeze')[0];
    assert.notEqual(contract, undefined);
    assert.match(contract, /G1[\s\S]{0,120}CLOSED BY DISPOSITION/i);
    assert.match(contract, /v2\.0\.0-alpha\.1/);
    assert.match(contract, /owner-provided[\s\S]{0,120}local[\s\S]{0,120}non-production/i);
    assert.match(contract, /public(?:ly)? hosted|public web Alpha/i);
    assert.match(contract, /XiChuan9/);
    assert.match(contract, /latest stable Google Chrome[\s\S]{0,180}candidate(?:-head)? freeze/i);
    assert.match(contract, /exact full Chrome version[\s\S]{0,120}exact macOS version/i);
    assert.match(contract, /stable Chrome changes[\s\S]{0,120}(?:retest|rerun)/i);
    for (const unsupported of [
        /Chrome (?:Beta|Dev|Canary)/i,
        /Chromium/i,
        /Safari/i,
        /Firefox/i,
        /Windows/i,
        /Linux/i,
        /iOS/i,
        /Android/i,
        /PWA/i,
        /screen[- ]reader/i
    ]) assert.match(contract, unsupported);
    assert.match(contract, /G9[\s\S]{0,100}BLOCKED/i);
});

test('pre-freeze historical G1 contract records payload and reproducibility', async () => {
    const gates = await source('docs/engineering/release-gates.md');
    const contract = gates.split('## 4.1 Pre-freeze closed G1 Alpha acceptance contract (historical)')[1]
        ?.split('## 5. Pre-freeze')[0];
    assert.notEqual(contract, undefined);
    for (const required of [
        'classifyBike.js', 'classifyRun.js', 'diagnostics.html', 'icon-sport.svg',
        'index.html', 'manifest.json', 'source-manager.html', 'storage-backup.html',
        'sw.js', 'js/vendor/THIRD_PARTY_NOTICES.md', 'media/bg-bike.jpg',
        'media/bg-run.jpg', 'media/bg-swim.jpg'
    ]) assert.match(contract, new RegExp(required.replaceAll('.', '\\.')));
    assert.match(contract, /tracked regular[\s\S]{0,120}`html\/`[\s\S]{0,80}`\.html`/i);
    assert.match(contract, /tracked regular[\s\S]{0,120}`js\/`[\s\S]{0,80}`\.js`/i);
    assert.match(contract, /tracked regular[\s\S]{0,120}`styles\/`[\s\S]{0,80}`\.css`/i);
    for (const excluded of [
        /`api\/`/, /`docs\/`/, /`tests\/`/, /`scripts\/`/, /`\.github\/`/,
        /package\.json/, /package-lock\.json/, /vercel\.json/, /\.env/, /AGENTS\.md/
    ]) assert.match(contract, excluded);
    assert.match(contract, /PROVENANCE\.json/);
    assert.match(contract, /SHA256SUMS/);
    const provenanceRule = /- `PROVENANCE\.json`([\s\S]*?)(?=\n- `SHA256SUMS`)/.exec(contract)?.[1];
    assert.notEqual(provenanceRule, undefined);
    assert.doesNotMatch(provenanceRule, /sha256sumsSha256/i);
    assert.match(provenanceRule, /contains no digest of `SHA256SUMS` or the final container/i);
    assert.match(contract, /SHA-256 of the complete `SHA256SUMS` bytes[\s\S]{0,160}outside the bundle/i);
    assert.match(contract, /final container[\s\S]{0,160}outside the bundle/i);
    assert.match(contract, /digest graph is acyclic/i);
    assert.match(contract, /64 lowercase hexadecimal[\s\S]{0,100}two ASCII spaces[\s\S]{0,100}POSIX-relative path/i);
    assert.match(contract, /lexicographic[\s\S]{0,100}terminal newline/i);
    assert.match(contract, /exact candidate commit[\s\S]{0,120}exact candidate tree/i);
    assert.match(contract, /SOURCE_DATE_EPOCH|sourceDateEpoch/);
    assert.match(contract, /two (?:fresh|independent)[\s\S]{0,120}depth-one checkouts[\s\S]{0,180}byte-identical/i);
    assert.match(contract, /no symlink/i);
});

test('pre-freeze historical G1 contract records candidate and browser gates', async () => {
    const gates = await source('docs/engineering/release-gates.md');
    const contract = gates.split('## 4.1 Pre-freeze closed G1 Alpha acceptance contract (historical)')[1]
        ?.split('## 5. Pre-freeze')[0];
    assert.notEqual(contract, undefined);
    for (const command of [
        'npm ci', 'npm run check:syntax', 'npm run check:privacy', 'npm test',
        'npm audit', 'git diff --check'
    ]) assert.match(contract, new RegExp(command.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
    assert.match(contract, /true remote depth-one checkout/i);
    assert.match(contract, /exact-head CI/i);
    assert.match(contract, /current P0\/P1 inventory/i);
    assert.match(contract, /static-only[\s\S]{0,100}loopback[\s\S]{0,120}no[- ]API/i);
    assert.match(contract, /fresh disposable Chrome profile/i);
    assert.match(contract, /first-run[\s\S]{0,100}Demo/i);
    assert.match(contract, /FIT[\s\S]{0,40}TCX[\s\S]{0,40}GPX[\s\S]{0,40}CSV[\s\S]{0,40}ZIP/i);
    assert.match(contract, /Backup[\s\S]{0,100}Restore/i);
    assert.match(contract, /Legacy[\s\S]{0,120}rollback/i);
    assert.match(contract, /zero[\s\S]{0,120}`\/api`[\s\S]{0,180}(?:Strava|Weather|AI|map|telemetry)/i);
    assert.match(contract, /`enable-sw=1`[\s\S]{0,120}prohibited/i);
    assert.match(contract, /no[\s\S]{0,80}(?:offline|PWA|Service Worker)[\s\S]{0,80}claim/i);
});

test('pre-freeze historical G1 contract records privacy and non-PASS gates', async () => {
    const gates = await source('docs/engineering/release-gates.md');
    const contract = gates.split('## 4.1 Pre-freeze closed G1 Alpha acceptance contract (historical)')[1]
        ?.split('## 5. Pre-freeze')[0];
    assert.notEqual(contract, undefined);
    assert.match(contract, /synthetic-only/i);
    assert.match(contract, /no (?:real )?Token[\s\S]{0,120}provider credential[\s\S]{0,120}private/i);
    assert.match(contract, /withdraw[\s\S]{0,160}(?:stop sharing|remove|replace)[\s\S]{0,160}artifact/i);
    assert.match(contract, /never[\s\S]{0,120}(?:clear|delete)[\s\S]{0,180}Legacy[\s\S]{0,80}V2[\s\S]{0,80}(?:Cache Storage|cache)[\s\S]{0,80}settings/i);
    assert.match(contract, /G2[\s\S]{0,80}NOT RUN[\s\S]{0,120}G3[\s\S]{0,80}PARTIAL/i);
    for (const gate of ['G5', 'G6', 'G7', 'G8', 'G9', 'G10', 'G12', 'G13']) {
        assert.match(contract, new RegExp(`${gate}[\\s\\S]{0,100}(?:NOT RUN|PARTIAL|BLOCKED)`));
    }
    assert.match(contract, /G13 is `PARTIAL`[\s\S]{0,180}candidate-building phase/i);
    assert.match(contract, /tag[\s\S]{0,120}GitHub Release[\s\S]{0,160}separate later G13 authorization/i);
    assert.doesNotMatch(contract, /real (?:Legacy|parity)[^\n]*(?:is|=)\s*`?PASS/i);
});

test('pre-freeze historical G2-G13 inventory keeps exact rows and no external PASS', async () => {
    const gates = await source('docs/engineering/release-gates.md');
    const remaining = gates.split('## 4. Pre-freeze remaining gate inventory (historical)')[1]
        ?.split('## 4.1 Pre-freeze')[0];
    assert.notEqual(remaining, undefined);
    const actualRows = remaining.split('\n').filter(line => /^\| G\d+ \|/.test(line));
    assert.equal(actualRows.length, REMAINING_GATE_ROWS.length);
    assert.deepEqual(
        actualRows.map(line => line.split('|')[1].trim()),
        REMAINING_GATE_ROWS.map(([id]) => id)
    );
    for (const [id, evidenceClass, result, blocks] of REMAINING_GATE_ROWS) {
        const row = new RegExp(
            `\\| ${id} \\| ${evidenceClass.replaceAll('+', '\\+')} \\| ${result} \\| ${blocks.replaceAll('/', '\\/')} \\|`
        );
        assert.match(remaining, row, `${id} exact row`);
    }
    assert.match(gates, /Class A[\s\S]*Class B[\s\S]*Class C[\s\S]*Class D[\s\S]*Class E[\s\S]*Class F/);
    assert.match(gates, /Pre-freeze remaining gate inventory \(historical\)/i);
    assert.match(gates, /`PASS deterministic`[\s\S]{0,80}`PASS verified`/);
    assert.match(gates, /`PASS verified`[\s\S]{0,240}exact acceptance evidence[\s\S]{0,160}verifier\/owner[\s\S]{0,160}environment/i);
    for (const row of actualRows) {
        const columns = row.split('|').map(column => column.trim());
        assert.doesNotMatch(columns[3], /^PASS\b/i, `${columns[1]} external Result must not be PASS`);
    }
});

test('pre-freeze historical Alpha path stays local synthetic-only', async () => {
    const gates = await source('docs/engineering/release-gates.md');
    const alpha = gates.split('## 5. Pre-freeze V2 Alpha path (historical; not authorized now)')[1]
        ?.split('## 6. Pre-freeze')[0];
    assert.notEqual(alpha, undefined);
    assert.match(alpha, /v2\.0\.0-alpha\.1/);
    assert.match(alpha, /limited local[\s\S]{0,80}non-production/i);
    assert.match(alpha, /static Web bundle/);
    assert.match(alpha, /current macOS Chrome only/i);
    assert.match(alpha, /synthetic-only/i);
    assert.match(alpha, /G2[\s\S]{0,100}G3[\s\S]{0,160}deferred to RC/i);
    assert.match(alpha, /public web Alpha[\s\S]{0,80}(?:not authorized|unauthorized)/i);
    assert.match(alpha, /G13 is `PARTIAL`[\s\S]{0,160}G12[\s\S]{0,160}separate later authority/i);
    assert.match(alpha, /artifact publication[\s\S]{0,80}tag[\s\S]{0,80}GitHub Release/i);
    assert.doesNotMatch(alpha, /real (?:Legacy|parity)[^\n]*PASS/i);
    const dependency = /Dependency order:[\s\S]*?```text\n([\s\S]*?)\n```/.exec(alpha)?.[1];
    assert.notEqual(dependency, undefined);
    const alphaOrder = [
        dependency.indexOf('G13 versioned Alpha candidate'),
        dependency.indexOf('G12 exact candidate-head'),
        dependency.indexOf('XiChuan9 exact-object approval'),
        dependency.indexOf('G13 tag/Release/publication action')
    ];
    assert(alphaOrder.every(position => position >= 0));
    assert(alphaOrder.every((position, index) => index === 0 || alphaOrder[index - 1] < position));
});

test('pre-freeze historical complete-v2 path records owner dispositions without current authority', async () => {
    const gates = await source('docs/engineering/release-gates.md');
    const full = gates.split('## 6. Pre-freeze complete v2.0 path (historical; not authorized now)')[1]
        ?.split('## 7. Current public')[0];
    assert.notEqual(full, undefined);
    assert.match(full, /2026-11-12/);
    assert.match(full, /large libraries|large batches/i);
    assert.match(full, /Retry\/Recover\/Abandon/);
    assert.match(full, /representative real-hardware budget task/i);
    assert.match(full, /waiver[\s\S]{0,180}(?:temporarily satisfies|does not block)[\s\S]{0,180}2026-11-12/i);
    assert.match(full, /reason[\s\S]{0,180}5k\/200k[\s\S]{0,180}record-only[\s\S]{0,180}real-hardware/i);
    assert.match(full, /Safari[\s\S]*Firefox[\s\S]*Windows[\s\S]*iOS\/PWA[\s\S]*mobile/i);
    assert.match(full, /keyboard[\s\S]{0,80}screen-reader/i);
    assert.match(full, /no-rewrite risk acceptance/i);
    assert.match(full, /no (?:evidence of )?credential exposure/i);
    assert.match(full, /not\s+erasure/i);
    assert.match(full, /non-production Vercel preview\/staging/i);
    assert.match(full, /planning\/rehearsal Task Brief[\s\S]{0,40}after (?:M34|roadmap) merge/i);
    assert.match(full, /two (?:Service Worker|SW) generations[\s\S]{0,100}tabs/i);
    assert.match(full, /Alpha[\s\S]{0,40}Beta[\s\S]{0,40}RC[\s\S]{0,40}v2\.0\.0/);
    assert.match(full, /static\s+Web bundle[\s\S]{0,80}SHA-256 manifest/i);
    assert.match(full, /XiChuan9/);
    assert.match(full, /real\/private evidence[\s\S]{0,80}NOT RUN/i);
    assert.match(full, /production deployment[\s\S]{0,80}(?:BLOCKED|not authorized)/i);
    assert.match(full, /RC requires G2\/G3\/G5-G7\/G9\/G10[\s\S]{0,180}G8[\s\S]{0,120}(?:after|expiry)/i);
    assert.match(full, /production[\s\S]{0,100}G8[\s\S]{0,120}(?:after|expiry)/i);
    const dependency = /### Dependency order[\s\S]*?```text\n([\s\S]*?)\n```/.exec(full)?.[1];
    assert.notEqual(dependency, undefined);
    const fullOrder = [
        dependency.indexOf('G13 versioned candidate build'),
        dependency.indexOf('G9 PRD browser/platform/accessibility matrix'),
        dependency.indexOf('G12 final exact candidate-head/artifact verification'),
        dependency.indexOf('XiChuan9 final exact-object approval'),
        dependency.indexOf('G13 publication/tag/Release')
    ];
    assert(fullOrder.every(position => position >= 0));
    assert(fullOrder.every((position, index) => index === 0 || fullOrder[index - 1] < position));
});

test('documentation index and limitations point to current scope authority and label history', async () => {
    const [index, limitations, gates] = await Promise.all([
        source('docs/README.md'),
        source('docs/guides/known-limitations.md'),
        source('docs/engineering/release-gates.md')
    ]);
    assert.match(index, /Current public-scope authority[\s\S]{0,160}public-local-import-core-freeze\.md/i);
    assert.match(index, /Current integration gate[\s\S]{0,160}release-gates\.md/i);
    assert.match(index, /PR-24[\s\S]{0,120}(?:historical|point-in-time)/i);
    assert.match(index, /V2 PRD, development plan, old release roadmap[\s\S]{0,120}pre-freeze history/i);
    assert.match(limitations, /current public boundary[\s\S]{0,160}public-local-import-core-freeze\.md/i);
    assert.match(limitations, /Pre-freeze production-release blockers \(historical\)/i);
    assert.match(gates, /Current public scope-freeze pull request and integration gates/i);
    assert.match(gates, /Sections 3 through 6[\s\S]{0,200}pre-freeze point-in-time[\s\S]{0,20}history/i);
    assert.match(limitations, /PR #57[\s\S]{0,120}(?:closed|PASS deterministic)/i);
    assert.match(limitations, /PR #58[\s\S]{0,120}(?:closed|PASS deterministic)/i);
    assert.doesNotMatch(limitations, /P1-DOCS remains open/i);
    assert.match(limitations, /G2[\s\S]{0,100}RC/);
    assert.match(limitations, /G3[\s\S]{0,100}RC/);
    assert.match(limitations, /2026-11-12/);
    assert.match(limitations, /no-rewrite[\s\S]{0,100}(?:disposition|risk acceptance)/i);
});

test('pre-freeze baseline is historical and browser acceptance is evidence-backed', async () => {
    const [baseline, matrix, evidence] = await Promise.all([
        source('docs/baseline/README.md'),
        source('docs/testing/regression-matrix.md'),
        source('docs/testing/public-local-import-core-browser-acceptance.md')
    ]);

    assert.match(baseline, /Status \| Historical — frozen point-in-time pre-freeze baseline/i);
    assert.match(baseline, /not current public product|不是当前公开产品/i);
    assert.match(baseline, /public-local-import-core-freeze\.md/i);
    assert.match(baseline, /Run Plus[\s\S]{0,80}NSM[\s\S]{0,180}历史私有扩展/i);

    const manualBrowserRows = [
        'REG-007',
        'REG-008',
        'REG-120',
        'REG-121',
        'REG-122',
        'REG-123',
        'REG-125',
        'REG-126'
    ];
    for (const id of manualBrowserRows) {
        const row = matrix.split('\n').find(line => line.startsWith(`| ${id} |`));
        assert.notEqual(row, undefined, `${id} row exists`);
        assert.match(row, /public-local-import-core-browser-acceptance\.md/);
        assert.match(row, /\| Manual pass \|$/, `${id} requires linked browser evidence`);
    }
    assert.match(matrix, /fake-indexeddb[\s\S]{0,160}不能代替真实浏览器/i);
    assert.match(matrix, /\| REG-124 \|[^\n]*\| Automated \|/);
    assert.match(matrix, /\| REG-127 \|[^\n]*browser-acceptance\.md[^\n]*\| Manual pass \|/);
    assert.match(evidence, /a32cacbbae1b95aaceb18087f24dd6ebc7707338/);
    assert.match(evidence, /5393c41042cd0a17fcf04429807d64f312e8635c/);
    assert.match(evidence, /Console errors: 0/);
    assert.match(evidence, /\/run-plus[\s\S]{0,400}404/);
    assert.match(evidence, /LocalStorage[\s\S]{0,500}6\/6[\s\S]{0,500}PASS/);
    assert.match(evidence, /Cache Storage[\s\S]{0,300}PASS/);
    assert.match(evidence, /no release or deployment authorization/i);
});
