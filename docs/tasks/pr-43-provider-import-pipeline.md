# PR-43: Provider to ImportedActivityBundle to ImportService Contract

## Metadata

| Field | Value |
| --- | --- |
| Milestone | M26 / C3 provider ingestion decision |
| Status | A0/A1 Task Brief frozen; C3 implementation prohibited |
| Base branch | `integration/v2` |
| Exact base | `integration/v2@92a735fb4d4809173c5fddf868416bf44642faed` |
| Exact base tree | `568cf2457f418130ec0a6641478eb45a60e676c1` |
| Feature branch | `codex/v2/provider-import-pipeline` |
| Worktree | `/Users/wangchuanliang/.codex/worktrees/pr43/StravaStats` |
| Completed prerequisites | C1 / PR #47 and C2 / PR #48 merged |
| Parent decision | PR-40 / D-A A2 / D-B C, staged C1-C4 |
| Control tower | `019fa697-6cbf-70f1-a120-bf31ecc9e2ba` |

## Goal

Produce a findings-first, materially complete owner decision package for C3: the bounded path from an
authorized provider read through deterministic normalization into `ImportedActivityBundle` and the
existing `ImportService`. The package must freeze identity binding, provenance, pagination, retry,
cancellation, quota, deduplication, recovery, privacy, browser evidence, and rollback before any C3
production or test implementation begins.

This first commit creates only this Task Brief. A2 is read-only except for a later update to this same
file. No provider call, OAuth/account use, Token access, private evidence, schema/public API change, or
C3 implementation is authorized.

## Authority and current limit

The authoritative post-C2 handoff permits only C3 planning from the exact merged baseline:

> Proceed only to C3 planning from this exact baseline: create separate Task-Brief-first Draft
> PR/worktree for provider → ImportedActivityBundle → ImportService; A0/A1 then A2 read-only except
> Task Brief.

Authorized now:

- create this isolated branch/worktree from the exact integration head;
- publish a Task-Brief-only first commit and open Draft PR targeting `integration/v2`;
- inspect current code, tests, accepted contracts, PRD/release gates, and call graphs read-only; and
- update only this Task Brief with findings, mutually exclusive owner decisions, literal candidate
  allowlists, failure-first tests, browser/private-evidence boundaries, migration/privacy/rollback
  impact, and collision risks.

Not authorized:

- any production or test implementation outside this Task Brief;
- live Connect, OAuth configuration/callback/exchange/revoke, Token/status reads or writes, real
  account/provider activity, private fixtures/evidence, or user browser/profile access;
- schema/V6, public Storage/Repository/Import API, dependency, Worker, Service Worker, server API,
  deployment, release, Ready, merge, or cleanup changes; or
- C4 ownership, heartbeat, lease, crash recovery, multi-tab takeover, or durable scheduling.

## Global invariants

- Preserve every Legacy and V2/V5 record. C3 must not delete, clear, overwrite, downgrade, or repair
  an existing library as an ingestion shortcut.
- Provider authorization, connection identity, imported provenance, local activity ownership,
  disconnect, and delete-local-data remain separate contracts.
- C3 must consume C1/C2 boundaries rather than infer authorization from Token presence or construct
  source identity from `ActivitySource` rows.
- Provider bytes must cross a narrow, validated, redacted boundary before normalization. No Token,
  authorization header, provider response/error body, precise private payload, or raw route may enter
  logs, DOM, diagnostics, fixtures, Git, CI, or public errors.
- `ImportedActivityBundle` remains the only accepted Canonical write envelope. ImportService owns
  durable job/item outcomes, cancellation, retry, quota handling, dedup/linking, and provenance unless
  an owner decision explicitly freezes a narrower internal seam.
- Demo, Legacy, Shadow, local file/ZIP imports, provider ingestion, Backup, and future C4 ownership
  remain isolated.

## Required A2 audit

Read exact current code, tests, and durable docs for:

1. Source Manager C1 controller/bootstrap/mode isolation and C2 `SourceConnection` public state.
2. Root auth, `Token`, provider connector, refresh/retry/error/pagination behavior, scopes, same-origin
   server boundaries, subject/account binding, and disconnect semantics.
3. Provider activity/stream/lap/event/device payload handling, normalization, validation, redaction,
   opaque identity, capability degradation, and `ImportedActivityBundle` construction.
4. ImportService/ImportStore/Worker contracts: job/item states, retry, cancellation, quotas,
   atomicity, raw artifacts, exact-identity linking, duplicates, reports, and reload recovery.
5. Repository/Storage/Backup/Diagnostics/Service Worker/browser/network/privacy boundaries and all
   public/schema/dependency collision surfaces.
6. PRD P0, accepted ADRs, engineering plans, release gates, Alpha/full-v2.0 distinctions, and the
   remaining C4 ownership gap.

Findings must precede recommendations. Historical summaries are context, not evidence.

## Required owner decisions

The A2 package must keep material choices separable and mutually exclusive. At minimum it must freeze:

- **D-C3.1 authorization and identity binding:** whether C3 uses a deterministic synthetic seam only,
  an existing Token-backed connector, or a new authorized controller/server boundary; required scopes,
  account/subject equality, reconnect/error handling, disconnect interaction, and what needs real
  private evidence.
- **D-C3.2 provider read and normalization boundary:** pagination/windowing, activity/detail/stream
  acquisition, raw-versus-reduced payload retention, deterministic `ImportedActivityBundle` mapping,
  capability degradation, unknown/future fields, redaction, and provider error mapping.
- **D-C3.3 ImportService integration:** whether provider pages enter the existing file-style job seam,
  a new internal bundle-input seam, or a separately gated public API; job/item provenance, cancellation,
  retry/resume, quota, atomicity, dedup/linking, reporting, and reload behavior.
- **D-C3.4 delivery boundary:** one combined tranche or separately approved controller, provider mapper,
  and Import integration tranches, each with a collision-audited literal path hard maximum.

Every option must identify exact UI semantics, authorization/token/storage/network behavior, data
preservation, errors, cancellation, resume, privacy, rollback, failure-first tests, browser evidence,
architecture/collision risk, and any real-account/private evidence gate. No option may infer authority
for credentials, provider calls, schema/public API/dependency expansion, or C4 behavior.

## A1 publication contract

The first commit changes exactly:

```text
docs/tasks/pr-43-provider-import-pipeline.md
```

Draft PR title:

```text
feat(v2): define provider import pipeline contract
```

Draft PR body:

```markdown
## What changed

Adds the C3 Task Brief for the provider-to-ImportedActivityBundle-to-ImportService material decision package.

## Why

C1 and C2 are merged, but provider authorization/identity binding, deterministic normalization, ImportService ingestion, recovery, and private-evidence boundaries remain separately gated.

## Impact

Docs only. No C3 implementation, live Connect, OAuth, Token/account/provider/private data, schema/public API, dependency, Worker, Service Worker, deployment, or release change.

## Checks

- exact-base and one-path diff audit
- `npm ci`
- `npm run check:syntax`
- `npm run check:privacy`
- `npm test`
- `git diff --check`
```

No reviewer, label, assignment, Ready transition, merge, cleanup, deployment, or release is part of A1.

## A1 and A2 verification

```bash
npm ci
npm run check:syntax
npm run check:privacy
npm test
git diff --check
```

After A2, push normally, verify the true remote depth-1 exact head, confirm exact-head CI, and keep the
PR OPEN/Draft. Return the complete decision package directly to control tower without implementation.

