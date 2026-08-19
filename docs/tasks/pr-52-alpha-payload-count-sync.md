# PR-52: Alpha Payload Count Sync

## Metadata

| Field | Value |
| --- | --- |
| Status | Complete |
| Base checkpoint | `ae5588e` |
| Feature branch | `codex/v2-alpha-payload-count-sync` |
| Data or schema change | None |

## Goal

Synchronize the Alpha G1 point-in-time selector assertion with the committed
payload tree. The accepted selector rule itself is unchanged. The Analysis
Profile checkpoint added two selected regular client modules, increasing the
exact `HEAD` selection from 209 to 211, while the release test retained the old
count.

## Allowed paths

```text
docs/tasks/pr-52-alpha-payload-count-sync.md
tests/release/alpha-candidate.test.js
```

No production code, selector rule, archive format, branch authority, runtime
pin, release status, or deployment surface may change.

## Acceptance

- The selector still starts at `classifyBike.js`, ends at `sw.js`, includes
  only regular blobs, and excludes server/API and package metadata.
- The expected point-in-time count is 211 for exact base `ae5588e`.
- Focused release tests and the full repository suite pass, subject to the
  separately reported local Node/npm engine mismatch.

## Privacy and rollback

No activity, health, route, Token, settings, browser, or private fixture data is
read or written. Rollback is a test-only revert.

## Verification

- `npm ci`: pass with the separately documented Node/npm engine warning.
- Focused Alpha release tests: 12/12 pass.
- Syntax: 293 files; privacy: pass; full repository tests: 2,011/2,011 pass.
- `git diff --check`: pass.
