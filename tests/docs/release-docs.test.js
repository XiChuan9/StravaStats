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

const FINAL_ROADMAP_ALLOWLIST = Object.freeze([
    'docs/tasks/pr-47-final-v2-release-roadmap.md',
    'docs/engineering/release-gates.md',
    'docs/guides/known-limitations.md',
    'docs/README.md',
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
    ['G13', 'F', 'BLOCKED', 'Alpha / Beta / RC / production']
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
    assert.match(readme, /does not claim an Alpha, Beta, or Release Candidate milestone/i);
    assert.match(readme, /package metadata[\s\S]{0,40}\`1\.0\.0\`/i);
    assert.match(readme, /no[^\n]*v2\.0\.0-\*[^\n]*tag/i);
    assert.match(readme, /no[^\n]*GitHub Release/i);
    assert.match(readme, /package metadata[\s\S]{0,160}no[\s\S]{0,160}release-owner[\s>]*approval/i);
    assert.doesNotMatch(readme, /v2\.0\.0 (?:is |has been )?(?:released|deployed|published)/i);
});

test('current documentation index and changelog share the exact post-Retry baseline', async () => {
    const [index, changelog] = await Promise.all([
        source('docs/README.md'),
        source('CHANGELOG.md')
    ]);
    for (const document of [index, changelog]) {
        assert.match(document, /eb0b6695b5dbf618877ff794dbc76935babeb793/);
        assert.doesNotMatch(document, /61d7b032305fd8f12d71544315f06d553213801d/);
        assert.match(document, /\`1\.0\.0\`/);
        assert.match(document, /not[^\n]*(?:Alpha|Beta|Release Candidate|production release)/i);
    }
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

test('canonical roadmap binds the exact postmerge baseline and deterministic P0/P1 closure', async () => {
    const gates = await source('docs/engineering/release-gates.md');
    assert.match(gates, /f7f18392dc28e1f1d6ed10c1d8cc0aa297ab7628/);
    assert.doesNotMatch(gates, /integration\/v2@eb0b6695b5dbf618877ff794dbc76935babeb793/);
    assert.match(gates, /1,913\/1,913/);
    assert.match(gates, /31569312683[\s\S]{0,80}94027710807/);
    assert.match(gates, /PR #57[\s\S]{0,100}(?:PASS deterministic|closed deterministically)/i);
    assert.match(gates, /PR #58[\s\S]{0,100}(?:PASS deterministic|closed deterministically)/i);
    assert.match(gates, /no unresolved deterministic P0\/P1/i);
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
    assert.match(alpha, /version[\s\S]{0,80}artifact[\s\S]{0,80}(?:BLOCKED|separate authorization)/i);
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

test('complete v2 path freezes owner dispositions without claiming unrun evidence', async () => {
    const gates = await source('docs/engineering/release-gates.md');
    const full = gates.split('## 6. Complete v2.0 path')[1]?.split('## 7.')[0];
    assert.notEqual(full, undefined);
    assert.match(full, /2026-11-12/);
    assert.match(full, /large libraries|large batches/i);
    assert.match(full, /Retry\/Recover\/Abandon/);
    assert.match(full, /representative real-hardware budget task/i);
    assert.match(full, /waiver[\s\S]{0,180}(?:temporarily satisfies|does not block)[\s\S]{0,180}2026-11-12/i);
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
