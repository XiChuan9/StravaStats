import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const ROOT = new URL('../../', import.meta.url);

async function source(path) {
    return readFile(new URL(path, ROOT), 'utf8');
}

test('production Source Manager modules import with zero I/O', async () => {
    const counters = {
        fetch: 0,
        worker: 0,
        indexedDB: 0,
        storage: 0,
        timer: 0,
        console: 0
    };
    const originals = {
        fetch: globalThis.fetch,
        Worker: globalThis.Worker,
        indexedDB: globalThis.indexedDB,
        localStorage: globalThis.localStorage,
        sessionStorage: globalThis.sessionStorage,
        setTimeout: globalThis.setTimeout,
        consoleError: console.error,
        consoleWarn: console.warn
    };
    globalThis.fetch = () => { counters.fetch += 1; throw new Error('network'); };
    globalThis.Worker = class { constructor() { counters.worker += 1; } };
    globalThis.indexedDB = new Proxy({}, { get() { counters.indexedDB += 1; throw new Error('idb'); } });
    globalThis.localStorage = new Proxy({}, { get() { counters.storage += 1; throw new Error('storage'); } });
    globalThis.sessionStorage = globalThis.localStorage;
    globalThis.setTimeout = (...args) => { counters.timer += 1; return originals.setTimeout(...args); };
    console.error = () => { counters.console += 1; };
    console.warn = () => { counters.console += 1; };
    try {
        await import(`../../js/pages/source-manager/source-manager.js?zero-io=${Date.now()}`);
        await import(`../../js/app/source-manager.js?zero-io=${Date.now()}`);
    } finally {
        globalThis.fetch = originals.fetch;
        if (originals.Worker === undefined) delete globalThis.Worker;
        else globalThis.Worker = originals.Worker;
        if (originals.indexedDB === undefined) delete globalThis.indexedDB;
        else globalThis.indexedDB = originals.indexedDB;
        if (originals.localStorage === undefined) delete globalThis.localStorage;
        else globalThis.localStorage = originals.localStorage;
        if (originals.sessionStorage === undefined) delete globalThis.sessionStorage;
        else globalThis.sessionStorage = originals.sessionStorage;
        globalThis.setTimeout = originals.setTimeout;
        console.error = originals.consoleError;
        console.warn = originals.consoleWarn;
    }
    assert.deepEqual(counters, {
        fetch: 0, worker: 0, indexedDB: 0, storage: 0, timer: 0, console: 0
    });
});

test('same-origin page has four source cards and complete accessible import controls', async () => {
    const html = await source('source-manager.html');
    assert.equal((html.match(/data-source-card=/g) || []).length, 4);
    for (const sourceName of ['local', 'archive', 'api', 'demo']) {
        assert.match(html, new RegExp(`data-source-card="${sourceName}"`));
    }
    assert.match(html, /<main[^>]+aria-labelledby=/);
    assert.match(html, /<dialog[^>]+aria-labelledby=[^>]+aria-describedby=/);
    assert.match(html, /<label[^>]+for="file-input"[^>]*>Choose CSV, ZIP, FIT, TCX, or GPX files<\/label>/);
    assert.match(html, /type="file"[^>]+multiple[^>]+accept="\.csv,\.zip,\.fit,\.tcx,\.gpx"/);
    assert.match(html, /id="dropzone"[^>]+role="button"[^>]+tabindex="0"/);
    assert.match(html, /id="import-live"[^>]+aria-live="polite"/);
    assert.match(html, /id="import-alert"[^>]+aria-live="assertive"/);
    assert.match(html, /<progress[^>]+aria-label=/);
    assert.match(html, /id="cancel-import"/);
    assert.match(html, /id="duplicate-review"[^>]+aria-labelledby=/);
    assert.match(html, /id="duplicate-review-dialog"[^>]+aria-labelledby=[^>]+aria-describedby=/);
    assert.match(html, /Confirm same activity/);
    assert.match(html, /Keep separate/);
    assert.match(html, />Later</);
    assert.match(html, /does not merge, hide, replace, or delete either activity/);
    assert.match(html, /Import FIT, TCX, GPX, or an English Strava/);
    assert.doesNotMatch(html, /FIT, TCX, and GPX are not supported yet/);
    assert.match(html, /Disconnecting and deleting local data are separate actions/);
    assert.doesNotMatch(html, /https?:\/\//);
    assert.match(html, /href="\/storage-backup\.html">Storage &amp; Backup<\/a>/);
    assert.doesNotMatch(html, /storage-backup\.html\?mode=real/);
    const backupApp = await source('js/app/storage-backup.js');
    assert.match(backupApp, /source\.pathname === '\/source-manager\.html'/);
    assert.match(backupApp, /source\.origin === origin/);
    assert.match(backupApp, /STORAGE_BACKUP_SESSION_MODE\.DEMO/);
});

test('PR-21 freezes an exact sixteen-path hard maximum with no scope expansion', async () => {
    const brief = await source('docs/tasks/pr-21-backup-restore.md');
    const allowed = [
        'docs/tasks/pr-21-backup-restore.md',
        'docs/migrations/indexeddb-v2.md',
        'docs/migrations/rollback-plan.md',
        'source-manager.html',
        'storage-backup.html',
        'js/storage-backup.js',
        'js/app/storage-backup.js',
        'js/pages/storage-backup/storage-backup.js',
        'js/backup/index.js',
        'js/backup/codec.js',
        'js/backup/backup-service.js',
        'tests/backup/codec.test.js',
        'tests/backup/backup-service.test.js',
        'tests/backup/backup-boundaries.test.js',
        'tests/backup/backup-browser-smoke.html',
        'tests/source-manager/source-manager-boundaries.test.js'
    ];
    assert.equal(new Set(allowed).size, 16);
    for (const path of allowed) assert.equal(brief.includes(path), true, path);
    assert.match(brief, /hard maximum is exactly sixteen paths/i);
    assert.match(brief, /seventeenth path pauses implementation/i);
});

test('page consumer does not select storage/provider/auth or disclose raw inputs', async () => {
    const page = await source('js/pages/source-manager/source-manager.js');
    assert.doesNotMatch(page, /indexedDB|IDBObjectStore|objectStore\s*\(|getRawArtifact|rawArtifacts/);
    assert.doesNotMatch(page, /fetch\s*\(|XMLHttpRequest|WebSocket|\/api\/|strava\.com/);
    assert.doesNotMatch(page, /localStorage|sessionStorage|Authorization|Bearer|access_token|refresh_token/);
    assert.doesNotMatch(page, /console\.|innerHTML|insertAdjacentHTML|outerHTML/);
    assert.doesNotMatch(page, /error\.(message|stack|cause)|file\.name[^,;\n]*textContent/);
    assert.match(page, /SAFE_UI_CODES\.has\(descriptor\.value\)/);
    assert.match(page, /label: `CSV file \$\{ordinal \+ 1\}`/);
    assert.match(page, /label: `ZIP file \$\{ordinal \+ 1\}`/);
    assert.match(page, /label: `FIT file \$\{ordinal \+ 1\}`/);
    assert.match(page, /`\$\{kind\.toUpperCase\(\)\} file \$\{ordinal \+ 1\}`/);
});

test('composition root uses only existing public Import/V2 boundaries and keeps Demo isolated', async () => {
    const app = await source('js/app/source-manager.js');
    assert.match(app, /createImportService/);
    assert.match(app, /createBrowserImportWorker/);
    assert.match(app, /createImportStore/);
    assert.match(app, /listImportJobs\(\)/);
    assert.match(app, /service\.getReport\(job\.id\)/);
    assert.match(app, /importStore\.listDuplicateReviewCandidates\(\)/);
    assert.match(app, /importStore\.getDuplicateReviewCandidate\(id\)/);
    assert.match(app, /importStore\.decideDuplicateReviewCandidate/);
    assert.doesNotMatch(app, /getRawArtifact|storeRawArtifact|persistImportItem|transaction|objectStore/);
    assert.doesNotMatch(app, /fetch\s*\(|\/api\/|Authorization|Token|localStorage|sessionStorage/);
    assert.match(app, /mode === SOURCE_MANAGER_SESSION_MODE\.DEMO\s*\? demoFacade\(\)/);
});

test('progress, duplicate, cancel, reload, and report UI are driven by real boundary values', async () => {
    const page = await source('js/pages/source-manager/source-manager.js');
    assert.match(page, /importFacade\.importArtifacts\(artifacts\)/);
    assert.match(page, /importFacade\.getReport\(activeJobId\)/);
    assert.match(page, /importFacade\.waitForJob\(activeJobId\)/);
    assert.match(page, /importFacade\.cancelJob\(activeJobId\)/);
    assert.match(page, /importFacade\.listPersistedReports\(\)/);
    assert.match(page, /importFacade\.previewActivities\(\)/);
    assert.match(page, /importFacade\.listDuplicateReviews\(\)/);
    assert.match(page, /importFacade\.getDuplicateReview\(token\)/);
    assert.match(page, /importFacade\.decideDuplicateReview/);
    assert.match(page, /Both activities remain in the library/);
    assert.match(page, /skippedExactDuplicate/);
    assert.match(page, /MAX_VISIBLE_REPORT_ITEMS = 100/);
    assert.match(page, /additional items are not shown/);
    assert.doesNotMatch(page, /Math\.random|fake.?progress|progressBar\.value\s*\+=/i);
});

test('narrow-screen CSS retains critical actions at 320px', async () => {
    const css = await source('styles/source-manager.css');
    assert.match(css, /min-width:\s*320px/);
    assert.match(css, /@media \(max-width: 380px\)/);
    assert.match(css, /\.dialog-actions[^}]*flex-direction:\s*column-reverse/s);
    assert.match(css, /#cancel-import[^}]*width:\s*100%/s);
    assert.match(css, /\.source-grid[^}]*grid-template-columns:\s*1fr/s);
});

test('Task Brief freezes the exact nine-path allowlist and protected scope', async () => {
    const brief = await source('docs/tasks/pr-10-source-manager.md');
    const allowed = [
        'docs/tasks/pr-10-source-manager.md',
        'source-manager.html',
        'styles/source-manager.css',
        'js/source-manager.js',
        'js/app/source-manager.js',
        'js/pages/source-manager/source-manager.js',
        'tests/source-manager/source-manager.test.js',
        'tests/source-manager/source-manager-boundaries.test.js',
        'tests/source-manager/source-manager-browser-smoke.html'
    ];
    assert.equal(new Set(allowed).size, 9);
    for (const path of allowed) assert.equal(brief.includes(path), true, path);
    assert.match(brief, /cumulative maximum is exactly nine paths/i);
    assert.match(brief, /A tenth path requires a necessity\s+record/i);
    assert.match(brief, /Package\/lockfile/);
    assert.match(brief, /public\/aggregate Import API/);
    assert.match(brief, /Root `index\.html`/);
});

test('Import and Repository public surfaces remain frozen', async () => {
    const importModule = await import('../../js/import/index.js');
    assert.deepEqual(Object.keys(importModule).sort(), [
        'IMPORT_ERROR_CODE', 'IMPORT_ITEM_STATUS', 'IMPORT_JOB_STATUS',
        'ImportError', 'SYNTHETIC_JSON_MEDIA_TYPE',
        'assertImportItemTransition', 'assertImportJobTransition',
        'createBrowserImportWorker', 'createDecoderRegistry',
        'createImportService', 'createInlineImportWorker',
        'normalizeImportedActivity', 'syntheticJsonDecoder'
    ]);
    const repository = await import('../../js/repository/index.js');
    assert.equal(Object.keys(repository).includes('importActivities'), false);
    assert.equal(Object.keys(repository).includes('listImportJobs'), false);
});
