import test from 'node:test';
import assert from 'node:assert/strict';

import {
  DEFAULT_FEATURE_FLAGS,
  getFeatureFlags,
  resolveFeatureFlags,
} from '../js/app/feature-flags.js';

test('feature flags default to the legacy repository with local v2 paths disabled', () => {
  assert.deepEqual(resolveFeatureFlags(), DEFAULT_FEATURE_FLAGS);
});

test('feature flag overrides are explicit and validated', () => {
  assert.deepEqual(
    resolveFeatureFlags({
      dataRepositoryMode: 'shadow',
      localImportEnabled: true,
      canonicalShadowWriteEnabled: true,
    }),
    {
      dataRepositoryMode: 'shadow',
      localImportEnabled: true,
      canonicalShadowWriteEnabled: true,
    },
  );

  assert.deepEqual(
    resolveFeatureFlags({
      dataRepositoryMode: 'unknown',
      localImportEnabled: 'true',
    }),
    DEFAULT_FEATURE_FLAGS,
  );
});

test('shadow writing requires the exact shadow mode and strict boolean gate', () => {
  for (const dataRepositoryMode of ['legacy', 'canonical', 'v2', 'unknown']) {
    const resolved = resolveFeatureFlags({
      dataRepositoryMode,
      canonicalShadowWriteEnabled: true,
    });
    assert.equal(resolved.canonicalShadowWriteEnabled, false);
    assert.equal(
      resolved.dataRepositoryMode,
      ['legacy', 'canonical'].includes(dataRepositoryMode)
        ? dataRepositoryMode
        : 'legacy',
    );
  }
  assert.equal(
    resolveFeatureFlags({
      dataRepositoryMode: 'shadow',
      canonicalShadowWriteEnabled: 'true',
    }).canonicalShadowWriteEnabled,
    false,
  );
});

test('unsafe feature flag descriptors and Proxies fail closed without getters', () => {
  let getterCalls = 0;
  const accessor = {};
  Object.defineProperty(accessor, 'dataRepositoryMode', {
    enumerable: true,
    get() {
      getterCalls += 1;
      return 'shadow';
    },
  });
  const revoked = Proxy.revocable({
    dataRepositoryMode: 'shadow',
    canonicalShadowWriteEnabled: true,
  }, {});
  revoked.revoke();

  assert.equal(resolveFeatureFlags(accessor), DEFAULT_FEATURE_FLAGS);
  assert.equal(resolveFeatureFlags(revoked.proxy), DEFAULT_FEATURE_FLAGS);
  assert.equal(resolveFeatureFlags(Object.create(null)), DEFAULT_FEATURE_FLAGS);
  assert.equal(getterCalls, 0);
});

test('runtime feature flags do not mutate the defaults', () => {
  const resolved = getFeatureFlags({ localImportEnabled: true });

  assert.equal(resolved.localImportEnabled, true);
  assert.equal(DEFAULT_FEATURE_FLAGS.localImportEnabled, false);
  assert.equal(Object.isFrozen(resolved), true);
});
