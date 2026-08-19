# Security Import and Export Boundaries

## Metadata

| Field | Value |
| --- | --- |
| Status | Approved for implementation; delivery separately gated |
| Base | `codex/public/local-import-core@2dda7de08993e4305865441164f282d94f43f5ae` |
| Feature branch | `codex/security-import-export` |
| Data migration | None |
| Dependency or lockfile change | None |

## Goal

Close the validated CSV memory-amplification, unbounded HRV import, and
spreadsheet-formula export findings without changing Canonical data, storage,
schemas, import formats exposed to users, analysis algorithms, or deployment.

## Allowed paths

```text
docs/tasks/security-import-export.md
js/shared/csv-security.js
js/import/csv-tokenizer.js
js/import/activities-csv-decoder.js
js/import/import-service.js
js/tabs/dashboard.js
js/tabs/activities.js
js/app/ui.js
js/analysis/export/csv.js
tests/import/activities-csv.test.js
tests/import/import-core.test.js
tests/security/import-export-boundaries.test.js
tests/source-manager/source-manager-recovery.test.js
tests/release/alpha-candidate.test.js
```

The release-test path may only account for the one new tracked internal CSV
security module. No selector, manifest, workflow, release runtime, publish, or
deployment change is authorized. No backup/restore, DOM renderer, analysis
algorithm, storage, schema, migration, dependency, lockfile, or user-data path
is authorized.

## Frozen decisions

- Activities CSV retains the exact 5,242,880-byte, 10,000-row, 128-column,
  262,144-byte field, and 1,048,576-byte row limits.
- Framing scans once, enforces limits while consuming input, and emits compact,
  self-contained row frames whose aggregate size is linear in input plus row
  count. A large header or unterminated field cannot be multiplied by a claimed
  row count.
- Existing English header semantics, per-row failure isolation, warning codes,
  Canonical output, retry, duplicate identity, and old stored CSV row decoding
  remain compatible.
- Retry and recovery re-hash retained row frames before any state or Worker
  mutation and require exact agreement among content bytes, stored digest,
  digest-derived artifact ID, and the ImportItem artifact reference.
- Garmin HRV CSV uses the same 5,242,880-byte and 10,000-data-row limits, with
  a native File-size preflight before text allocation and an encoded-byte check
  after reading.
- Every CSV export cell whose first meaningful character is `=`, `+`, `-`, `@`,
  or a control character receives a text prefix. Leading whitespace cannot
  bypass the rule. Canonical and in-memory activity/track data are unchanged.

## Acceptance

- Oversized, maximum-row, oversized-field, unterminated quoted-field, large
  header, and ordinary quoted/newline Activities CSV cases have deterministic
  tests and retain stable redacted errors.
- Tampering with any compact-frame interpretation field makes the retained
  source unavailable before retry state or Worker mutation.
- HRV accepts the exact byte/row boundaries and rejects one over before storage
  mutation; native file preflight rejects an oversized file before `text()`.
- Formula-like, leading-whitespace, control-prefixed, quoted, comma, CR/LF, and
  ordinary CSV cells are covered through the shared serializer boundary and
  all three production sinks.
- Focused tests and all repository minimum checks pass under Node 24.19.0 and
  npm 11.17.0.

## Migration, privacy, rollback, and delivery

No local activity, HRV record, credential, IndexedDB, LocalStorage schema, or
user data is migrated, rewritten, or deleted. Rollback is an ordinary code
revert. Do not merge, release, or deploy without the separately required gate.
