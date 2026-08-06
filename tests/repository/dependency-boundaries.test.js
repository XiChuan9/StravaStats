import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import {
    readFile,
    readdir
} from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    '../..'
);

async function javascriptFiles(directory) {
    const entries = await readdir(directory, { withFileTypes: true });
    const files = [];
    for (const entry of entries) {
        const target = path.join(directory, entry.name);
        if (entry.isDirectory()) {
            files.push(...await javascriptFiles(target));
        } else if (entry.isFile() && entry.name.endsWith('.js')) {
            files.push(target);
        }
    }
    return files;
}

function relativeImports(source) {
    return [...source.matchAll(
        /(?:import|export)\s+(?:[\s\S]*?\sfrom\s+)?['"]([^'"]+)['"]/g
    )].map(match => match[1]).filter(value => value.startsWith('.'));
}

test('public Repository index exports exactly five approved names', async () => {
    const module = await import('../../js/repository/index.js');
    assert.deepEqual(
        Object.keys(module).sort(),
        [
            'createRepository',
            'RepositoryError',
            'REPOSITORY_ERROR_CODE',
            'REPOSITORY_SOURCE',
            'REPOSITORY_WARNING_CODE'
        ].sort()
    );
    for (const forbidden of [
        'LegacyRepository',
        'DemoRepository',
        'StravaApiConnector',
        'StravaConnectorError',
        'LegacyCacheAdapter',
        'projectLegacyValue',
        'createRepositoryWithDependencies'
    ]) {
        assert.equal(Object.hasOwn(module, forbidden), false);
    }
});

test('Repository and Connector module graph has no circular imports', async () => {
    const files = [
        ...await javascriptFiles(path.join(ROOT, 'js/repository')),
        ...await javascriptFiles(path.join(ROOT, 'js/connectors/strava'))
    ];
    const fileSet = new Set(files.map(file => path.resolve(file)));
    const graph = new Map();
    for (const file of files) {
        const source = await readFile(file, 'utf8');
        const imports = relativeImports(source)
            .map(specifier => path.resolve(path.dirname(file), specifier))
            .filter(target => fileSet.has(target));
        graph.set(path.resolve(file), imports);
    }

    const visited = new Set();
    const active = new Set();
    function visit(file) {
        assert.equal(
            active.has(file),
            false,
            `circular import detected at ${path.relative(ROOT, file)}`
        );
        if (visited.has(file)) return;
        active.add(file);
        for (const dependency of graph.get(file) || []) visit(dependency);
        active.delete(file);
        visited.add(file);
    }
    for (const file of graph.keys()) visit(file);
});

test('Repository source respects provider, consumer, and contract boundaries', async () => {
    const files = await javascriptFiles(path.join(ROOT, 'js/repository'));
    for (const file of files) {
        const source = await readFile(file, 'utf8');
        assert.doesNotMatch(source, /services\/api\.js/);
        assert.doesNotMatch(source, /(?:pages|tabs|analysis|app\/main)\//);
        assert.doesNotMatch(source, /data\/contracts/);
        assert.doesNotMatch(source, /\/api\/strava-/);
    }

    const connector = await readFile(
        path.join(
            ROOT,
            'js/connectors/strava/strava-api-connector.js'
        ),
        'utf8'
    );
    assert.doesNotMatch(connector, /repository\//);

    const contracts = await javascriptFiles(
        path.join(ROOT, 'js/data/contracts')
    );
    for (const file of contracts) {
        assert.doesNotMatch(await readFile(file, 'utf8'), /repository\//);
    }
});

test('public import performs zero token, storage, network, or DOM side effects', async () => {
    const names = [
        'fetch',
        'localStorage',
        'indexedDB',
        'document',
        'window',
        'btoa'
    ];
    const originals = new Map(
        names.map(name => [
            name,
            Object.getOwnPropertyDescriptor(globalThis, name)
        ])
    );
    let accesses = 0;
    try {
        for (const name of names) {
            Object.defineProperty(globalThis, name, {
                configurable: true,
                get() {
                    accesses += 1;
                    throw new Error('import side effect');
                }
            });
        }
        const url = pathToFileURL(
            path.join(ROOT, 'js/repository/index.js')
        );
        const module = await import(`${url.href}?side-effects=${Date.now()}`);
        assert.equal(typeof module.createRepository, 'function');
        assert.equal(accesses, 0);
    } finally {
        for (const [name, descriptor] of originals) {
            if (descriptor) {
                Object.defineProperty(globalThis, name, descriptor);
            } else {
                delete globalThis[name];
            }
        }
    }
});

test('approved Connector implementation matches the frozen PR-04B B1 hash', async () => {
    // PR-04B B1 approved the Connector and test changes for the type= fix.
    // Later PRs may extend public Repository literals and their exact tests
    // without weakening the frozen Connector implementation boundary.
    const expected = new Map([
        [
            'js/connectors/strava/strava-api-connector.js',
            'ea3810a190451cf9bdff9f4f2bdcc3a81a8591c4ec385b14dd07de6324061ba8'
        ]
    ]);
    for (const [relative, hash] of expected) {
        const content = await readFile(path.join(ROOT, relative));
        assert.equal(
            createHash('sha256').update(content).digest('hex'),
            hash,
            relative
        );
    }
});

test('Canonical Repository reaches local data only through the Storage boundary', async () => {
    const canonical = await readFile(
        path.join(ROOT, 'js/repository/canonical/canonical-repository.js'),
        'utf8'
    );
    assert.match(canonical, /\.\.\/\.\.\/storage\/index\.js/);
    assert.doesNotMatch(
        canonical,
        /indexedDB|IDB(?:Database|ObjectStore|Index|Request|Transaction)|localStorage/
    );
    assert.doesNotMatch(
        canonical,
        /Authorization|Token|connector|provider|services\/activity-cache/
    );
});

test('Repository modules contain no logging or runtime compilation', async () => {
    const files = await javascriptFiles(path.join(ROOT, 'js/repository'));
    for (const file of files) {
        const source = await readFile(file, 'utf8');
        assert.doesNotMatch(source, /\bconsole\.(?:log|warn|error)\b/);
        assert.doesNotMatch(source, /\beval\s*\(|\bnew Function\b/);
    }
});
