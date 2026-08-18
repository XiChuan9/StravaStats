import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const ROOT = new URL('../../', import.meta.url);

async function source(path) {
    return readFile(new URL(path, ROOT), 'utf8');
}

test('Diagnostics has one local route and no database, network, or backup coupling', async () => {
    const [html, entry, core, page, storagePage] = await Promise.all([
        source('diagnostics.html'),
        source('js/diagnostics.js'),
        source('js/diagnostics/index.js'),
        source('js/pages/diagnostics/diagnostics.js'),
        source('storage-backup.html')
    ]);
    assert.match(html, /src="\/js\/diagnostics\.js"/);
    assert.match(html, />Estimated origin storage use</);
    assert.match(html, />Estimated origin storage quota</);
    assert.match(html, />Estimated origin storage headroom</);
    assert.match(html, /id="import-performance-records"/);
    assert.match(storagePage, /href="\/diagnostics\.html"/);
    assert.match(entry, /installGlobalDiagnosticsListeners/);
    assert.match(entry, /readImportPerformanceRecords/);
    assert.match(entry, /sessionStorage/);
    assert.match(page, /createDiagnosticsPage/);
    assert.doesNotMatch(`${entry}\n${core}\n${page}`, /indexedDB|createBackupService|fetch\s*\(/);
    assert.doesNotMatch(html, /https?:\/\//);
    assert.match(page, /result\.mimeType/);
});

test('global diagnostics implementation cannot inspect or cancel raw browser errors', async () => {
    const core = await source('js/diagnostics/index.js');
    assert.doesNotMatch(core, /preventDefault\s*\(/);
    assert.doesNotMatch(core, /\.error\b|\.reason\b|\.message\b|\.stack\b|\.cause\b/);
    assert.doesNotMatch(core, /localStorage|indexedDB|console\.(?:log|warn|error)/);
    assert.match(core, /sessionStorage/);
});

test('handled V2 entry seams use only fixed diagnostic records', async () => {
    const paths = [
        'js/main.js',
        'js/app/main.js',
        'js/storage-backup.js',
        'js/pages/storage-backup/storage-backup.js',
        'js/source-manager.js',
        'js/pages/source-manager/source-manager.js',
        'js/pages/activity-router.js',
        'js/pages/activity/index.js',
        'js/pages/run/index.js',
        'js/pages/bike/index.js',
        'js/pages/swim/index.js',
        'js/analysis/index.js'
    ];
    const sources = await Promise.all(paths.map(source));
    for (let index = 0; index < paths.length; index += 1) {
        assert.match(sources[index], /diagnostics\/index\.js/, paths[index]);
        assert.doesNotMatch(
            sources[index],
            /recordDiagnosticError\s*\(\s*error\b|recordDiagnosticError\s*\(\s*err\b/,
            paths[index]
        );
    }
});

test('D9 removes only the exercised raw error-object logs', async () => {
    const [ui, analysis] = await Promise.all([
        source('js/app/ui.js'),
        source('js/analysis/index.js')
    ]);
    assert.doesNotMatch(ui, /console\.error\s*\(\s*message\s*,\s*error\s*\)/);
    assert.doesNotMatch(ui, /Check console for details/);
    assert.doesNotMatch(analysis, /console\.error\s*\([^)]*,\s*error\s*\)/);
    assert.doesNotMatch(analysis, /console\.log\s*\([^)]*sportType/);
    assert.doesNotMatch(analysis, /console\.log\s*\([^)]*processing_time_ms/);
});

test('served Diagnostics smoke covers safe performance export and the versioned MIME', async () => {
    const harness = await source('tests/diagnostics/diagnostics-browser-smoke.html');
    assert.match(harness, /configureImportPerformance/);
    assert.match(harness, /readImportPerformanceRecords/);
    assert.match(harness, /application\/vnd\.stravastats\.diagnostics\+json;version=1/);
    assert.match(harness, /importPerformance\.length\s*!==\s*1/);
    assert.match(harness, /__PR22_DIAGNOSTICS_EVIDENCE__/);
    assert.match(harness, /externalResources/);
    assert.doesNotMatch(harness, /Authorization|Bearer|access_token|activityId|filename|latitude|heartrate|watts/i);
});
