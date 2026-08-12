# PR-48: Limited Non-Production V2 Alpha Contract

## Metadata

| Field | Value |
| --- | --- |
| Milestone | M35 / G1 ALPHA-CONTRACT |
| Status | A2 findings and literal allowlist frozen; failure-first implementation authorized |
| Base branch | `integration/v2` |
| Feature branch | `codex/v2/alpha-contract` |
| Worktree | `/Users/wangchuanliang/.codex/worktrees/3282/StravaStats` |
| Exact base | `integration/v2@4375d699fb1fc1142d399c158b9ad0c4e7e730dc` |
| Exact base tree | `b076c4f80cd1d6de7719cebe26e327d18a1f4734` |
| Owner / release owner | XiChuan9 |
| Authority | Documentation and exact documentation-contract tests only |
| Pull request | [Draft PR #60](https://github.com/XiChuan9/StravaStats/pull/60) |

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

The first commit is `239c1ea89350ef2f5c3da135aef15bd2dce62c28`. It changed exactly this new
Task Brief, was pushed to the unused feature branch, and opened Draft PR #60 with exact base
`4375d699fb1fc1142d399c158b9ad0c4e7e730dc` and exact head `239c1ea...`.

## A2 findings-first audit

The read-only audit inspected the product PRD, Accepted release gates, M34 roadmap Task Brief,
package and lock metadata, all HTML entry roots, the static JavaScript/CSS/media footprint,
`manifest.json`, `sw.js`, the runtime Service Worker policy, `vercel.json`, the only GitHub Actions
workflow and every script in `scripts/`. It read no private fixture, Token, account, provider or user
browser profile and performed no Service Worker, cache, deployment or data action.

### Findings

| ID | Priority | Finding | Contract consequence |
| --- | --- | --- | --- |
| A2-1 | P1 | The PRD's formal support matrix is Chrome/Safari/Firefox across macOS/Windows plus iOS Safari/PWA basics. The Accepted roadmap narrows only the limited Alpha to current macOS Chrome. | Define “current” objectively and list every excluded platform; keep G9 `BLOCKED` for RC/production. |
| A2-2 | P1 | The roadmap freezes the Alpha route, owner, synthetic-only boundary and static-bundle/SHA-256 direction, but it does not yet define the browser version rule, payload selection, manifest grammar, reproducibility or withdrawal procedure. | Add one bounded G1 contract to the authoritative release gates without changing any remaining gate row. |
| A2-3 | P1 | `package.json` and the lockfile are still private package `1.0.0`; there is no build/bundle/release script and CI runs only install, syntax, privacy and tests. | M35 changes none of them. A future authorized G13 candidate task must add the version/build machinery; G12 then verifies its exact output. |
| A2-4 | P1 | `scripts/local-dev-server.mjs` loads `.env`/`.env.local` and exposes serverless `/api` handlers. `vercel.json` is a deployment rewrite map. Neither is a static-only Alpha host. | Exclude `api/`, `scripts/`, `vercel.json`, env files and deployment configuration. Browser evidence must use a no-env, no-API, loopback-only static server. |
| A2-5 | P1 | The client graph contains provider authorization/sync code and separately consented Weather, AI and map destinations, although secrets live only in excluded server/environment surfaces. | Client code may be present as inert runtime code, but Alpha evidence must record zero `/api`, Strava, Weather, AI, map, telemetry or other non-loopback requests and must never create/read a real Token or private record. |
| A2-6 | P1 | The current local-host policy registers `sw.js` only with `?enable-sw=1`; otherwise it disables the owned worker and performs exact-name local static-cache cleanup. Native worker/deployment rehearsal remains G10. | The Alpha matrix must omit `enable-sw=1`, use a fresh disposable origin/profile, make no offline/PWA/worker claim and leave G10 `BLOCKED`. Withdrawal is an out-of-band artifact operation, not an in-app cache/data action. |
| A2-7 | P2 | At the exact base, the collision-audited static payload rule selects 209 regular tracked files (5,727,628 bytes) and excludes repository/process material. The sorted path inventory digest is `d1be5319df2bdfefcc9ef153f8f7f11d67305e249f43b62579be6d8b0f3975c0`. | Freeze the selection rule, not the point-in-time count/digest, so the future exact candidate manifest truthfully binds its then-current payload. Require no symlinks, generated secrets or unmanifested files. |
| A2-8 | P2 | Root HTML contains canonical/public-site metadata, but M35 authorizes no host, deployment or public indexing and the artifact is owner-provided on loopback only. | No product edit is needed; the contract prohibits treating the local bundle or its metadata as a public Alpha claim. |

No P0 finding, unresolved material choice, package/workflow need or production-path need was found.
The owner-approved direction determines all material release-policy questions; the remaining details
above are mechanical acceptance criteria.

### Frozen literal cumulative allowlist

From this point through review and Closure, exactly these paths may change:

```text
docs/tasks/pr-48-alpha-contract.md
docs/engineering/release-gates.md
tests/docs/release-docs.test.js
```

This is a three-path literal cumulative hard maximum, not a directory glob. The first commit remains
Task-Brief-only. Every other path—including `package.json`, `package-lock.json`, `.github/`, `api/`,
`scripts/`, `vercel.json`, all HTML/JS/CSS/product runtime, `sw.js`, manifests, deployment files and
data/cache/settings surfaces—is prohibited. A fourth path or a requirement to change any prohibited
surface requires a new owner decision and an immediate stop.

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
