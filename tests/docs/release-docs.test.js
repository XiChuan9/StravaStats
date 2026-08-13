import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
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

const G12_OPTION_A_ALLOWLIST = Object.freeze([
    '.github/workflows/ci.yml',
    'CHANGELOG.md',
    'docs/README.md',
    'docs/engineering/release-gates.md',
    'docs/tasks/pr-50-release-head-verification.md',
    'scripts/alpha-candidate.mjs',
    'tests/docs/release-docs.test.js',
    'tests/release/alpha-candidate.test.js',
    'storage-backup.html',
    'js/app/storage-backup.js',
    'js/pages/storage-backup/storage-backup.js',
    'js/app/main.js',
    'tests/consumers/summary-boundaries.test.js',
    'tests/legacy/demo-isolation.test.js',
    'README.md',
    'js/demo/polylines.js',
    'tests/default-canonical.test.js'
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
    assert.equal(packageData.version, '2.0.0-alpha.1');
    for (const command of [
        'npm ci',
        'npm run dev',
        'npm run check:syntax',
        'npm run check:privacy',
        'npm test',
        'npm run build:alpha-candidate',
        'npm run verify:alpha-candidate',
        'npm run serve:alpha-candidate'
    ]) assert.match(readme, new RegExp(command.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
    for (const route of [
        '/source-manager.html?mode=real',
        '/storage-backup.html',
        '/diagnostics.html'
    ]) assert.match(readme, new RegExp(route.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
    assert.match(sourceManager, /<title>Sources — StravaStats<\/title>/);
    assert.match(backup, /<title>Storage &amp; Backup — StravaStats<\/title>/);
    assert.match(diagnostics, /<title>Diagnostics — StravaStats<\/title>/);
    assert.match(readme, /not (?:a )?public Alpha or production release/i);
    assert.match(readme, /unverified local Alpha candidate-building head/i);
    assert.match(readme, /package metadata[\s\S]{0,40}\`2\.0\.0-alpha\.1\`/i);
    assert.match(readme, /no[^\n]*v2\.0\.0-alpha\.1[^\n]*tag/i);
    assert.match(readme, /no[^\n]*GitHub Release/i);
    assert.match(readme, /G12 exact[\s\S]{0,80}NOT RUN/i);
    assert.match(readme, /no[\s\S]{0,160}exact-object release-owner approval/i);
    assert.doesNotMatch(readme, /v2\.0\.0 (?:is |has been )?(?:released|deployed|published)/i);
    assert.match(readme, /`APPROVED_EXACT_CANDIDATE_SHA`[\s\S]{0,100}external approval record/i);
    assert.match(readme, /must not be inferred from the local checkout/i);
    assert.match(
        readme,
        /ALPHA_CANDIDATE_AUTHORIZED_HEAD="\$APPROVED_EXACT_CANDIDATE_SHA"[\s\\\n]*npm run build:alpha-candidate/
    );
    assert.match(
        readme,
        /--bundle-root \/absolute\/empty\/directory\/stravastats-v2\.0\.0-alpha\.1 --container \/absolute\/empty\/directory\/stravastats-v2\.0\.0-alpha\.1\.zip/
    );
    assert.match(
        readme,
        /serve:alpha-candidate -- --bundle-root \/absolute\/empty\/directory\/stravastats-v2\.0\.0-alpha\.1 --port 0/
    );
    assert.doesNotMatch(readme, /\/absolute\/extracted\/root|\/absolute\/candidate\.zip/);
    assert.doesNotMatch(readme, /^npm run build:alpha-candidate/m);
});

test('current documentation index and changelog bind the exact pre-G12 source identity', async () => {
    const [index, changelog] = await Promise.all([
        source('docs/README.md'),
        source('CHANGELOG.md')
    ]);
    for (const document of [index, changelog]) {
        assert.match(document, /57c2cdf9358afef1330d5a71f3799f18d41f6d13/);
        assert.match(document, /80224e924d4270c03f1c9b526ae4bb6d20326aa9/);
        assert.match(document, /03ccf18c10c6bc146660920b81f409a7d9ca6a0e/);
        assert.doesNotMatch(document, /eb0b6695b5dbf618877ff794dbc76935babeb793/);
        assert.doesNotMatch(document, /4375d699fb1fc1142d399c158b9ad0c4e7e730dc/);
        assert.doesNotMatch(document, /b076c4f80cd1d6de7719cebe26e327d18a1f4734/);
        assert.match(document, /\`?2\.0\.0-alpha\.1\`?/);
        assert.match(document, /not[^\n]*(?:public Alpha|Beta|Release Candidate|production release)/i);
        assert.match(document, /G13[^\n]*`PARTIAL`|G13 is `PARTIAL`/i);
        assert.match(document, /G12[^\n]*`NOT RUN`|G12 exact-candidate verification remains\s+`NOT RUN`/i);
    }
    assert.match(changelog, /same tree[\s\S]{0,160}different Git object/i);
    assert.match(changelog, /not integration-head or future G12[\s\S]{0,80}evidence/i);
    assert.match(index, /same tree[\s\S]{0,160}distinct candidate-building commit/i);
    assert.match(index, /exact-SHA PR\/check-run\/control-tower ledger/i);
    for (const pattern of [
        /public (?:Git )?history|Git history/i,
        /Safari|Firefox/i,
        /production(?:-like)? Service Worker/i,
        /release[- ]owner/i
    ]) {
        assert.match(changelog, pattern);
    }
    assert.match(index, /Current authoritative roadmap/);
    assert.match(index, /V6/);
    assert.match(index, /format 3/i);
    for (const pattern of [/R3-R11/, /D3/, /C1-C4/, /explicit Retry/i]) {
        assert.match(changelog, pattern);
    }
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

test('current release prose rejects superseded blockers and preserves external gates', async () => {
    const [readme, gates, limitations, privacy, brief] = await Promise.all([
        source('README.md'),
        source('docs/engineering/release-gates.md'),
        source('docs/guides/known-limitations.md'),
        source('docs/guides/privacy-guide.md'),
        source('docs/tasks/pr-24-release-documentation.md')
    ]);
    const currentBrief = brief.split('## Superseding current-tree ledger')[1];
    assert.notEqual(currentBrief, undefined);
    assert(currentBrief.length >= 2_000);

    assert.doesNotMatch(readme, /Connect later/i);
    for (const pattern of [
        /Connect\/Reconnect|Connect[^\n]*Reconnect/i,
        /Sync latest 25/,
        /Disconnect/,
        /Recover\/Abandon|Recover[^\n]*Abandon/i,
        /eligible[^\n]*Retry|Retry[^\n]*eligible/i
    ]) assert.match(readme, pattern);
    assert.match(
        readme,
        /current V2\s+Source Manager[\s\S]{0,160}(?:provider|same-origin)|(?:provider|same-origin)[\s\S]{0,160}current V2\s+Source Manager/i
    );
    assert.match(readme, /Connect\/Reconnect[\s\S]{0,120}provider authorization/i);
    assert.match(readme, /callback exchange[\s\S]{0,120}same-origin/i);
    assert.match(readme, /Disconnect[\s\S]{0,120}(?:revoke|revocation)[\s\S]{0,120}same-origin/i);
    assert.match(readme, /Sync latest 25[\s\S]{0,120}same-origin/i);
    assert.match(readme, /Legacy\s+provider/i);
    assert.match(readme, /weather[\s\S]{0,100}map[\s\S]{0,100}AI[\s\S]{0,100}(?:separate|consent)/i);

    assert.doesNotMatch(
        gates,
        /Repository[^\n]*Storage[^\n]*Import[^\n]*Decoder[^\n]*(?:Not implemented|未实现)/i
    );
    assert.match(gates, /deterministic|确定性/i);
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

    for (const document of [limitations, privacy, currentBrief]) {
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
        assert.match(document, /BLOCKED/);
    }

    assert.match(limitations, /stravastats-static-v2-000001/);
    assert.match(limitations, /strava-dashboard-v1[^\n]*(?:legacy|previous|preserved|recognized)/i);
    assert.doesNotMatch(limitations, /unresolved[^\n]*Service Worker API-cache/i);
    assert.match(limitations, /Option B|empty V1 (?:database )?shell/i);
    assert.match(limitations, /provider[^\n]*no automatic retry|no automatic retry[^\n]*provider/i);
    assert.match(limitations, /retained[^\n]*(?:bytes|byte)[^\n]*Retry|Retry[^\n]*retained[^\n]*(?:bytes|byte)/i);

    assert.match(currentBrief, /eb0b6695b5dbf618877ff794dbc76935babeb793/);
    assert.match(currentBrief, /R3[^\n]*current tree[^\n]*(?:CLOSED|PASS)/i);
    assert.match(currentBrief, /public (?:Git )?history[^\n]*BLOCKED/i);
    for (const pattern of [
        /real account|private library/i,
        /Safari|Firefox/i,
        /production-like Service Worker|production Service Worker/i,
        /deployment[^\n]*rollback|rollback[^\n]*deployment/i,
        /version[^\n]*tag[^\n]*artifact|tag[^\n]*artifact/i,
        /release-owner|release owner/i
    ]) assert.match(currentBrief, pattern);
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

test('M34 freezes the exact five-path implementation scope and no sixth path', async () => {
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

test('M35 freezes the exact three-path docs and test scope', async () => {
    const brief = await source('docs/tasks/pr-48-alpha-contract.md');
    const match = /### Frozen literal cumulative allowlist[\s\S]*?```text\n([\s\S]*?)\n```/.exec(brief);
    assert.notEqual(match, null);
    assert.deepEqual(match[1].split('\n'), ALPHA_CONTRACT_ALLOWLIST);
    assert.match(brief, /three-path literal cumulative hard maximum/i);
    assert.match(brief, /package\.json[\s\S]{0,120}package-lock\.json/);
    assert.match(brief, /workflow[\s\S]{0,120}Service Worker[\s\S]{0,120}deployment/i);
    assert.match(brief, /fourth path[\s\S]{0,100}(?:new owner decision|immediate stop)/i);
});

test('G12 Task Brief freezes the exact Option A scope, C sequence and external ledger', async () => {
    const brief = await source('docs/tasks/pr-50-release-head-verification.md');
    const allowlist = /For option 1, the proposed literal cumulative post-A2 allowlist is:[\s\S]*?```text\n([\s\S]*?)\n```/.exec(brief);
    assert.notEqual(allowlist, null);
    assert.deepEqual(allowlist[1].split('\n'), G12_OPTION_A_ALLOWLIST);

    const authority = brief.split('## A3 owner decision and source implementation authority')[1]
        ?.split('## Required verification lifecycle')[0];
    assert.notEqual(authority, undefined);
    assert.match(authority, /owner explicitly selected option 1/i);
    assert.match(authority, /exact seventeen-path[\s\S]{0,20}maximum above/i);
    assert.match(authority, /exact-SHA PR\/check-run\/control-[\s\S]{0,20}tower ledger as the canonical post-freeze evidence record/i);
    assert.match(authority, /does not mark G12 `PASS` or G13 complete/i);
    assert.match(authority, /does not authorize a candidate build[\s\S]{0,40}before freeze commit `C`/i);

    assert.match(
        authority,
        /After implementation and source review[\s\S]{0,100}implementation commit[\s\S]{0,80}not[\s\S]{0,40}candidate[\s\S]{0,100}Task-Brief-only commit `C`[\s\S]{0,80}source-review Closure[\s\S]{0,80}freezes the[\s\S]{0,40}sole proposed candidate identity[\s\S]{0,80}tracked G12 remains `NOT RUN`/i
    );

    assert.match(brief, /Any failure withdraws `C`[\s\S]{0,120}separately authorized new candidate commit[\s\S]{0,80}full rerun/i);
    assert.match(brief, /No later candidate-branch commit[\s\S]{0,120}successfully verified `C`[\s\S]{0,120}remains selected/i);
    assert.match(brief, /Do not rebase, amend, force-push, rewrite history/i);
    assert.match(brief, /later squash commit is a distinct noncandidate identity/i);
    assert.match(authority, /changed eighteenth path or[\s\S]{0,40}material expansion is a hard stop/i);
    assert.match(brief, /ledger-only Final Verification Closure; no repository commit/i);
    assert.match(brief, /post-`C` Closure is external and exact-SHA-bound/i);
    assert.match(brief, /never edits the Task Brief or any other[\s\S]{0,20}tracked file/i);
    assert.match(brief, /origin\/codex\/v2\/release-head-verification[\s\S]{0,80}current PR head[\s\S]{0,40}equal `C`/i);
    assert.match(brief, /PR #62 remains open Draft[\s\S]{0,120}exact head\/base repositories and refs/i);
    assert.match(brief, /both `checks` and `exact-alpha-candidate`[\s\S]{0,40}(?:conclude|jobs conclude) `?SUCCESS`?/i);
    assert.match(brief, /two builds[\s\S]{0,60}two strict verifies[\s\S]{0,80}comparisons[\s\S]{0,80}(?:successfully|rather than skip)/i);
    assert.match(brief, /synthetic `GITHUB_SHA` separately[\s\S]{0,80}(?:without ever[\s\S]{0,20}calling it|from) `C`/i);
    assert.match(brief, /tuple\/readback drift withdraws `C`/i);
});

test('Alpha backup page, Demo facade, and restore view use the exact V6 display contract', async () => {
    const [page, application, view] = await Promise.all([
        source('storage-backup.html'),
        source('js/app/storage-backup.js'),
        source('js/pages/storage-backup/storage-backup.js')
    ]);
    assert.match(page, /id="database-version">Checking…<\/dd>/);
    assert.match(page, /Exports all V6 records and approved durable settings/);
    assert.doesNotMatch(page, /(?:Physical database[^\n]*|Exports all )V4/i);
    const demo = /function demoFacade\(\) \{([\s\S]*?)\n\}/.exec(application)?.[1];
    assert.notEqual(demo, undefined);
    assert.match(demo, /databaseVersion:\s*V2_DATABASE_VERSION,\s*activityCount:\s*0/);
    assert.match(demo, /exportLibrary:\s*unavailable/);
    assert.match(demo, /restoreBackup:\s*unavailable/);
    assert.doesNotMatch(demo, /databaseVersion:\s*4/);
    const restore = view.split('async function restoreBackup()')[1]
        ?.split("elements.input.addEventListener('change'")[0];
    assert.notEqual(restore, undefined);
    assert.match(restore, /result\.status === 'already_restored'/);
    assert.match(restore, /elements\.status\.textContent/);
    assert.match(restore, /elements\.detail\.textContent/);
    assert.match(restore, /elements\.version\.textContent = 'V6'/);
    assert.match(restore, /elements\.count\.textContent = String\(result\.activityCount\)/);
});

test('Alpha Try Demo entry seeds before a clean Demo-mode document re-entry', async () => {
    const main = await source('js/app/main.js');
    const entry = main.split("if (demoButton) demoButton.addEventListener('click'")[1]
        ?.split("if (logoutButton) logoutButton.addEventListener('click'")[0];
    assert.notEqual(entry, undefined);
    assert.match(entry, /aiCoachSession\.revoke\(\)/);
    assert.match(entry, /sessionMode:\s*APP_SESSION_MODE\.DEMO/);
    assert.match(
        entry,
        /loginWithDemo\(\(\)\s*=>\s*\{\s*window\.location\.reload\(\);\s*\}\)/
    );
    assert.doesNotMatch(entry, /loginWithDemo\(initializeApp\)/);
});

test('Demo route geometry has explicit fabricated provenance and no prior route bytes', async () => {
    const polylineSource = await source('js/demo/polylines.js');
    const polylineModule = await import('../../js/demo/polylines.js');
    const { DEMO_POLYLINES, decodePolyline } = polylineModule;

    assert.deepEqual(Object.keys(polylineModule).sort(), [
        'DEMO_POLYLINES', 'decodePolyline', 'getRandomPolyline'
    ]);
    assert.match(
        polylineSource,
        /SYNTHETIC_ROUTE_PROVENANCE_V1:[^\n]*deliberately fabricated coordinate geometry;[\s\S]{0,100}no person or real GPS trace is represented or was used as source material\./
    );
    for (const priorClaim of [
        /real-world encoded polylines/i,
        /Spanish running\/cycling routes/i,
        /\b(?:Madrid|Barcelona|Sagrada Familia|Sevilla|Valencia)\b/i,
        /central park route|riverside|beach run|Mountain bike routes/i
    ]) assert.doesNotMatch(polylineSource, priorClaim);

    assert.deepEqual(Object.keys(DEMO_POLYLINES), ['Run', 'Ride', 'Swim']);
    assert.deepEqual(
        Object.fromEntries(Object.entries(DEMO_POLYLINES).map(([type, values]) => [type, values.length])),
        { Run: 14, Ride: 11, Swim: 7 }
    );
    const routes = Object.values(DEMO_POLYLINES).flat();
    assert.equal(routes.length, 32);
    assert.equal(new Set(routes).size, routes.length);
    assert(routes.every(route => typeof route === 'string' && route.length > 0));

    const priorRouteHashes = new Set([
        'd1783bdef45cfcee395b742e0a94c50f5caacd245c3da8d0c797e585e01dd63e',
        '171f6479f740834ab8a53541e62ef48b47f8e0c8d7684e47eb2a8acacca79d9c',
        '35a558c86318b0fbdddefb00b45a6fdd49a385114b6ecc2afbbccf631abf7ce4',
        '98df4fcce262db72e2a3d8213d1ae9ecf6e3ba7298fb3a7bf64dd0dfe06ca1b7',
        '144d2a2e9b8b6f3dba2305c6de2362a5f2ee6d64825e11ef837cf0c675dde80d',
        '234df9ccf3ba9476064ed251edc943055d42f09013bb4b82ea1338bbef42c7e3',
        '71e8011a1ced5cb36a3630ff65f51c2f1bd7324d53680b2a68afea234d70b6e9',
        '49cfd1a9510095bc5c10425a4b6c5213f2bac2d9d60fceffcbac13288a19441a',
        '508156bcf8ef50bc9968eb8b4e079b10c4fe12d3673da6ce171fa3dce2d4cf56',
        '46295c3c341fef39f9884059794cd5ffd72e6b2624cadd6a6d44f6e0481c1f89',
        'd25c5c25cc6f90f5d21bc7cb62b16eeaf2917cb7b00d089c7aa4edd5cf7ee060',
        'bacd64a37c396f0c2863b40e948eeb97878f5691beac25d9eda2333ddbf9f4d2',
        '35dad5005578366903d7c34f15b122c7f958443e52e1463875b7a54099d95b95',
        '990d91f359543e3eb451e61c18a4b6efd9f647552ec2038ea436a994452bdb9b',
        'e2e68c8da2a14c96a58318d3c1cf0c1494bdafcb64ab7597b59a15b83cb4535b',
        '0207b680e7f6ef3f83e3bd4ad353a961b1746b0c88e8d65917b7cc0f966be036',
        '77bd6da5edcbd06daf893ca83ad0ead02f388a4f59e8ba3bad6915d4485018b7',
        '77fea77c24897b6322d9f03afee95c7eb43fe1af6643c888b824b77e47b6db08',
        'a9450654381ba1861f536d5134ae886ce16016eee1dabe0d181ea797fa3c8328',
        '6099ff75316ba762e3822c1701ff333546aa42d35d6f4453f96499a10df48467',
        '8ec0114a2e03ec5b918f04e5a8dfc247ac72b95b493fa0ddb7df7c76121b4e51',
        'ca58606a260fe7a5959c6aacf12174417cb40357548c177d59867d768e2aff21',
        '35116242af7b9ed966504d7bb03f03d52ac6bed6ec44931ac946c1ad211b28d0',
        'a12ce082779c7f892dd5ae4767415e455ea153047024406e36c7e59a691b55e1',
        '657cf6bc3fd861a674979dd5a52b21711c1f96628c1dae2b88b3c3f100a199ef',
        'a8b7bb04bdff65bba8a1008a528c6616891ce085114328568c5bb400baae63f8',
        '173eb34e849a828a986406e69bb2ab5cc02950c6225a2e3571fb3af93d7356cf',
        '94c558385d787ef39c170a0db9d0ee4b209adc7e8975602ee536d5b21658b5a4',
        '3525f49e1b3a5845c3dbf32127b29e04c2524b34d43abccfd265982e1e548b22',
        '663c3279ee5eaa384f07bbbe880a7111e50afdf58fb8afeedf6bce5ef67c094a',
        '7dfcf9a8fd4c9e63bc953689db365a882d2e306c76922769d84b735bfd4b7129',
        '8d90707f4390f983938cb2c2305a137bcd20033d6626ad3eaa9b1fe5721bf361'
    ]);
    for (const route of routes) {
        const digest = createHash('sha256').update(route).digest('hex');
        assert.equal(priorRouteHashes.has(digest), false, `prior route bytes remain: ${digest}`);
        const coordinates = decodePolyline(route);
        assert(coordinates.length >= 2);
        for (const [latitude, longitude] of coordinates) {
            assert(Number.isFinite(latitude) && Math.abs(latitude) <= 90);
            assert(Number.isFinite(longitude) && Math.abs(longitude) <= 180);
        }
    }
    assert.equal(
        createHash('sha256').update(JSON.stringify(DEMO_POLYLINES)).digest('hex'),
        'b92159c6552bfbcf5ef31537060311b4b94c0be0635ec52c4014bce7dc26334f'
    );
    assert.notEqual(
        createHash('sha256').update(polylineSource).digest('hex'),
        'b63be511d7c503af9ce9b27486dfe7c9daeda701bbb5561b34568afb79982804'
    );
});

test('canonical roadmap binds the exact pre-G12 baseline and historical PR61 identity', async () => {
    const gates = await source('docs/engineering/release-gates.md');
    assert.match(gates, /57c2cdf9358afef1330d5a71f3799f18d41f6d13/);
    assert.match(gates, /80224e924d4270c03f1c9b526ae4bb6d20326aa9/);
    assert.match(gates, /03ccf18c10c6bc146660920b81f409a7d9ca6a0e/);
    assert.doesNotMatch(gates, /4375d699fb1fc1142d399c158b9ad0c4e7e730dc/);
    assert.doesNotMatch(gates, /b076c4f80cd1d6de7719cebe26e327d18a1f4734/);
    assert.doesNotMatch(gates, /integration\/v2@f7f18392dc28e1f1d6ed10c1d8cc0aa297ab7628/);
    assert.match(gates, /1,936\/1,936/);
    assert.match(gates, /31595417799[\s\S]{0,80}94109614445/);
    assert.match(gates, /31595421366[\s\S]{0,80}94109625266/);
    assert.match(gates, /integration push CI[\s\S]{0,100}31595417799[\s\S]{0,100}candidate step skipped/i);
    assert.match(gates, /integration PR CI[\s\S]{0,100}31595421366[\s\S]{0,100}candidate step skipped/i);
    assert.match(gates, /PR #57[\s\S]{0,100}(?:PASS deterministic|closed deterministically)/i);
    assert.match(gates, /PR #58[\s\S]{0,100}(?:PASS deterministic|closed deterministically)/i);
    assert.match(gates, /PR #59[\s\S]{0,120}(?:PASS deterministic|closed deterministically|Accepted roadmap)/i);
    assert.match(gates, /PR #61[\s\S]{0,120}(?:PASS deterministic|historical|commit-bound)/i);
    assert.match(gates, /Current P0\/P1 inventory \| PARTIAL/i);
    assert.doesNotMatch(gates, /Current P0\/P1 inventory \| PASS deterministic/i);
    assert.match(gates, /same tree[\s\S]{0,180}different parent[\s\S]{0,120}commit identity/i);
    assert.match(gates, /03ccf18\.\.\.[^\n]*(?:not|is not)[^\n]*integration-head/i);
});

test('Option A freezes non-PASS source status and conditional exact-SHA ledger semantics', async () => {
    const [gates, index, changelog] = await Promise.all([
        source('docs/engineering/release-gates.md'),
        source('docs/README.md'),
        source('CHANGELOG.md')
    ]);
    assert.match(gates, /Task-Brief-only freeze commit `C`[\s\S]{0,100}G12 as `NOT RUN`/i);
    assert.match(
        gates,
        /only after every required post-freeze gate passes[\s\S]{0,180}exact-SHA PR\/check-run\/control-tower ledger[\s\S]{0,180}canonical G12 verification record/i
    );
    assert.match(gates, /partial, skipped or failing run cannot populate that record/i);
    assert.match(gates, /later squash[\s\S]{0,100}distinct noncandidate[\s\S]{0,100}inherits no candidate evidence/i);
    assert.match(gates, /G12 \| A \| NOT RUN/);
    assert.match(gates, /G13 \| F \| PARTIAL/);
    assert.doesNotMatch(gates, /Option A[^\n]*(?:is|=) `PASS/i);
    for (const document of [index, changelog]) {
        assert.match(document, /G12[^\n]*`NOT RUN`|G12 exact-candidate verification remains\s+`NOT RUN`/i);
        assert.match(document, /G13[^\n]*`PARTIAL`|G13 is `PARTIAL`/i);
        assert.match(document, /only after every[\s\S]{0,80}post-freeze gate[\s\S]{0,40}passes/i);
        assert.doesNotMatch(document, /G12[^\n]*(?:is|=) `?PASS/i);
    }
});

test('G1 Alpha contract freezes local distribution, support and honest status', async () => {
    const gates = await source('docs/engineering/release-gates.md');
    const contract = gates.split('## 4.1 Closed G1 Alpha acceptance contract')[1]
        ?.split('## 5.')[0];
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

test('G1 Alpha contract freezes exact payload, manifest and reproducibility', async () => {
    const gates = await source('docs/engineering/release-gates.md');
    const contract = gates.split('## 4.1 Closed G1 Alpha acceptance contract')[1]
        ?.split('## 5.')[0];
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
    assert.match(contract, /SHA-256 of the complete `SHA256SUMS` bytes[\s\S]{0,160}outside\s+the\s+bundle/i);
    assert.match(contract, /final container[\s\S]{0,160}outside\s+the\s+bundle/i);
    assert.match(contract, /digest graph\s+is acyclic/i);
    assert.match(contract, /64 lowercase hexadecimal[\s\S]{0,100}two ASCII spaces[\s\S]{0,100}POSIX-relative path/i);
    assert.match(contract, /lexicographic[\s\S]{0,100}terminal newline/i);
    assert.match(contract, /exact candidate commit[\s\S]{0,120}exact candidate tree/i);
    assert.match(contract, /SOURCE_DATE_EPOCH|sourceDateEpoch/);
    assert.match(contract, /two (?:fresh|independent)[\s\S]{0,120}depth-one checkouts[\s\S]{0,180}byte-identical/i);
    assert.match(contract, /no symlink/i);
});

test('G1 Alpha contract freezes candidate gates and disposable Chrome matrix', async () => {
    const gates = await source('docs/engineering/release-gates.md');
    const contract = gates.split('## 4.1 Closed G1 Alpha acceptance contract')[1]
        ?.split('## 5.')[0];
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

test('G1 Alpha contract preserves privacy, rollback and remaining non-PASS gates', async () => {
    const gates = await source('docs/engineering/release-gates.md');
    const contract = gates.split('## 4.1 Closed G1 Alpha acceptance contract')[1]
        ?.split('## 5.')[0];
    assert.notEqual(contract, undefined);
    assert.match(contract, /synthetic-only/i);
    assert.match(contract, /no (?:real )?Token[\s\S]{0,120}provider credential[\s\S]{0,120}private/i);
    assert.match(contract, /withdraw[\s\S]{0,160}(?:stop sharing|remove|replace)[\s\S]{0,160}artifact/i);
    assert.match(contract, /never[\s\S]{0,120}(?:clear|delete)[\s\S]{0,180}Legacy[\s\S]{0,80}V2[\s\S]{0,80}(?:Cache Storage|cache)[\s\S]{0,80}settings/i);
    assert.match(contract, /G2[\s\S]{0,80}NOT RUN[\s\S]{0,120}G3[\s\S]{0,80}PARTIAL/i);
    for (const gate of ['G5', 'G6', 'G7', 'G8', 'G9', 'G10', 'G12', 'G13']) {
        assert.match(contract, new RegExp(`${gate}[\\s\\S]{0,100}(?:NOT RUN|PARTIAL|BLOCKED)`));
    }
    assert.match(contract, /G13 is `PARTIAL`[\s\S]{0,220}(?:Option A[\s\S]{0,80}repair\/freeze|candidate-building phase)/i);
    assert.match(contract, /tag[\s\S]{0,120}GitHub Release[\s\S]{0,160}separate later G13 authorization/i);
    assert.doesNotMatch(contract, /real (?:Legacy|parity)[^\n]*(?:is|=)\s*`?PASS/i);
});

test('canonical roadmap has the exact remaining A-F gate rows and no external PASS', async () => {
    const gates = await source('docs/engineering/release-gates.md');
    const remaining = gates.split('## 4. Canonical remaining gate inventory')[1]?.split('## 5.')[0];
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
    assert.match(gates, /\| Status \| Accepted \|/);
    assert.match(gates, /`PASS deterministic`[\s\S]{0,80}`PASS verified`/);
    assert.match(gates, /`PASS verified`[\s\S]{0,240}exact acceptance evidence[\s\S]{0,160}verifier\/owner[\s\S]{0,160}environment/i);
    for (const row of actualRows) {
        const columns = row.split('|').map(column => column.trim());
        assert.doesNotMatch(columns[3], /^PASS\b/i, `${columns[1]} external Result must not be PASS`);
    }
});

test('shortest Alpha path stays local synthetic-only and defers real evidence to RC', async () => {
    const gates = await source('docs/engineering/release-gates.md');
    const alpha = gates.split('## 5. Shortest honest V2 Alpha path')[1]?.split('## 6.')[0];
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
        dependency.indexOf('owner-approved Option A seventeen-path repair'),
        dependency.indexOf('Task-Brief-only commit `C` freezes the sole candidate'),
        dependency.indexOf('post-`C` exact builds'),
        dependency.indexOf('exact-SHA PR/check-run/control-tower ledger records G12'),
        dependency.indexOf('XiChuan9 exact-object approval'),
        dependency.indexOf('G13 tag/Release/publication action')
    ];
    assert(alphaOrder.every(position => position >= 0));
    assert(alphaOrder.every((position, index) => index === 0 || alphaOrder[index - 1] < position));
});

test('complete v2 path freezes owner dispositions without claiming unrun evidence', async () => {
    const gates = await source('docs/engineering/release-gates.md');
    const full = gates.split('## 6. Complete v2.0 path')[1]?.split('## 7.')[0];
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

test('documentation index and limitations point to the canonical roadmap', async () => {
    const [index, limitations] = await Promise.all([
        source('docs/README.md'),
        source('docs/guides/known-limitations.md')
    ]);
    assert.match(index, /Current authoritative roadmap[\s\S]{0,120}release-gates\.md/i);
    assert.doesNotMatch(index, /Current evidence ledger[\s\S]{0,120}PR-24/i);
    assert.match(index, /PR-24[\s\S]{0,120}(?:historical|point-in-time)/i);
    assert.match(
        index,
        /privacy guide[\s\S]{0,180}(?:pre-M34|pre-decision)[\s\S]{0,120}R3[\s\S]{0,180}superseded[\s\S]{0,120}release-gates\.md/i
    );
    assert.match(limitations, /authoritative[\s\S]{0,120}release-gates\.md/i);
    assert.match(limitations, /PR #57[\s\S]{0,120}(?:closed|PASS deterministic)/i);
    assert.match(limitations, /PR #58[\s\S]{0,120}(?:closed|PASS deterministic)/i);
    assert.doesNotMatch(limitations, /P1-DOCS remains open/i);
    assert.match(limitations, /G2[\s\S]{0,100}RC/);
    assert.match(limitations, /G3[\s\S]{0,100}RC/);
    assert.match(limitations, /2026-11-12/);
    assert.match(limitations, /no-rewrite[\s\S]{0,100}(?:disposition|risk acceptance)/i);
});
