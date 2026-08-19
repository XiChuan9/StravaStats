# PR-28: Tracked Athlete Identity Removal and Opaque String-ID Guard

## Metadata

| Field | Value |
| --- | --- |
| Milestone | V2 release hardening / R3 |
| Status | Closure complete; Ready-for-review handoff pending exact Closure-head CI |
| Base branch | `integration/v2` |
| Feature branch | `codex/v2/identity-redaction` |
| Exact base | `integration/v2@e760946583f163085b0a8bac887b66fc5c9cec3d` |
| Worktree | `<worktree-root>/<task-name>` |
| Owner | Codex |
| Reviewer | Independent findings-first reviewer required |
| Dependencies | R1 PR #32 and R2 PR #33 Squash Merged; exact-base integration push CI successful |
| Pull request | Draft PR #34; Ready transition and merge are not authorized |
| Control tower | `019fa697-6cbf-70f1-a120-bf31ecc9e2ba` |

## Goal

Remove tracked current-tree athlete identity constants and implicit athlete-specific behavior, and
enforce the existing contract that athlete, activity, provider, and external IDs are non-empty
opaque strings. Preserve Demo isolation, Real behavior without a built-in athlete fallback,
Canonical/Legacy boundaries, storage and Repository contracts, analysis algorithms, and
non-destructive rollback.

## Why now

The release-readiness audit classified tracked athlete identity and numeric profile-ID coercion as
a production release blocker. R1 and R2 have closed the ordered DOM hardening packages and are
Squash Merged into the exact base. Current-tree removal and regression guards can be implemented
without accessing a real account or private data. Public Git-history remediation and incident
handling are separate owner decisions and are not authorized by this task.

## A0 exact-base evidence

- The worktree began detached and clean at the exact base.
- `HEAD`, local `integration/v2`, and `origin/integration/v2` were identical with divergence `0/0`.
- GitHub Actions integration push run `31234234122`, job `93043741381`, used the exact base and
  completed successfully, including install, syntax, privacy, and full tests.
- Untouched `npm ci`, syntax, privacy, full tests, and diff check passed locally. Syntax covered 239
  files and the full suite passed 1476/1476.
- PR #33 was Squash Merged at the exact base; PR #32 was already Squash Merged in its ancestry.
- No real Token, Authorization value, provider response, account, profile, activity, route, GPS,
  heart-rate, power, export, screenshot, private fixture, Legacy library, or V2 library was read.

## Authority and evidence hierarchy

Conflicts resolve in this order: Accepted ADR-0001 through ADR-0006, the product PRD, engineering
plan and release gates, this Task Brief, then implementation details. Historical discussion is
context only. The historical release-readiness audit is authoritative for its R3 finding and
candidate boundary, but the exact current base must be independently re-audited before the
implementation allowlist is frozen.

## A1 publication boundary

The first feature-branch commit contains only this Task Brief. It is pushed before A2 results and
opens a Draft PR targeting `integration/v2`. A GitHub App 403 is delegated immediately to the
control tower; it does not authorize Chrome, interactive login, or a user's browser session.

The cumulative A0-A2 write allowlist is exactly:

```text
docs/tasks/pr-28-identity-redaction.md
```

A2 is findings-first and read-only. Production and test changes begin only after this document
records the complete exact-base inventory, the minimum literal implementation allowlist, the
failure-first test plan, and any material collision decision.

## A2 investigation contract

### Current-tree identity inventory

Inspect every tracked source, fixture, test, document, configuration, example, and Demo path for:

- hard-coded athlete IDs, names, usernames, profile identities, and athlete-specific fallbacks;
- `Number`, `parseInt`, `parseFloat`, unary plus, `BigInt`, arithmetic, lossy comparison, truthy
  fallback, trimming, or normalization applied to athlete/activity/provider/external IDs;
- specific identity constants that flow into runtime, DOM, storage, network, logs, or analytics;
- identity-like values that are synthetic and deterministic versus real or unproved;
- production-reachable versus test/docs/example-only occurrences.

The inventory reports only field category, path, owner, reachability, flow, count, and when useful
a non-reversible digest. It must never repeat a discovered identity value in commentary, commits,
tests, Task Brief prose, PR prose, delegated messages, or test output.

### Source-to-boundary trace

For every finding, record:

1. tracked path and owner;
2. source category and whether the literal is specific, synthetic, or closed vocabulary;
3. production entry and actual reachability;
4. validation and transformation steps;
5. runtime destination: DOM, storage, network, log, analysis, or inert data;
6. opaque-string semantic risk;
7. smallest repair and exact candidate path;
8. Demo, Legacy, Canonical, auth/provider, migration, and rollback impact.

### Git-history exposure metadata

Read-only history inspection may report affected path categories, introducing/removing commit
counts, first/last reachable timestamps, reachable ref classes, and non-reversible digests. It
must not output the identity literals. `git filter-repo`, force push, ref/tag/release rewriting,
PR/issue deletion, credential rotation, incident reports, external notification, and real-account
verification are material or destructive actions and remain prohibited without an explicit owner
decision returned through the control tower.

## Default product contract

Subject to the exact-base A2 inventory and literal scope freeze:

1. Remove or replace specific current-tree identity constants with deterministic synthetic values.
2. Demo data remains deterministic, synthetic, and isolated from Real provider/auth/storage paths.
3. Real mode has no built-in fallback for one athlete and no implicit athlete-specific correction.
4. Athlete, activity, provider, and external IDs remain non-empty opaque strings byte-for-byte.
5. Valid values include string `"0"`, leading-zero strings, URL-reserved strings, Unicode, and the
   own data keys `__proto__`, `constructor`, and `prototype`.
6. Numeric zero, `null`, missing values, invalid descriptors, accessors, Proxies, and hostile
   reflection fail closed before side effects. Accessors are not executed and raw values are not
   disclosed.
7. No real Token, account, provider payload, private data, or user profile is read for
   implementation or verification.
8. Canonical/Storage schema, Repository public API, Import public API, analysis algorithms,
   dependencies, Worker, Service Worker, deployment, release, routes, CSS, and product-wide UI
   redesign remain unchanged.

## Failure-first test contract

Before production repair, add deterministic synthetic tests that fail for the exact current-tree
defects and prove:

- the known identity field categories are absent from the tracked current tree without embedding
  the prohibited values in test source or failure output;
- the repository privacy guard rejects a synthetic identity-regression fixture through category-
  based or digest-based evidence that does not disclose the original values;
- profile and related IDs preserve exact string identity for `"0"`, a leading-zero string,
  URL-reserved text, Unicode, `__proto__`, `constructor`, and `prototype`;
- numeric zero, `null`, missing, and invalid hostile descriptors fail closed;
- getters are never executed and raw values never enter errors, DOM, console, storage, network, or
  public results;
- Demo isolation and Legacy/Canonical rollback plus provider/auth boundaries remain unchanged.

Failure output uses only safe assertion labels, field categories, paths, counts, and digests.

## A2 findings and implementation authorization

### Findings-first current-tree inventory

The exact-base read-only audit confirmed four identity categories without emitting their values:

| Category | Current-tree owners | Reachability and flow | Disposition |
| --- | --- | --- | --- |
| Athlete-specific matcher constants | `js/shared/preprocessing/core.js`, `js/pages/swim/swim.js` | Real/Legacy/Canonical summary preprocessing and Swim detail can select and mutate one athlete's historical swim values; summary preprocessing also reads a Legacy athlete cache fallback | Remove the entire implicit correction/matcher and fallback path |
| Numeric athlete-ID coercion | `js/shared/preprocessing/core.js` | `profile.id` is coerced through `Number` before athlete-specific selection | Removed with the matcher; add a static/content guard |
| Demo profile/activity identity | `js/demo/generator.js` | Deterministic Demo generation and Demo-only storage/Repository/UI; no Real fallback, but one specific profile and numeric activity/athlete/upload IDs are tracked | Replace with explicit deterministic synthetic strings |
| Example activity-ID coercion | `js/pages/activity/quick-start-example.js` | Tracked example, not imported by an actual served production entry; query ID is parsed numerically before the analyzer boundary | Preserve the exact non-empty string and fail closed otherwise |

The same identity digests occur in historical Task Brief evidence and deterministic tests/browser
harnesses. Those current-tree occurrences are not production inputs, but retaining them would
defeat a tracked-content regression guard. They are replaced with category-safe prose or new
deterministic synthetic sentinels. No private fixture or real data is required.

Existing Legacy compatibility adapters were classified separately and remain unchanged. They may
accept an established numeric Legacy/provider DTO ID and serialize it once to a string at the
compatibility boundary. They do not parse an opaque string, and R1/R2 explicitly froze those
Legacy numeric-ID outcomes. Changing them here would violate the required Legacy rollback and
provider/auth boundary freeze. Canonical, Import, Storage, Repository, and page-local opaque-string
contracts already reject or preserve strings as required.

### Source-to-runtime trace

```text
Root initial load / refresh
  -> main selects an injected preprocessing athlete
  -> preprocessActivities
  -> exact-base athlete-specific matcher
  -> exact-base summary activity mutation
  -> summary analysis and DOM

Router -> DetailReadSession -> Swim renderer
  -> injected activity plus optional athlete
  -> descriptor-safe exact-base athlete-specific matcher
  -> cloned detail activity/lap/split mutation
  -> Swim analysis and DOM

Demo generator
  -> Demo namespace only
  -> DemoRepository
  -> shared summary/detail consumers

Tracked quick-start example
  -> query string
  -> numeric parse on exact base
  -> analyzer initializer
```

The repair removes the first two selection/mutation flows, keeps Demo isolated with synthetic
strings, and retains the example query ID byte-for-byte. It adds no storage, network, logging,
provider, auth, or migration operation.

### Read-only history finding and owner disposition

The affected identity categories have multiple count-changing commits across public remote ref
classes, with the earliest category exposure predating V2 and the latest reaching the current
release-hardening ancestry. Only commit counts, time ranges, ref classes, and digests were
reported. The owner disposition is to proceed with current-tree removal while recording public
history as a disclosed release blocker. This task must not rewrite history, refs, tags, Releases,
PR artifacts, or perform incident notification or real-account verification.

### Frozen cumulative implementation allowlist

The minimum literal hard maximum is exactly these seventeen paths:

```text
docs/engineering/git-worktree-workflow.md
docs/tasks/pr-01-legacy-cache-rescue.md
docs/tasks/pr-04a-summary-consumers.md
docs/tasks/pr-26-dom-safety.md
docs/tasks/pr-28-identity-redaction.md
js/demo/generator.js
js/pages/activity/quick-start-example.js
js/pages/swim/swim.js
js/shared/preprocessing/core.js
scripts/check-privacy.mjs
tests/consumers/detail-boundaries.test.js
tests/consumers/detail-browser-smoke.html
tests/consumers/detail-consumers.test.js
tests/consumers/summary-browser-smoke.html
tests/demo-generator.test.js
tests/legacy/demo-isolation.test.js
tests/privacy/tracked-identity.test.js
```

An additional path requires a minimal failure/collision package and control-tower decision. No other
source, test, documentation, package, workflow, schema, storage, Repository, Import, analysis,
provider/auth, Worker, Service Worker, deployment, or release path is authorized.

### Implementation authorization

The delegated user contract explicitly authorizes current-tree removal and the opaque string-ID
guard after this A2 freeze. Implementation may proceed automatically within the literal allowlist.
Public-history handling remains paused under the disposition above.

## Prohibited scope and operations

- No modification of `main`, `maintenance/v1`, or `integration/v2`.
- No schema, database version, migration, persistence representation, Repository/Import public API,
  provider/auth lifecycle, analysis algorithm, dependency, Worker, Service Worker, deploy, release,
  tag, or GitHub Release change.
- No real identity verification, private fixture, account, browser profile, Token, provider call,
  user storage, private library, export, screenshot, or telemetry inspection.
- No deletion, clearing, overwrite, downgrade, reverse-copy, cleanup, or repair of Legacy/V2 data.
- No history rewrite, force push, ref deletion, external incident action, Ready transition, merge,
  cleanup, deploy, release, or R4 work.

## Verification gates

After implementation:

```text
npm ci
focused failure-first tests
npm run check:syntax
npm run check:privacy
npm test
git diff --check
```

If a production browser surface is affected, run the repository's actual-served disposable-browser
procedure on a fresh loopback origin/profile using only deterministic synthetic data. Record all
unrun browser evidence as `NOT RUN` until it actually executes.

After pushing the implementation and Closure heads, create a true remote depth-1 clone of the
actual branch, require exact SHA, history count one, clean status, install, focused/full tests,
syntax, privacy, and diff checks. Confirm GitHub Actions succeeds on the exact Closure head.

Independent review is findings-first. Each finding receives a minimal failure-first repair. A fresh
review must return no findings across the cumulative implementation surface before the final
Task-Brief-only Closure commit.

## Privacy and security impact

The intended change removes identifiable tracked constants and numeric identity coercion while
preserving opaque strings as inert data. Tests and browser evidence are deterministic and
synthetic. A passing privacy guard does not decide whether public history requires remediation;
that remains a separate owner incident decision.

## Migration impact

None. No database, schema, stored record, cache, user setting, provider state, backup, or existing
Legacy/V2 library is read, rewritten, migrated, cleared, deleted, downgraded, or reverse-copied.

## Rollback procedure

The mechanical rollback is an ordinary PR revert and never a data operation. Reverting a removal
would reintroduce the release-blocking privacy/string-ID defect and therefore is not an acceptable
production state. Legacy and Canonical data remain preserved; explicit Legacy mode remains the
application rollback boundary.

## Stop and delegation conditions

Pause and return a minimal decision package only for:

- a material product/API/schema/dependency/algorithm/Service Worker behavior change;
- a required path outside the frozen implementation allowlist;
- public-history remediation, incident handling, credential/account action, or external notice;
- destructive Git/data operations or private/user/browser evidence;
- GitHub App 403 during PR creation or update.

The task otherwise advances automatically through repair and verification. It stops finally at a
Ready-for-review handoff while the PR remains Draft. Ready transition, merge, cleanup, deploy,
release, and R4 require explicit control-tower or user authorization.

## Completion evidence

### Failure-first and implementation

- The Task-Brief-only first commit and the A2-only scope-freeze commit preceded production edits.
- The initial focused run failed in four expected assertions: Demo opaque-string IDs and a
  current-tree guard reporting twelve affected paths. The privacy command also failed using only
  safe path and category labels; no identity value was emitted.
- The implementation removed both athlete-specific match/correction paths and the Legacy profile
  fallback, replaced Demo profile/activity/upload identity fields with deterministic non-empty
  synthetic strings, and preserved the tracked example query ID as a validated opaque string.
- The repository privacy command now scans tracked text with non-reversible frozen digests and
  categorical structural rules. Its tests construct synthetic regression inputs without embedding
  a prohibited identity value.
- The implementation commit is `13f5537f6cd3b6b59558ba74ff22e2249c5bf7fa`. All implementation
  writes are within the frozen seventeen-path allowlist.

### Verification

- Focused tests passed 318/318 after the failure-first repair.
- Local syntax passed for 240 files, privacy passed, full tests passed 1482/1482, and
  `git diff --check` passed.
- Two actual-served loopback browser harnesses ran in an isolated browser context with synthetic
  data. The detail harness passed thirteen deterministic gates and the summary harness returned an
  overall passed status. The isolated tabs and temporary server were closed afterward.
- A true remote depth-one fetch of the feature branch resolved exact head
  `13f5537f6cd3b6b59558ba74ff22e2249c5bf7fa`, reported a shallow history count of one, and was
  clean. In that checkout, `npm ci`, syntax 240, privacy, full 1482/1482, diff, and final clean
  checks passed.
- Pull-request CI run `31235286903`, job `93046494028`, completed successfully on that exact
  implementation head; install, syntax, privacy, and tests all succeeded.

### Independent review and remaining blocker

- An independent findings-first review returned no findings across the exact seventeen-path
  allowlist and the frozen runtime, privacy, ID, migration, rollback, provider/auth, storage,
  Repository, Import, schema, and algorithm boundaries.
- A separate fresh exact-head re-review also returned no findings. It independently reran the
  focused 318/318 suite, privacy, and exact-range diff check.
- Public Git-history exposure remains a disclosed release blocker requiring a separate owner
  decision. No history/ref/tag/Release/PR artifact rewrite, force push, incident notification,
  credential/account action, external notice, or real-account verification was performed.
- This Closure changes only this Task Brief. The PR remains Draft. Exact Closure-head remote clone
  and CI evidence are final external handoff gates; Ready transition, merge, cleanup, deploy,
  release, and R4 remain unauthorized.
