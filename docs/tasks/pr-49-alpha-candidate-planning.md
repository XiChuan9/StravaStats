# PR-49: Limited Alpha Candidate Planning

## Metadata

| Field | Value |
| --- | --- |
| Milestone | M36 / G13-ALPHA-CANDIDATE-PLANNING |
| Status | A2 complete; recommended A3 package frozen; owner authorization pending |
| Base branch | `integration/v2` |
| Feature branch | `codex/v2/alpha-candidate-planning` |
| Worktree | `/Users/wangchuanliang/.codex/worktrees/d939/StravaStats` |
| Exact base | `integration/v2@de9b47f3551d08102364f0b0794f487935d167a9` |
| Exact base tree | `4a273bfffe5248ecdb4af7dbe6707c318398c6ac` |
| Owner / release owner | XiChuan9 |
| Authority | A0/A1/A2 planning and audit only; A3 implementation requires later explicit owner authorization |

## Goal

Prepare an exact, bounded candidate-building authorization package for the owner-approved limited
local, non-production `v2.0.0-alpha.1` static Web bundle. This task may verify the baseline, publish
this Task Brief, audit the merged G1 contract and current repository, and freeze one recommended A3
decision package. It does not authorize any candidate implementation or release action.

The authoritative contract is the accepted G1 section of
`docs/engineering/release-gates.md` together with `docs/tasks/pr-48-alpha-contract.md`. The G13
candidate-building phase must precede G12 exact-candidate verification. Tagging, GitHub Release,
artifact delivery/publication, hosting and deployment remain separate later owner approvals.

## Owner-approved stable direction

- Target name: `v2.0.0-alpha.1`.
- Distribution: one owner-provided local static Web bundle only; non-production; no public hosting or
  deployment.
- Support/evidence: current stable macOS Chrome at candidate freeze; synthetic-only; disposable
  browser profile; no real Token, account, provider, private activity/file or user browser profile.
- Payload: exact static source-copy selection/exclusions, acyclic `PROVENANCE.json` plus
  `SHA256SUMS`, exact commit/tree provenance and two-checkout reproducibility.
- Status honesty: real Legacy rescue and real parity/Shadow evidence remain deferred to RC and
  non-`PASS`.
- Safety: preserve Legacy rollback, old data, opaque string IDs, and missing/null/zero semantics.

## A0 exact baseline

Read-only verification before branch creation established:

```text
repository                XiChuan9/StravaStats
integration commit        de9b47f3551d08102364f0b0794f487935d167a9
integration tree          4a273bfffe5248ecdb4af7dbe6707c318398c6ac
integration divergence    local/origin 0/0
worktree                  clean; detached at the exact integration commit
feature branch            absent locally and in the connected GitHub App before creation
PR #60                    closed; squash merged at the exact integration commit
integration CI            run 31583509127 / job 94071851170 SUCCESS
npm ci                    PASS; 6 packages
syntax                    PASS; 283 files
privacy                   PASS
full test                 PASS; 1,924/1,924
npm audit                 PASS; 0 vulnerabilities
git diff --check          PASS
```

The locked unique verification worktree at
`/Users/wangchuanliang/Documents/StravaStats-worktrees/v2` names `integration/v2` at the same exact
commit. `main` and `maintenance/v1` are outside this task and remain unchanged.

## A1 staged authority

The first feature-branch commit creates only this Task Brief. It must be pushed and used to open an
open Draft PR against `integration/v2` before A2 findings are recorded.

The Task-Brief-only first commit is `3dcef4c032fe916e63e9adc4bc105bf862fe1233`. It was pushed and
opened [Draft PR #61](https://github.com/XiChuan9/StravaStats/pull/61) against `integration/v2` before
the A2 audit was recorded.

Until the owner explicitly authorizes A3, the only writable repository path is:

```text
docs/tasks/pr-49-alpha-candidate-planning.md
```

A2 may update this Task Brief with read-only findings and the exact recommended authorization
package. No other repository path may be edited. A third path, an implementation change, or a
generated candidate requires a new explicit owner decision.

## A2 findings-first audit plan

A2 will inspect without mutation:

1. the merged G1 contract and its contract tests;
2. all version-bearing package/runtime/release metadata and their semantics;
3. the tracked static runtime dependency graph and exact G1 payload selection;
4. package/lock/hash/privacy guards, build scripts and CI/workflows;
5. Service Worker registration, cache naming/lifecycle and data/Legacy boundaries;
6. artifact exclusions, ignore rules and existing release documentation/tests; and
7. the minimum failure-first tests, exact-head CI, remote depth-one reproducibility and G12 handoff
   required by a later A3 task.

A2 must freeze one literal cumulative implementation allowlist and one complete decision package,
including version semantics, deterministic tooling, temporary output handling, payload inventory,
metadata schemas, hashing/container rules, browser evidence, rollback and withdrawal. Findings are
reported by severity before the recommendation. A2 stops before any implementation.

## A2 findings-first audit

No P0 was found. The following findings determine the minimum candidate contract.

| ID | Priority | Finding | Required disposition |
| --- | --- | --- | --- |
| A2-1 | P1 | `package.json` and the lockfile root/package entries are `1.0.0`; `private: true` is already correct. `manifest.json`, `CACHE_VERSION`, the Service Worker cache name, storage/backup formats and application-contract literals are independent runtime/schema versions, not package-release metadata. | Change only package/lock release metadata to SemVer `2.0.0-alpha.1`; use `v2.0.0-alpha.1` only for the candidate name, provenance and container. Do not change runtime/schema/cache versions. |
| A2-2 | P1 | There is no candidate build/verify/serve command. `scripts/local-dev-server.mjs` loads `.env`/`.env.local`, executes `/api` handlers and disables Node TLS verification, so it is prohibited for Alpha evidence. | Add one stdlib-only candidate tool with separate build, verify and static-loopback serve subcommands. Never reuse the development server. |
| A2-3 | P1 | CI floats `node-version: 24`, while local A0 ran Node `v25.8.1`. The exact green integration CI actually used Node `v24.19.0` and npm `11.17.0`. Embedding observed tool versions without pinning them would make later builds differ. | Pin Node `24.19.0` and npm `11.17.0` in package metadata, build validation and CI before producing candidate bytes. Add no dependency. |
| A2-4 | P1 | The merged G1 selection currently resolves to 209 tracked regular files, 5,727,628 bytes, with path-list SHA-256 `d1be5319df2bdfefcc9ef153f8f7f11d67305e249f43b62579be6d8b0f3975c0`; no selected symlink exists. The rule includes all client provider/egress modules but excludes server/env/process material. | Build from exact `HEAD` Git blobs, not arbitrary worktree bytes; enforce the G1 rule, regular mode, exclusions, clean tree and manifest completeness at the candidate head. The current count/digest is audit evidence, not a future invariant. |
| A2-5 | P1 | `index.html` loads `styles/gear.css`; its visible Dashboard rule requests missing and untracked `media/bg-dashboard.jpg`. The G1 payload intentionally contains only the three existing sport backgrounds, so the required Dashboard matrix would otherwise issue a loopback 404. | The only permitted product-byte repair is to remove the missing Dashboard image URL from `styles/gear.css` while retaining the existing gradient/background behavior. Do not add or generate an asset and do not change the G1 selection rule. |
| A2-6 | P1 | Loopback suppresses Speed Insights, but provider authorization/sync, Weather, AI and map egress remain dormant client capabilities. Static HTML also contains public canonical/link metadata. | Do not strip or transform client source. The server must reject `/api`; the disposable network record must show zero non-loopback requests and zero `/api`, provider, Weather, AI, map-tile or telemetry requests. Links/metadata are not a public Alpha claim. |
| A2-7 | P1 | With `enable-sw=1` absent, the local policy does not register `sw.js`, but it enumerates owned registrations/cache names and would remove exact owned entries if present. Native worker/cache evidence remains G10. | Use only a fresh empty disposable profile/origin, prohibit `enable-sw=1`, require the observed policy result `disabled` with `registrationsChanged: 0` and `cachesChanged: 0`, and make no Service Worker/cache code change or offline/PWA claim. Never run against a user profile. |
| A2-8 | P1 | Candidate commit/tree and whole-container hashes cannot be committed into the same bytes without changing the candidate or creating a digest cycle. | Finalize and commit all candidate source first; build only from that clean final commit; write manifest/container hashes to an external sibling evidence file and the control-tower/G12 record; make no post-build repository commit. |
| A2-9 | P2 | Vendored Leaflet CSS names three absent optional image files. Current production code reaches its default marker only behind consented Weather/map behavior, which the Alpha matrix prohibits. | Record the dormant limitation and assert those paths are never requested in Alpha. Do not widen the payload or edit vendored code for this candidate. |

## Recommended owner authorization: A3 exact candidate build

This is the single recommended package. Owner approval authorizes only the implementation below and
does not authorize G12, tag, GitHub Release, delivery/publication, hosting, deployment or merge.

### Frozen literal cumulative implementation allowlist

The first planning commit remains Task-Brief-only. If A3 is explicitly authorized, the complete
feature-branch diff from `integration/v2@de9b47f3551d08102364f0b0794f487935d167a9` may contain only:

```text
.github/workflows/ci.yml
CHANGELOG.md
README.md
docs/README.md
docs/engineering/release-gates.md
docs/guides/known-limitations.md
docs/tasks/pr-49-alpha-candidate-planning.md
package-lock.json
package.json
scripts/alpha-candidate.mjs
styles/gear.css
tests/docs/release-docs.test.js
tests/release/alpha-candidate.test.js
```

This is a thirteen-path literal cumulative hard maximum, not a directory glob. A fourteenth path,
new dependency, different product-byte edit, payload-rule change or generated repository file stops
implementation and requires a new owner decision. In particular, `api/`, `vercel.json`,
`manifest.json`, `sw.js`, every other HTML/JS/CSS/runtime path, storage/migration/Legacy code, data,
fixtures and secrets remain prohibited.

### Version and truthful status semantics

- Set `package.json` and both lockfile package-version fields to `2.0.0-alpha.1`; retain
  `private: true`. Add exact `engines.node: 24.19.0` and `packageManager: npm@11.17.0`; the lockfile
  may change only as mechanically required for those root metadata fields. Dependencies,
  devDependencies, resolved URLs and integrity hashes remain byte-for-byte unchanged.
- Generated provenance and filenames use `v2.0.0-alpha.1`; npm SemVer never includes the leading
  `v`. `manifest.json` gains no version. Cache, Service Worker, storage schema, Backup, diagnostics
  and internal application-version literals are not release versions and remain unchanged.
- Update current public release documentation to say an unverified local candidate-building head
  exists, while no tag, GitHub Release, publication, hosting, deployment or public Alpha exists.
  After a successful A3 build, G13 becomes `PARTIAL`, never `PASS`; G12 remains `NOT RUN` until its
  separate exact-head task. G2/G5/G6 remain `NOT RUN`, G3/G8 remain `PARTIAL`, and G7/G9/G10 remain
  `BLOCKED`.

### Deterministic tool and output boundary

Add no production or development dependency. `scripts/alpha-candidate.mjs` is one Node-stdlib ESM
tool exporting testable functions and these package commands:

```text
npm run build:alpha-candidate  -- --output-parent <absolute-empty-directory>
npm run verify:alpha-candidate -- --bundle-root <absolute-extracted-root> --container <absolute-zip>
npm run serve:alpha-candidate  -- --bundle-root <absolute-extracted-root> [--port 0]
```

Build must fail closed unless Node is exactly `v24.19.0`, npm is exactly `11.17.0`, `HEAD` is a
commit on the authorized branch, the worktree/index are clean, package/lock versions match, and the
output parent is an absolute existing empty directory whose resolved path is outside the repository.
It reads the exact commit/tree/time and selected payload bytes through Git plumbing from `HEAD`, not
from untracked or modified worktree files. It rejects selected non-`100644` modes, symlinks, unsafe
paths, duplicates, excluded prefixes/extensions and any mismatch with the G1 rule.

The tool creates output atomically under the provided external parent and never writes `dist/`, the
repository, a user data directory or an existing candidate directory. The exact successful output is:

```text
stravastats-v2.0.0-alpha.1/                  extracted bundle root for verification/serving
stravastats-v2.0.0-alpha.1.zip               delivered container
stravastats-v2.0.0-alpha.1.evidence.json     external, non-delivered digest record
```

Only the `.zip` is the eventual deliverable. The extracted root and evidence JSON stay outside Git
for A3/G12. Build failure may remove only a uniquely named staging directory created by that process;
it must not remove or overwrite an existing target.

### Exact payload, provenance and manifest

The payload selector is the merged G1 rule verbatim. It selects tracked `100644` blobs at the exact
candidate commit: the thirteen named exact files and recursively `html/**/*.html`, `js/**/*.js` and
`styles/**/*.css`, with `js/vendor/THIRD_PARTY_NOTICES.md` included exactly once. It excludes all
other paths, including `api/`, `docs/`, `tests/`, `scripts/`, `.github/`, package/lock files,
`vercel.json`, `.env*`, `AGENTS.md`, Git metadata, private/local data, fixtures, logs, maps/source
maps and earlier output. The Dashboard CSS repair changes one selected blob but does not widen the
selector.

`PROVENANCE.json` is compact UTF-8 JSON followed by one LF, with exactly these keys in this order:

```text
version
commit
tree
sourceRepository
buildCommand
nodeVersion
npmVersion
sourceDateEpoch
payloadSelectionRuleVersion
```

Their exact fixed/string semantics are:

```text
version                     v2.0.0-alpha.1
commit                      40 lowercase hexadecimal exact HEAD
tree                        40 lowercase hexadecimal exact HEAD tree
sourceRepository            https://github.com/XiChuan9/StravaStats.git
buildCommand                 npm run build:alpha-candidate
nodeVersion                 v24.19.0
npmVersion                  11.17.0
sourceDateEpoch             integer exact commit timestamp in seconds
payloadSelectionRuleVersion g1-alpha-static-v1
```

No additional key, absolute/environmental path, manifest digest or container digest is allowed.
`SHA256SUMS` contains the SHA-256 of every selected payload blob and `PROVENANCE.json`, but not
itself: one LF-only row per file, bytewise POSIX-path order, 64 lowercase hex characters, two ASCII
spaces, safe relative path, and one terminal LF. Verification recomputes every hash and rejects a
missing, duplicate or extra bundle file. At the expected 209-file selector shape, the manifest has
210 rows and the extracted root has 211 files; the candidate build must derive rather than hard-code
those counts.

### Container and external evidence

The container is a deterministic ZIP32 archive named `stravastats-v2.0.0-alpha.1.zip`. It contains
one root prefix `stravastats-v2.0.0-alpha.1/`, no explicit directory entries, and exactly the 211
bundle files beneath it in bytewise relative-path order. Every entry is stored without compression
(method 0), UTF-8 flagged, mode `100644`, has fixed DOS timestamp `1980-01-01 00:00:00`, no data
descriptor, extra field, comment, encryption, ZIP64, absolute/traversal/backslash/control path or
host-dependent attribute. CRC-32, sizes and offsets are recomputed and verified.

The sibling evidence file is compact UTF-8 JSON plus one LF with exactly these ordered keys:

```text
version
commit
tree
manifestFile
manifestSha256
containerFile
containerSha256
```

`manifestFile` is `stravastats-v2.0.0-alpha.1/SHA256SUMS`; `containerFile` is the exact ZIP filename;
both digests are 64 lowercase hex characters over the complete named file bytes. The evidence file
is never inside or hashed by the bundle/container. A3 reports it privately to the control tower;
G12 independently recomputes it.

### Static loopback and disposable-browser matrix

The `serve` subcommand first performs the exact manifest/no-extra-file verification, then binds only
`127.0.0.1` (port `0` by default), serves only manifest-listed files, supports GET/HEAD, uses fixed
MIME and `Cache-Control: no-store`, disables directory listing and rejects traversal, dotfiles,
unknown files, non-loopback Host values and every `/api` request. It never loads env files, imports
`api/`, enables TLS exceptions, opens a browser, reads a profile or makes outbound requests. Known
SPA routes map to `index.html`; exact `.html` paths remain directly served.

G12, not A3, owns the final current-stable-macOS-Chrome record. It must use three newly created
disposable profiles with extensions, sync and saved credentials absent:

1. profile A: first-run, Demo, Dashboard/Run/Ride/Swim summaries, one detail route, synthetic
   FIT/TCX/GPX/CSV/ZIP imports, duplicate handling, explicit Retry and format-3 Backup;
2. profile B: validate and Restore that synthetic Backup into a second fresh empty profile; and
3. profile C: synthetic Legacy startup plus explicit feature-flag rollback, with no Legacy/V2 clear.

Record exact Chrome full version, macOS version and architecture. For every profile, omit
`enable-sw=1`; require Service Worker policy `disabled` with zero changed registrations/caches;
record every request and require loopback-only hosts, zero `/api`, Strava, Weather, AI, map-tile,
telemetry or other external request, and zero real Token, credential, account identifier, private
file/activity or identifiable athlete data. The absent Leaflet images must not be requested. Any
failure stops the candidate; it cannot be repaired by clearing data or weakening the matrix.

### Failure-first tests, CI and G12 handoff

- Before implementation, add focused built-in `node:test` assertions and record their expected
  failure against the unmodified A2 head. Tests use temp directories and synthetic bytes only; no
  network, credentials, private fixture or browser profile.
- Tests freeze the thirteen-path allowlist; package/lock/toolchain/dependency invariants; exact
  selector/exclusions/modes; Dashboard missing-asset repair; provenance/manifest/evidence schemas;
  ZIP profile and corruption failures; output refusal/atomicity; two same-checkout byte-identical
  builds; static-server loopback/no-API/no-listing/traversal behavior; and protected SW/cache/data/
  Legacy/runtime boundaries.
- Pin CI checkout to the exact PR head with depth one and Node `24.19.0`; assert npm `11.17.0`;
  run install, syntax, privacy, full tests, audit, diff, a temp candidate build/verify and a second
  temp build comparison. Do not upload a workflow artifact.
- After the final candidate commit is pushed, make no further repository commit. A3 may build the
  local external candidate and must report exact commit/tree plus the external evidence JSON and
  exact-head CI status. It then stops and hands the immutable head to separately authorized G12.
- G12 uses two fresh true remote depth-one checkouts of that exact commit, identical pinned tooling
  and clean environments; runs focused/syntax/privacy/full/audit/diff/path/payload/manifest/container
  gates; builds twice and compares payload, provenance, manifest, evidence and whole ZIP bytes; checks
  zero unresolved P0/P1; verifies exact-head CI; then runs the disposable browser matrix. G12 remains
  non-`PASS` unless every item passes.

### Rollback and withdrawal

Candidate-code rollback is an ordinary revert of only the thirteen authorized paths and removal of
only external temporary candidate files. It never invokes Disconnect/Delete Local Data, changes a
feature-flag default, edits Service Worker/cache names, clears Cache Storage/settings/IndexedDB, or
reads, rewrites, migrates or deletes Legacy/V2 records. Opaque string IDs and missing/null/zero
semantics are untouched.

If a later verified candidate is withdrawn, XiChuan9 stops sharing the exact ZIP, marks its external
container SHA-256 withdrawn and may replace it only with another separately verified object. The
evaluator closes the loopback server and may remove only their downloaded artifact and disposable
profiles. No tag, Release, deployment or public history exists to delete under A3.

## Hard boundaries

- No version bump, package/lock edit, build-script implementation, candidate generation,
  `PROVENANCE.json`, `SHA256SUMS`, archive or other artifact in this task.
- No tag, GitHub Release, publication, hosting, deployment or public Alpha claim.
- No workflow, product runtime, Service Worker lifecycle, cache, settings, IndexedDB, Legacy or V2
  data action.
- No real Token, account, provider, private activity/file, identifiable athlete data or user browser
  profile.
- No mutation of `main`, `maintenance/v1` or `integration/v2`; no merge, cleanup, rebase, amend,
  force-push or history rewrite.
- No weakening of payload exclusions, synthetic-only evidence, Legacy rollback, old-data
  preservation, opaque string IDs or missing/null/zero semantics.

## Completion and handoff

Completion of this planning task means:

1. this Task-Brief-only first commit remains identifiable in Draft PR history;
2. the Draft PR remains open against `integration/v2`;
3. A2 findings and one recommended exact A3 authorization package are recorded here and reported to
   the control tower;
4. all repository changes remain limited to this Task Brief; and
5. work stops before any candidate implementation or release/publication action.

The later owner decision may authorize, reject or revise A3. Even an authorized candidate build does
not authorize G12 to pass, a tag, GitHub Release, delivery, hosting or deployment.
