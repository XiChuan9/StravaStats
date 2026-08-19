# Security Privacy and Local Development Guards

## Metadata

| Field | Value |
| --- | --- |
| Status | Implementation authorized; delivery separately gated |
| Base | `codex/public/local-import-core@c15c9aac9470b68b1cfc2a14c6ab1099e3c71b35` |
| Feature branch | `codex/security-privacy-dev-guards` |
| Data migration | None |
| Runtime product behavior | None |
| Dependency or lockfile change | None |

## Goal

Close the repository privacy-guard gap for activity CSV and unapproved binary
evidence, remove process-wide TLS certificate bypass from the local developer
server, and reject API request bodies above 65,536 bytes before handler work.

## Allowed paths

```text
LOCAL_SETUP.md
docs/tasks/security-privacy-dev-guards.md
scripts/check-privacy.mjs
scripts/local-dev-server.mjs
tests/privacy/privacy-guard.test.js
tests/server/local-dev-server.test.js
```

No application page, provider API handler, storage, import, backup, schema,
migration, dependency, lockfile, release, or deployment path is authorized.

## Frozen decisions

- CSV, FIT, TCX, GPX, and ZIP artifacts are allowed only below the explicit
  deterministic synthetic-fixture root.
- The three existing application background JPEGs are the only approved raster
  assets. Their paths and SHA-256 digests are fixed; renamed or changed binary
  payloads fail the privacy check.
- The local server keeps ordinary TLS hostname and certificate validation.
  Corporate trust anchors are supplied externally through
  `NODE_EXTRA_CA_CERTS`; the repository never disables validation.
- Every local `/api/*` request body has one 65,536-byte ceiling, whether or not
  `Content-Length` is present. The server drains but does not buffer bytes after
  the ceiling and returns a fixed 413 response.

## Acceptance

- Synthetic CSV and the three exact background assets pass; a non-synthetic
  CSV, new image/PDF, changed background, or renamed recognized binary fails.
- Exact 65,536-byte API bodies reach normal handler validation, while declared
  and chunked 65,537-byte bodies return 413 without invoking provider work.
- `NODE_TLS_REJECT_UNAUTHORIZED` is absent from production and test sources.
- Focused privacy/server tests and all repository-minimum checks pass under the
  pinned Node/npm toolchain.

## Migration, privacy, rollback, and delivery

No user storage, cache, credential, activity, fixture, schema, or migration is
read or changed. Rollback is an ordinary code revert. Do not merge, release, or
deploy without the separately required delivery gate.
