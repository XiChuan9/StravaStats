import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const projectRoot = new URL('../../', import.meta.url);

async function source(path) {
    return readFile(new URL(path, projectRoot), 'utf8');
}

const htmlEntries = Object.freeze([
    'index.html',
    'html/activity-router.html',
    'html/activity.html',
    'html/run.html',
    'html/bike.html',
    'html/swim.html',
    'html/gear.html'
]);

const productionEntries = Object.freeze([
    'js/app/main.js',
    'js/pages/activity/index.js',
    'js/pages/run/index.js',
    'js/pages/bike/index.js',
    'js/pages/swim/index.js',
    'js/pages/gear/index.js'
]);

const telemetryDocuments = Object.freeze([
    ...htmlEntries,
    'source-manager.html',
    'storage-backup.html',
    'diagnostics.html'
]);

const vendorAssets = Object.freeze(new Map([
    ['js/vendor/d3-7.9.0.min.js', 'f2094bbf6141b359722c4fe454eb6c4b0f0e42cc10cc7af921fc158fceb86539'],
    ['js/vendor/cal-heatmap-4.2.2.min.js', 'e6f941bd8de686b2a5f3fbd104517fe00930d1ab09b75f50c4e171a8617d3abb'],
    ['styles/vendor/cal-heatmap-4.2.2.css', '20c8e128cc432909ddac71206d40522820d94e8dac91d706d9f57886c79ce22f'],
    ['js/vendor/chart-4.5.0.umd.min.js', '2f27bcf471b2d69dd78494f6e2172fb28470eb843820e2f96bb85d39f9618d30'],
    ['js/vendor/chartjs-adapter-date-fns-3.0.0.bundle.min.js', 'ea7ab30d26c38dcf1f2d26bb43e73a94537b58f1906f55e1a546dd09321b5615'],
    ['js/vendor/chartjs-chart-matrix-3.0.0.min.js', '079bc5983bc06fd5c00d8581cf61a65f2c5d754c2e3545ee180b1d595db502d8'],
    ['styles/vendor/leaflet-1.9.4.css', 'a7837102824184820dfa198d1ebcd109ff6d0ff9a2672a074b9a1b4d147d04c6'],
    ['js/vendor/leaflet-1.9.4.min.js', 'db49d009c841f5ca34a888c96511ae936fd9f5533e90d8b2c4d57596f4e5641a'],
    ['js/vendor/leaflet-heat-0.2.0.min.js', 'eb952aae5806a1102729f291bab887dde783ace859819a354827a776e73e486a'],
    ['js/vendor/html2canvas-1.4.1.min.js', 'e87e550794322e574a1fda0c1549a3c70dae5a93d9113417a429016838eab8cb'],
    ['js/vendor/jspdf-2.5.1.umd.min.js', '98ccf17aa10c20bb1301762618fcc9b6ab3a4e7f26b6071d64d0b41154df3875']
]));

test('R11 freezes the exact package dependency graph and lock artifacts semantically', async () => {
    const packageJson = JSON.parse(await source('package.json'));
    const packageLock = JSON.parse(await source('package-lock.json'));
    const dependencies = {
        '@vercel/speed-insights': '^2.0.0',
        'node-fetch': '^2.6.7'
    };
    const devDependencies = { 'fake-indexeddb': '^6.2.5' };
    assert.deepEqual(packageJson.dependencies, dependencies);
    assert.deepEqual(packageJson.devDependencies, devDependencies);
    assert.deepEqual(packageLock.packages[''].dependencies, dependencies);
    assert.deepEqual(packageLock.packages[''].devDependencies, devDependencies);

    const lockedArtifacts = Object.fromEntries(
        Object.entries(packageLock.packages)
            .filter(([path]) => path !== '')
            .map(([path, record]) => [path, {
                version: record.version,
                resolved: record.resolved,
                integrity: record.integrity,
                dev: record.dev === true,
                dependencies: record.dependencies ?? null
            }])
    );
    assert.deepEqual(lockedArtifacts, {
        'node_modules/@vercel/speed-insights': {
            version: '2.0.0', resolved: 'https://registry.npmjs.org/@vercel/speed-insights/-/speed-insights-2.0.0.tgz',
            integrity: 'sha512-jwkNcrTeafWxjmWq4AHBaptSqZiJkYU5adLC9QBSqeim0GcqDMgN5Ievh8OG1rJ6W3A4l1oiP7qr9CWxGuzu3w==',
            dev: false, dependencies: null
        },
        'node_modules/fake-indexeddb': {
            version: '6.2.5', resolved: 'https://registry.npmjs.org/fake-indexeddb/-/fake-indexeddb-6.2.5.tgz',
            integrity: 'sha512-CGnyrvbhPlWYMngksqrSSUT1BAVP49dZocrHuK0SvtR0D5TMs5wP0o3j7jexDJW01KSadjBp1M/71o/KR3nD1w==',
            dev: true, dependencies: null
        },
        'node_modules/node-fetch': {
            version: '2.7.0', resolved: 'https://registry.npmjs.org/node-fetch/-/node-fetch-2.7.0.tgz',
            integrity: 'sha512-c4FRfUm/dbcWZ7U+1Wq0AwCyFL+3nt2bEw05wfxSz+DWpWsitgmSgYmy2dQdWyKC1694ELPqMs/YzUSNozLt8A==',
            dev: false, dependencies: { 'whatwg-url': '^5.0.0' }
        },
        'node_modules/tr46': {
            version: '0.0.3', resolved: 'https://registry.npmjs.org/tr46/-/tr46-0.0.3.tgz',
            integrity: 'sha512-N3WMsuqV66lT30CrXNbEjx4GEwlow3v6rr4mCcv6prnfwhS01rkgyFdjPNBYd9br7LpXV1+Emh01fHnq2Gdgrw==',
            dev: false, dependencies: null
        },
        'node_modules/webidl-conversions': {
            version: '3.0.1', resolved: 'https://registry.npmjs.org/webidl-conversions/-/webidl-conversions-3.0.1.tgz',
            integrity: 'sha512-2JAn3z8AR6rjK8Sm8orRC0h/bcl/DqL7tRPdGZ4I1CjdF+EaMLmYxBHyXuKL849eucPFhvBoxMsflfOb8kxaeQ==',
            dev: false, dependencies: null
        },
        'node_modules/whatwg-url': {
            version: '5.0.0', resolved: 'https://registry.npmjs.org/whatwg-url/-/whatwg-url-5.0.0.tgz',
            integrity: 'sha512-saE57nupxk6v3HY35+jzBwYa0rKSy0XR8JSxZPwgLr7ys0IBzhGviA1/TUGJLmSVqs8pb9AnvICXEuOHLprYTw==',
            dev: false, dependencies: { tr46: '~0.0.3', 'webidl-conversions': '^3.0.0' }
        }
    });
});

test('R11 selected local vendor bytes match the frozen acquisition hashes', async () => {
    for (const [path, digest] of vendorAssets) {
        const bytes = await readFile(new URL(path, projectRoot));
        assert.equal(createHash('sha256').update(bytes).digest('hex'), digest, path);
    }
});

test('R11 every declared local vendor asset uses the SHA-384 of its tracked bytes', async () => {
    const documents = new Map(await Promise.all([
        ...htmlEntries,
        'tests/consumers/external-runtime-browser-smoke.html'
    ].map(async path => [path, await source(path)])));
    for (const path of vendorAssets.keys()) {
        const bytes = await readFile(new URL(path, projectRoot));
        const sri = `sha384-${createHash('sha384').update(bytes).digest('base64')}`;
        let declarations = 0;
        for (const [documentPath, html] of documents) {
            if (!html.includes(`/${path}`)) continue;
            declarations += 1;
            assert.match(html, new RegExp(`integrity="${sri.replaceAll('/', '\\/').replaceAll('+', '\\+')}"`), documentPath);
        }
        assert.ok(declarations > 0, path);
    }
});

test('R11 production documents declare no-referrer, restrictive CSP, and no remote runtime tags', async () => {
    for (const path of htmlEntries) {
        const html = await source(path);
        assert.match(html, /<meta name="referrer" content="no-referrer">/, path);
        assert.match(html, /http-equiv="Content-Security-Policy"/, path);
        assert.match(html, /default-src 'self'/, path);
        assert.match(html, /object-src 'none'/, path);
        assert.match(html, /frame-src 'none'/, path);
        assert.doesNotMatch(html, /<(?:script|iframe)[^>]+(?:src)=['"]https?:\/\//i, path);
        assert.doesNotMatch(html, /<link[^>]+rel=['"]stylesheet['"][^>]+href=['"]https?:\/\//i, path);
        assert.doesNotMatch(html, /googletagmanager|google-analytics|clarity\.ms|_vercel\/insights/i, path);
    }
});

test('R11 every production-reachable document is free of telemetry declarations', async () => {
    for (const path of telemetryDocuments) {
        const html = await source(path);
        assert.doesNotMatch(html, /googletagmanager|google-analytics|clarity\.ms|_vercel\/(?:insights|speed-insights)/i, path);
    }
});

test('R11 CSP connect allowlists are page-minimal and contain no wildcard scheme', async () => {
    const expected = new Map([
        ['index.html', "connect-src 'self' https://archive-api.open-meteo.com https://generativelanguage.googleapis.com https://a.tile.openstreetmap.org https://b.tile.openstreetmap.org https://c.tile.openstreetmap.org;"],
        ['html/activity-router.html', "connect-src 'self';"],
        ['html/activity.html', "connect-src 'self' https://archive-api.open-meteo.com https://a.tile.openstreetmap.org https://b.tile.openstreetmap.org https://c.tile.openstreetmap.org;"],
        ['html/run.html', "connect-src 'self' https://archive-api.open-meteo.com https://a.tile.openstreetmap.org https://b.tile.openstreetmap.org https://c.tile.openstreetmap.org;"],
        ['html/bike.html', "connect-src 'self' https://archive-api.open-meteo.com https://a.tile.openstreetmap.org https://b.tile.openstreetmap.org https://c.tile.openstreetmap.org;"],
        ['html/swim.html', "connect-src 'self' https://archive-api.open-meteo.com;"],
        ['html/gear.html', "connect-src 'self' https://a.tile.openstreetmap.org https://b.tile.openstreetmap.org https://c.tile.openstreetmap.org;"]
    ]);
    for (const [path, connectSource] of expected) {
        const html = await source(path);
        assert.equal(html.includes(connectSource), true, path);
        assert.doesNotMatch(html, /(?:script|connect|frame)-src[^;]*(?:\*|\bhttps:)(?:\s|;)/, path);
    }
});

test('R11 CSP hashes cover every retained production inline script and handler exactly', async () => {
    for (const path of htmlEntries) {
        const html = await source(path);
        for (const match of html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi)) {
            const hash = `sha256-${createHash('sha256').update(match[1]).digest('base64')}`;
            assert.equal(html.includes(`'${hash}'`), true, `${path}: inline script`);
        }
        for (const match of html.matchAll(/\sonclick="([^"]+)"/gi)) {
            const hash = `sha256-${createHash('sha256').update(match[1]).digest('base64')}`;
            assert.equal(html.includes(`'${hash}'`), true, `${path}: inline handler`);
        }
    }
});

test('R11 production entries cannot activate the retained Speed Insights utility', async () => {
    for (const path of productionEntries) {
        assert.doesNotMatch(await source(path), /speed-insights\.js/, path);
    }
    assert.doesNotMatch(await source('html/activity-router.html'), /speed-insights\.js/);
});

test('R11 root uses only versioned same-origin visualization assets with SRI', async () => {
    const html = await source('index.html');
    for (const path of vendorAssets.keys()) {
        const publicPath = `/${path}`;
        assert.match(html, new RegExp(publicPath.replaceAll('.', '\\.')),
            `root declaration: ${publicPath}`);
    }
    assert.equal((html.match(/crossorigin="anonymous"/g) || []).length, vendorAssets.size);
    assert.equal((html.match(/integrity="sha384-/g) || []).length, vendorAssets.size);
    assert.doesNotMatch(html, /<iframe\b/i);
    assert.match(html, /href="https:\/\/vdoto2\.com\/"[^>]+target="_blank"[^>]+rel="noopener noreferrer"/);
});

test('R11 dedicated detail provider links isolate the opener and suppress referrers', async () => {
    for (const path of ['html/run.html', 'html/bike.html', 'html/swim.html']) {
        const html = await source(path);
        assert.match(
            html,
            /id="activity-hero-strava-link"[^>]+target="_blank"[^>]+rel="noopener noreferrer"/,
            path
        );
    }
});

test('R11 external athlete images remain data and Demo uses the exact local placeholder', async () => {
    const demo = await source('js/demo/generator.js');
    const athlete = await source('js/tabs/athlete.js');
    assert.match(demo, /profile_medium:\s*['"]\/icon-sport\.svg['"]/);
    assert.match(demo, /profile:\s*['"]\/icon-sport\.svg['"]/);
    assert.match(athlete, /athlete\.profile_medium === ['"]\/icon-sport\.svg['"]/);
    assert.match(athlete, /image\.src = ['"]\/icon-sport\.svg['"]/);
    assert.doesNotMatch(athlete, /new URL\(String\(athlete\.profile_medium\)\)/);
});

test('R11 every root and detail bootstrap checks Chart before its data entrypoint', async () => {
    const main = await source('js/app/main.js');
    assert.match(main, /if \(!hasCoreVisualizationRuntime\(\)\)\s*\{[\s\S]*?return;[\s\S]*?const documentSessionMode/);

    for (const path of productionEntries.slice(1, 5)) {
        const page = await source(path);
        assert.match(page, /DOMContentLoaded[\s\S]*?if \(!hasCoreVisualizationRuntime\(\)\)[\s\S]*?return;[\s\S]*?initialize\w+Page\(\)/, path);
    }
    const gearHtml = await source('html/gear.html');
    assert.match(gearHtml, /if \(typeof globalThis\.Chart !== 'function'\)[\s\S]*?return;[\s\S]*?renderGearDetailPage\(gearId\)/);
});

test('R11 browser smoke is local-only and covers every approved visualization global', async () => {
    const html = await source('tests/consumers/external-runtime-browser-smoke.html');
    assert.doesNotMatch(html, /<(?:script|iframe)[^>]+src=['"]https?:\/\//i);
    assert.doesNotMatch(html, /<link[^>]+href=['"]https?:\/\//i);
    for (const path of vendorAssets.keys()) {
        assert.match(html, new RegExp(`/${path}`.replaceAll('.', '\\.')), path);
    }
    for (const globalName of [
        'd3',
        'CalHeatmap',
        'Chart',
        'L',
        'html2canvas',
        'jspdf'
    ]) {
        assert.match(html, new RegExp(`globalThis\\.${globalName}`), globalName);
    }
});

test('R11 optional visualization consumers fail locally without a remote fallback', async () => {
    const [run, bike, swim, maps, wrapped, mapBoundary] = await Promise.all([
        source('js/tabs/run-analysis.js'),
        source('js/tabs/bike-analysis.js'),
        source('js/tabs/swim-analysis.js'),
        source('js/tabs/maps.js'),
        source('js/tabs/wrapped.js'),
        source('js/app/map-location-egress.js')
    ]);
    for (const value of [run, bike, swim]) {
        assert.match(value, /typeof CalHeatmap === ['"]undefined['"]/);
    }
    assert.match(maps, /typeof L\.heatLayer === ['"]function['"]/);
    assert.match(mapBoundary, /typeof leaflet\?\.map !== ['"]function['"]/);
    assert.match(mapBoundary, /Map tiles are unavailable\./);
    assert.match(wrapped, /typeof html2canvas === ['"]undefined['"]/);
    assert.match(wrapped, /!window\.jspdf \|\| !window\.jspdf\.jsPDF/);
    for (const value of [run, bike, swim, maps, wrapped, mapBoundary]) {
        assert.doesNotMatch(value, /(?:from|import\s*\(|fetch\s*\()\s*['"]https?:\/\//);
        assert.doesNotMatch(value, /cdn\.jsdelivr|unpkg\.com|d3js\.org/);
    }
});
