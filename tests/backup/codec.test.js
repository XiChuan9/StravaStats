import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
import test from 'node:test';

import {
    BACKUP_ENTRY_PATHS,
    BackupCodecError,
    createDeterministicZip,
    decodeJsonLines,
    decodeTaggedValue,
    encodeJsonLines,
    encodeTaggedValue,
    parseDeterministicZip
} from '../../js/backup/codec.js';

function entries(seed = 'synthetic') {
    return BACKUP_ENTRY_PATHS.map((path, index) => ({
        path,
        bytes: new TextEncoder().encode(`${seed}:${index}`)
    }));
}

test('tagged values preserve missing, null, true zero, negative zero, opaque IDs, and special own keys', () => {
    const value = {
        opaque: '001:activity:not-a-number',
        nullValue: null,
        positiveZero: 0,
        negativeZero: -0,
        nested: { constructor: 'own', prototype: 'own' }
    };
    Object.defineProperty(value, '__proto__', {
        value: 'own-proto-key', enumerable: true, writable: true, configurable: true
    });
    const decoded = decodeTaggedValue(encodeTaggedValue(value));
    assert.equal(Object.hasOwn(decoded, 'missing'), false);
    assert.equal(decoded.nullValue, null);
    assert.equal(Object.is(decoded.positiveZero, 0), true);
    assert.equal(Object.is(decoded.negativeZero, -0), true);
    assert.equal(decoded.opaque, value.opaque);
    assert.equal(decoded.__proto__, 'own-proto-key');
    assert.equal(decoded.nested.constructor, 'own');
});

test('tagged encoding is deterministic by code-unit key order', () => {
    assert.equal(
        encodeTaggedValue({ z: 1, A: 2, a: 3 }),
        encodeTaggedValue({ a: 3, z: 1, A: 2 })
    );
    assert.deepEqual(decodeJsonLines(encodeJsonLines([{ id: '2' }, { id: '10' }])), [
        { id: '2' }, { id: '10' }
    ]);
});

test('hostile accessors, proxies, symbols, cycles, sparse arrays, prototypes, and non-finite numbers fail closed', () => {
    const accessor = {};
    Object.defineProperty(accessor, 'secret', { enumerable: true, get() { throw new Error('read'); } });
    const cyclic = {}; cyclic.self = cyclic;
    const sparse = []; sparse.length = 2; sparse[1] = 'x';
    const custom = Object.create({ inherited: true }); custom.value = 1;
    const symbol = { [Symbol('x')]: 1 };
    const proxy = new Proxy({}, { ownKeys() { throw new Error('trap'); } });
    for (const value of [
        accessor, cyclic, sparse, custom, symbol, proxy,
        Number.NaN, Infinity, -Infinity, undefined, 1n, () => {}
    ]) {
        assert.throws(() => encodeTaggedValue(value), BackupCodecError);
    }
});

test('deterministic stored ZIP bytes and central hashes are byte-identical', async () => {
    const first = await createDeterministicZip(entries(), webcrypto);
    const second = await createDeterministicZip(entries(), webcrypto);
    assert.deepEqual(first, second);
    const parsed = await parseDeterministicZip(first, webcrypto);
    assert.deepEqual(parsed.map(entry => entry.path), BACKUP_ENTRY_PATHS);
    assert.deepEqual(parsed.map(entry => new TextDecoder().decode(entry.bytes)),
        entries().map(entry => new TextDecoder().decode(entry.bytes)));
});

test('container rejects reordered, traversal, duplicate, truncated, appended, CRC, and central hash mutations', async () => {
    await assert.rejects(
        createDeterministicZip([
            { ...entries()[0], path: '../manifest.json' }, ...entries().slice(1)
        ], webcrypto),
        error => error.code === 'BACKUP_CONTAINER_INVALID'
    );
    await assert.rejects(
        createDeterministicZip([
            entries()[1], entries()[0], ...entries().slice(2)
        ], webcrypto),
        error => error.code === 'BACKUP_CONTAINER_INVALID'
    );
    const archive = await createDeterministicZip(entries(), webcrypto);
    await assert.rejects(parseDeterministicZip(archive.slice(0, -1), webcrypto));
    const appended = new Uint8Array(archive.length + 1); appended.set(archive);
    await assert.rejects(parseDeterministicZip(appended, webcrypto));
    const contentMutated = archive.slice();
    contentMutated[30 + new TextEncoder().encode('manifest.json').length] ^= 1;
    await assert.rejects(
        parseDeterministicZip(contentMutated, webcrypto),
        error => error.code === 'BACKUP_HASH_MISMATCH'
    );
    const centralMutated = archive.slice();
    const end = centralMutated.length - 22;
    const central = new DataView(centralMutated.buffer).getUint32(end + 16, true);
    const nameLength = new DataView(centralMutated.buffer).getUint16(central + 28, true);
    centralMutated[central + 46 + nameLength + 4] ^= 1;
    await assert.rejects(
        parseDeterministicZip(centralMutated, webcrypto),
        error => error.code === 'BACKUP_HASH_MISMATCH'
    );
});

test('JSONL framing rejects CRLF, missing terminal newline, empty lines, malformed tags, and invalid UTF-8', () => {
    const encoder = new TextEncoder();
    for (const bytes of [
        encoder.encode('["n"]\r\n'),
        encoder.encode('["n"]'),
        encoder.encode('["n"]\n\n'),
        encoder.encode('["unknown"]\n'),
        Uint8Array.of(0xff, 0x0a)
    ]) assert.throws(() => decodeJsonLines(bytes), BackupCodecError);
});
