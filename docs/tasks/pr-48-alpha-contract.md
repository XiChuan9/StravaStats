# PR-48: Limited Non-Production V2 Alpha Contract

## Metadata

| Field | Value |
| --- | --- |
| Milestone | M35 / G1 ALPHA-CONTRACT |
| Status | Task Brief published; findings-first audit pending |
| Base branch | `integration/v2` |
| Feature branch | `codex/v2/alpha-contract` |
| Worktree | `/Users/wangchuanliang/.codex/worktrees/3282/StravaStats` |
| Exact base | `integration/v2@4375d699fb1fc1142d399c158b9ad0c4e7e730dc` |
| Exact base tree | `b076c4f80cd1d6de7719cebe26e327d18a1f4734` |
| Owner / release owner | XiChuan9 |
| Authority | Documentation and exact documentation-contract tests only |
| Pull request | Draft PR against `integration/v2` to be recorded after publication |

## Goal

Publish the owner-approved acceptance contract for a limited local, non-production
`v2.0.0-alpha.1` static Web bundle. The contract must make the eventual Alpha candidate precisely
verifiable without creating that candidate, changing the package version, building or publishing an
artifact, tagging a commit, creating a GitHub Release, deploying a site, changing a Service Worker,
or accessing any real account or private athlete data.

The durable authority remains the Accepted single roadmap in
`docs/engineering/release-gates.md`. The historical M34 Task Brief at
`docs/tasks/pr-47-final-v2-release-roadmap.md` records the owner decisions from which this bounded G1
contract is derived; it is not rewritten by M35.

## Owner-approved direction

- The target name is `v2.0.0-alpha.1`.
- Distribution is an owner-provided local static Web bundle only. It is non-production and is not
  publicly hosted.
- The supported Alpha surface is current macOS Chrome only; every other browser, operating system,
  mobile/PWA surface, and assistive-technology support claim remains unsupported for Alpha.
- Alpha evidence is synthetic-only. Real Legacy rescue and real parity/Shadow sign-off are deferred
  to RC, not waived and never promoted to `PASS` by this task.
- XiChuan9 is the release owner. The eventual artifact type is a static Web bundle with a SHA-256
  manifest.
- The release sequence is Alpha → Beta → RC → `v2.0.0`.
- G13 still owns every actual version/package change, candidate build, artifact, manifest, tag,
  GitHub Release, publication and deployment action under separate authorization. G12 can verify
  only a later exact G13 candidate head and artifact.
- The M34 dispositions for R3 no-rewrite, the time-bounded performance waiver, the complete browser
  matrix, the private-evidence protocol and the future staging plan remain frozen and are not
  reconsidered here.

## A0 exact baseline

Read-only verification before branch creation established:

```text
integration commit      4375d699fb1fc1142d399c158b9ad0c4e7e730dc
integration tree        b076c4f80cd1d6de7719cebe26e327d18a1f4734
integration divergence  local/origin 0/0; remote ls-remote exact
feature branch           absent locally and remotely before creation
worktree                 clean; detached at the exact integration commit
integration CI           run 31578877301 / job 94057153726 SUCCESS
npm ci                   PASS; 6 packages
syntax                   PASS; 283 files
privacy                  PASS
full test                PASS outside the loopback-restricted sandbox; 1,919/1,919
npm audit                PASS; 0 vulnerabilities
diff                     PASS
```

The first sandboxed full run passed 1,917 tests and failed only the two tests that require binding
`127.0.0.1`, both with `listen EPERM`. The authorized unsandboxed rerun passed 1,919/1,919. The
sandboxed advisory query could not resolve the npm registry; the authorized network rerun reported
zero vulnerabilities. Neither failure was classified as a repository defect.

`main` and `maintenance/v1` are outside this task and remain unchanged.

## A1 publication and staged authority

This first feature-branch commit creates only this Task Brief. It must be pushed and used to open an
open Draft PR against `integration/v2` before the findings-first audit is recorded or any other path
is edited.

Until A2 freezes one literal cumulative allowlist, the only writable path is:

```text
docs/tasks/pr-48-alpha-contract.md
```

A2 is read-only outside updates to this Task Brief. It must inspect the PRD, Accepted release gates,
M34 roadmap Task Brief, current package and lock metadata, served entry/static assets, Service Worker
and static runtime, and every existing build/deploy script or workflow. The audit must report
findings before proposed copy, identify the minimum documentation/test surfaces, and prove that no
product/package/workflow/Service Worker/deployment path is required.

If a material choice remains or any prohibited path is necessary, stop with a minimum owner decision
package. Otherwise A2 may freeze one exact docs/test-only allowlist, define failure-first assertions,
and authorize implementation only inside that list.

## Required Alpha acceptance contract

The final documentation and contract tests must bind all of the following without creating an
artifact or making a release claim:

1. local owner-provided distribution only; no public hosting or deployment;
2. an objective policy for “current macOS Chrome” and an explicit unsupported-platform list;
3. synthetic-only evidence and prohibited real/private claims;
4. deterministic repository gates and a disposable-browser matrix for a later candidate head;
5. exact bundle contents and exclusions, SHA-256 manifest format, provenance and reproducible-build
   expectations;
6. no Token, provider credential, private activity or user data bundled or accessed;
7. non-production withdrawal/rollback that removes or replaces only the distributed artifact and
   never clears Legacy, V2, Cache Storage or settings;
8. G2/G3 deferred to RC and every other remaining G2/G3/G5-G13 row retaining its honest non-`PASS`
   state as applicable; and
9. actual version, artifact, tag, GitHub Release, publication and deployment remaining separately
   authorized G13 work, with G12 performed only on the later exact candidate.

## Hard boundaries

- No real Token, account, provider, private activity/file, user browser profile or identifiable
  athlete evidence.
- No package or lockfile change, version bump, artifact build/publication, tag, GitHub Release,
  deployment, workflow, Service Worker, cache or data action.
- No public Alpha, broader support or production claim.
- No merge, cleanup, history rewrite or mutation of `main`, `maintenance/v1` or `integration/v2`.
- Preserve the Legacy startup and rollback path, old data, opaque string IDs and missing/null/zero
  semantics.

## Verification and Closure plan

Implementation must begin with failing focused documentation-contract tests. After repair, run the
focused test, syntax, privacy, full 1,919+ suite, npm audit, diff check, and a literal changed-path
gate against the frozen allowlist. An independent findings-first review must report no actionable
findings after any repairs. Closure then updates only this Task Brief with exact commits, changed
paths, gates, review results, migration/privacy/rollback impact and explicit unrun environmental
evidence.

The Task-Brief-only Closure commit must be pushed, verified from a true remote depth-one checkout,
and receive successful exact-head CI before the Draft PR may be marked Ready. Ready is review state
only. It is not merge, version, artifact, tag, release, publication, deployment, or cleanup
authority.
