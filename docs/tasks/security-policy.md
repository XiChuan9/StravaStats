# Security Policy and Agent Verification Guidance

## Metadata

| Field | Value |
| --- | --- |
| Status | Approved for implementation; delivery separately gated |
| Base | `codex/public/local-import-core@b819b462551279eb0c29aac7fb90028aa341b309` |
| Feature branch | `codex/security-policy` |
| Data migration | None |
| Runtime behavior change | None |
| Storage/API/dependency change | None |

## Goal

Add one root `SECURITY.md` that gives reviewers durable, product-specific
threat-model, trust-boundary, invariant, finding, severity, exclusion, accepted-
risk, and limitation context. Keep executable build, test, and verification
guidance in root `AGENTS.md`, not in the security policy.

The policy must reflect the Public Local Import Core scope freeze and the final
independent review of that scope: Run Plus/NSM is not current public runtime,
its historical LocalStorage compatibility keys remain non-destructive user data,
and private product/evidence locations never enter the public repository.

## Owner-approved compatibility clarification

The owner approved the following final boundary on 2026-08-19: the six
historical Run Plus/NSM LocalStorage keys and their existing values remain
user-owned and untouched, while current public Backup/Restore does not read,
write, remove, serialize, or recreate them. A legacy backup containing one of
those names may restore its other supported data, but must ignore the retired
entry without publishing its value.

This decision supersedes only the earlier phrase in
`docs/tasks/public-local-import-core-freeze.md` that required those keys to
remain inside the existing Backup/Restore compatibility boundary. It does not
authorize deletion, migration, rewriting, history changes, or restoration of
the retired runtime.

## Allowed paths

```text
AGENTS.md
SECURITY.md
docs/tasks/security-policy.md
```

No runtime, test, fixture, schema, migration, storage, Repository, Import,
Decoder, provider, Service Worker, dependency, lockfile, release, or deployment
path is authorized.

## Frozen decisions

- Accepted ADRs and current product/data boundaries are summarized, not changed.
- No new security control, runtime guarantee, release claim, supported platform,
  disclosure channel, or destructive action is invented.
- Existing owner-approved historical no-rewrite risk is described without
  repeating the exposed value or broadening the acceptance.
- Exclusions do not suppress current-tree privacy regressions, credentials,
  athlete data, destructive data behavior, or unauthorized egress.
- No real activity, route, health, power, account, token, backup, screenshot,
  browser profile, private fixture, developer path, or private repository detail
  enters the diff or verification evidence.

## Acceptance

- Root policy resolution returns exactly the new repository-wide policy and no
  conflicting nested policy.
- `SECURITY.md` covers system scope, assets, attacker-controlled inputs, trust
  boundaries, security invariants, reportable findings, product-specific
  severity, exclusions/accepted risk, limitations/compensating controls, and
  sensitive-report handling.
- `SECURITY.md` contains no executable build, test, verification, release, or
  deployment command.
- `AGENTS.md` records the exact Node/npm baseline, repository-minimum checks,
  conditional dependency audit, focused-test rule, absence of a general bundle
  step, and evidence-reporting limits.
- Repository-minimum and privacy checks from `AGENTS.md` pass, policy resolution
  is re-run for the repository root, and whitespace validation passes.

## Migration, privacy, rollback, and delivery

There is no migration, persisted-data access, runtime behavior, browser action,
external request, release, or deployment impact. Rollback is an ordinary revert
of the three documentation paths and never deletes user data, caches, settings,
branches, tags, or history.

Do not stage, commit, push, open a pull request, merge, release, or deploy unless
the project owner separately authorizes that delivery action.
