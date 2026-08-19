# Security Provider Boundaries

## Metadata

| Field | Value |
| --- | --- |
| Status | Approved for implementation; delivery separately gated |
| Base | `codex/public/local-import-core@63af575c4fc6c4dacbc07f647afa8d204daa0501` |
| Feature branch | `codex/security-provider-boundaries` |
| Data migration | None |
| Dependency or lockfile change | None |

## Goal

Close the validated OAuth login-confusion, provider-scope, unbounded Legacy API,
and pre-allocation external-response findings without changing storage schema,
Canonical data, import formats, pages, release, or deployment state.

## Allowed paths

```text
docs/tasks/security-provider-boundaries.md
api/_provider-boundary.js
api/_shared.js
api/strava-auth.js
api/strava-activities.js
api/strava-activity.js
api/strava-athlete.js
api/strava-gear.js
api/strava-streams.js
api/strava-zones.js
js/app/ai-coach-egress.js
js/app/auth.js
js/app/source-manager-authorization.js
js/app/weather-consent.js
js/connectors/strava/strava-api-connector.js
js/shared/bounded-response.js
tests/legacy/demo-isolation.test.js
tests/privacy/ai-egress.test.js
tests/privacy/server-api-logging.test.js
tests/privacy/weather-egress.test.js
tests/repository/legacy-api-parity.test.js
tests/repository/dependency-boundaries.test.js
tests/repository/strava-api-connector.test.js
tests/server/provider-boundaries.test.js
tests/source-manager/source-manager-authorization.test.js
```

No DOM renderer, import/export, backup/restore, analysis, storage, schema,
migration, dependency, lockfile, release, deployment, or user-data path is
authorized.

## Frozen decisions

- Legacy OAuth uses the same 256-bit, single-use, ten-minute state-capsule
  implementation as Source Manager. Missing, mismatched, replayed, expired, or
  scope-expanded callbacks perform zero provider exchange and zero Token write.
- Demo mode ignores OAuth callback parameters and performs zero real provider
  work. Both Legacy and Source Manager request and accept exactly `read` plus
  `activity:read_all`; code-only exchange requests are invalid.
- Legacy activities are fetched through exact GET pages of 25 records. Each
  provider and browser page is capped at 2 MiB and 12 seconds; one browser sync
  is capped at 10,000 records and 32 MiB.
- Legacy streams accept only the existing fixed stream-key allowlist, exact
  query fields, 200,000 points per stream, 16 MiB, and 12 seconds.
- Every Legacy provider request rejects redirects, retains `no-store`, validates
  exact query grammar, and byte-bounds the upstream body before UTF-8 decoding
  or JSON parsing. Activity pages use 2 MiB; athlete, gear, and zones use 1 MiB.
- OAuth, Weather, and AI responses are streamed before allocation with their
  existing 64 KiB, 1 MiB, and 128 KiB limits.
- Invalid local requests return 400/405/413; malformed, redirected, or oversized
  upstream responses return 502; upstream timeouts return 504.

## Acceptance

- OAuth state missing, mismatch, replay, expiry, and scope expansion have zero
  exchange and Token writes; a valid callback remains single-use and Demo
  callback parameters remain inert.
- Chunked, false Content-Length, redirect, timeout, extra-query, page, response,
  record, stream-key, point, and aggregate-byte boundaries have exact tests.
- Normal 25-record pages, supported stream keys, valid Token refresh, Weather,
  and AI responses remain functional.
- Focused provider tests and all repository minimum checks pass under Node
  24.19.0 and npm 11.17.0.

## Migration, privacy, rollback, and delivery

No local activity, credential, cache, IndexedDB, LocalStorage schema, or user
data is migrated or deleted. Rollback is an ordinary code revert. Do not merge,
release, or deploy without the separately required delivery gate.
