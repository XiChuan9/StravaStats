# Security Policy

This file defines the security boundary and finding policy for the public
StravaStats repository. It is review context, not an operational runbook.
Build, test, and verification commands belong in `AGENTS.md` and the active
Task Brief.

## System and Scope

StravaStats is a single-user, local-first sports analytics Web/PWA. The public
product keeps a source-neutral Canonical activity library in browser storage,
local FIT/TCX/GPX/CSV/ZIP import, existing analytics and visualizations,
Repository and Projection boundaries, Source Manager, exact-identity and
duplicate-review flows, Backup/Restore, Diagnostics, and an optional Strava
source. It is not a multi-user service, medical system, or cloud data store.

This policy covers:

- browser pages, tabs, analysis consumers, DOM rendering, and local settings;
- Decoder, Import, Canonical validation, identity, and duplicate-review code;
- Legacy and V2 IndexedDB, Repository, Projection, Storage, and migrations;
- Backup/Restore, Diagnostics, logging, and exported artifacts;
- Source Manager authorization, optional Strava connectors, and serverless API
  routes;
- explicit Weather, map-tile, and AI egress boundaries;
- Service Worker, Cache Storage, static assets, and dependency loading; and
- committed fixtures, documentation, CI output, release artifacts, and the
  boundary between private evidence and the public repository.

The public current runtime excludes Run Plus and NSM. Historical records may
describe those retired surfaces only as clearly labeled history. Reintroducing
their runtime, routes, assets, current-feature documentation, or private
repository details is a public-boundary violation. Retained historical
LocalStorage compatibility keys remain user-owned data and are not authority
to expose the retired runtime.

The repository does not currently represent an approved production release.
Release readiness, platform compatibility, deployment, and rollback evidence
are separate from whether a reachable security defect exists.

## Assets and Security Objectives

The primary assets are:

- activities, streams, RawArtifacts, GPS routes and locations, heart-rate,
  power, device and provider metadata, analysis results, and user settings;
- access tokens, refresh tokens, OAuth state and codes, provider subjects,
  client secrets, and authorization scopes;
- Legacy and Canonical libraries, provenance, import and duplicate decisions,
  SourceConnection and SourceOperation state, and backups;
- integrity and availability of local data, migrations, restore, rollback, and
  exact-duplicate behavior; and
- privacy of contributors, private fixtures, private evidence locations, and
  unpublished product work.

The security objectives are confidentiality of athlete and credential data,
integrity and recoverability of both local libraries, explicit control of every
external disclosure or destructive action, and deterministic fail-closed
handling of untrusted input.

## Threat Model and Trust Boundaries

Treat the following as attacker-controlled or malformed until validated:

- selected FIT, TCX, GPX, CSV, ZIP, backup, and provider-artifact bytes;
- filenames, archive paths, XML, CSV cells, activity text, opaque IDs, URLs,
  query strings, OAuth callbacks, local settings, and stored browser records;
- provider and other network responses, headers, status codes, and timing;
- values passed between pages, injected facades, Repository implementations,
  Workers, Service Workers, and browser platform APIs; and
- repository contributions, fixtures, screenshots, logs, and build artifacts.

Important trust boundaries are:

1. Untrusted local files and backups -> bounded parsers -> Canonical validators
   -> transactional V2 storage.
2. Pages and analysis consumers -> injected Repository, Projection, or narrow
   app-owned facade -> storage or provider-specific implementation.
3. Demo -> Real, Legacy -> V2, and Legacy/Shadow -> Canonical mode boundaries.
4. Browser -> same-origin API routes -> Strava OAuth/API, with the client secret
   remaining server-side.
5. Private local activity data -> explicit, feature-specific consent ->
   Open-Meteo, OpenStreetMap, or Google Gemini.
6. Network/static runtime -> Service Worker validation -> Cache Storage and
   controlled documents.
7. Private real-data evidence -> redacted counts/statuses -> public Git, CI,
   issues, pull requests, logs, screenshots, and support material.

The user's browser/OS profile, same-origin hosting control, and explicitly
configured server secrets are trusted. A compromised or unlocked local profile
can already read origin storage and saved backup files. Third-party providers
and browser APIs are trusted to implement their published interfaces, but all
data they return remains untrusted input.

## Security Invariants

The following properties must hold:

### Data preservation and recovery

- `strava-dashboard-cache` and `strava-stats-v2` remain physically separate.
  V2 must never upgrade, clear, overwrite, downgrade, or recreate Legacy data.
- Schema changes and migrations are additive, idempotent, transactional,
  observable, retryable, and fail closed on unsupported or mismatched state.
- Disconnecting or revoking Strava credentials is separate from deleting local
  activity, provenance, import, settings, backup, Legacy, or Canonical data.
- Cancel, Retry, Recover, Abandon, duplicate review, and rollback preserve every
  already committed item and never use deletion as error recovery.
- Restore validates the complete bounded archive, hashes, paths, versions,
  references, and target state before mutation. It writes only to an absent or
  exact empty supported target, commits atomically, and never overwrites a
  different library or setting.

### Input, identity, and architecture boundaries

- Local imports are browser-local, bounded by type/count/size/structure, inert,
  and fail closed before Canonical persistence. XML external entities, archive
  traversal, ambiguous entries, unsafe ZIP features, and malformed binary or
  object shapes must not escape their parser boundary.
- Every persisted ImportedActivityBundle passes the accepted source-neutral
  validator. Validators do not coerce, default, mutate, execute accessors, or
  expose raw rejected values.
- Exact identity is idempotent. Similarity alone creates a review candidate and
  never silently merges, replaces, hides, or deletes an activity or source.
- Activity, source, device, job, and provider IDs crossing public boundaries are
  non-empty opaque strings. Consumers must not parse them numerically. Local
  navigation tokens must be encoded and must never be echoed into logs,
  Diagnostics, errors, external URLs, or public evidence.
- Pages, tabs, and analysis modules do not select providers, databases, caches,
  or Repository implementations and do not read provider credentials or
  storage directly. Demo never constructs or falls back to Real capabilities.

### Authorization, privacy, and egress

- Connect, Reconnect, Sync, Retry, Recover, Abandon, consent, and destructive
  actions require the documented explicit user action; startup, reload, Demo,
  restore, and offline/online events do not trigger them implicitly.
- OAuth state is cryptographically random, single-use, time-bounded, and
  matched before code exchange. Accepted scopes and provider subject identity
  are exact; mismatches store nothing. The OAuth client secret never enters the
  browser, backup, Diagnostics, or logs.
- Same-origin provider routes use their exact methods and bounded request and
  response profiles, disable caching of private responses, and never log raw
  credentials, provider payloads, response bodies, or platform errors.
- Local import and ordinary Canonical browsing perform no provider upload.
  Weather, map tiles, and AI start denied, use their distinct disclosed
  destination and minimal approved payload, and require the exact scoped
  consent. Revocation blocks future work but must not claim to erase requests
  already received by a browser or provider.
- Runtime telemetry remains disabled. Executable visualization dependencies are
  exact-version-pinned, integrity-checked, served same-origin, and have no CDN
  fallback.
- Logs, errors, DOM, Diagnostics, tests, Git, CI, screenshots, release evidence,
  and support material contain fixed safe codes or non-identifying aggregates,
  not credentials, raw causes, filenames, IDs, private paths, activities,
  routes, coordinates, health/power data, provider responses, or backup bytes.
- Committed sports fixtures are deterministic and synthetic. Automated tests
  never read, enumerate, or copy private fixtures or real browser profiles.

### Runtime and update integrity

- DOM output treats activity, filename, provider, and analysis text as data, not
  markup or script.
- Service Worker handling is limited to validated, same-origin, credential-safe
  static assets. API, private, dynamic, redirected, query-bearing, sensitive-
  header, or incorrectly typed responses never enter runtime cache handling.
- Cache cleanup names only application-owned retired caches and never clears
  user storage, Legacy data, V2 data, or unknown caches. Mixed-version or update
  failure must degrade safely without destructive cleanup.
- The current public runtime, including Backup/Restore, must not read, write,
  remove, rename, rewrite, or migrate historical Run Plus/NSM LocalStorage
  compatibility keys. Existing values remain user-owned and byte-for-byte
  untouched.
- Current portable backups must not serialize or publish those retired keys,
  and restore must not recreate them. A legacy backup containing a retired
  entry may restore its other supported data, but the retired entry is ignored
  without publishing its value.

## Reportable Findings and Severity Context

A reportable finding needs a concrete path from untrusted input or an
untrusted actor to a violation of an invariant above. Tests show intended
controls but do not by themselves prove a path safe. Report findings for, among
other things:

- unauthorized disclosure or external transmission of credentials, athlete
  data, location, health data, private files, or repository-private details;
- OAuth state/scope/subject confusion, credential leakage, unintended provider
  operations, or Disconnect that removes local data;
- stored or reflected script/markup injection through imported, provider, URL,
  settings, analysis, or restored data;
- parser escape, XML entity access, ZIP traversal or unsafe expansion, backup
  tampering, bounds bypass, or resource exhaustion outside documented limits;
- partial or destructive writes, unsafe migration/downgrade, silent duplicate
  creation, cross-mode data contamination, or restore over a non-empty target;
- page/analysis bypass of Repository or explicit facades that reaches storage,
  credentials, or provider I/O;
- Service Worker caching of API/private/dynamic responses, cache confusion, or
  unsafe deletion of caches or user data;
- current-tree secrets, real sports data, personal paths, private fixture use,
  or a bypass in the privacy guard that allows them into public evidence; and
- a reachable vulnerable dependency or deployment configuration that breaks a
  stated boundary.

Use product context when assigning severity:

- **Critical:** remote exploitation with little or no user interaction that can
  compromise deployed users at scale, execute code in the trusted origin,
  steal credentials, exfiltrate broad athlete libraries, or destroy data
  across users or releases.
- **High:** ordinary use of a malicious import, backup, provider response, or
  link can cause persistent script execution, account/token compromise, silent
  bulk GPS/health disclosure, irreversible local-library loss, or bypass of an
  explicit egress/destructive-action boundary.
- **Medium:** a meaningful but limited confidentiality, integrity, or
  availability violation affecting one user/library, requiring a less common
  explicit action, or remaining recoverable through the supported backup or
  rollback path.
- **Low:** bounded, transient, and recoverable impact involving no credential,
  precise location, health data, persistent corruption, or boundary bypass.

Increase severity for default or silent reachability, persistence, cross-mode
or cross-release impact, credentials, precise routes, health data, broad
libraries, and destructive recovery. Reduce it for paths requiring local
developer tools or an already compromised trusted browser profile. Availability
issues are findings when attacker-controlled input escapes documented bounds,
blocks safe recovery, or creates materially worse impact than the disclosed
large-library limitations.

## Out of Scope, Exclusions, and Accepted Risk

The following are not findings by themselves:

- lack of accounts, tenants, roles, cloud sync, or server-side athlete storage;
- access by someone who already controls the user's unlocked browser/OS profile
  or a backup file the user saved outside the application;
- absence of application-managed at-rest encryption for browser storage or
  exported backups, provided the application does not misrepresent them as
  public-safe and does not expose them across another boundary;
- third-party outages, rate limits, provider-side retention after a consented
  request, unsupported file/vendor extensions, or rejection at documented
  limits;
- visual, accessibility, localization, or algorithm-quality defects without a
  security-boundary consequence;
- unverified browser, production Service Worker, deployment, performance, or
  release matrices when they are accurately labeled as unverified; and
- vulnerabilities wholly inside the browser, OS, or external provider that the
  application neither causes nor makes exploitable through its integration.

The recorded no-history-rewrite disposition for a prior non-credential public
identity exposure is an accepted historical risk. It does not suppress a new
current-tree disclosure, a privacy-guard regression, evidence of credential or
athlete-data exposure, or repetition of the historical value.

Private Run Plus/NSM functionality is not reviewed as public product behavior
after the scope freeze. Accidental reintroduction, reachability, current-feature
claims, any current-runtime read, write, removal, migration, or portable backup
handling of its compatibility keys, or disclosure of its private repository or
evidence location remains reportable.

## Known Limitations and Compensating Controls

- Browser storage is origin- and profile-scoped, not a hardened secrets vault.
  The trusted local-profile assumption is compensated by local-first data flow,
  minimal provider scopes, explicit actions, backup credential exclusion, and
  strict logging/egress rules.
- A V2 backup is a plaintext private athlete archive and can contain GPS,
  heart-rate, power, devices, RawArtifacts, and settings. Integrity hashes and
  atomic restore protect correctness, not confidentiality outside the app.
- Consented Weather and map requests disclose approximate location/date or map
  region/timing to their named provider. Revocation cannot retract provider or
  browser records already created.
- Real-account/private-library, broad cross-browser, production Service Worker,
  deployment, and combined rollback evidence remain incomplete. Synthetic,
  deterministic tests are compensating evidence, not proof of those unrun
  environments.
- Large local libraries can hit documented memory, quota, and cold-load
  performance limits. Bounded selection, parsing, concurrency, cancellation,
  Retry/Recover/Abandon, and non-destructive rollback limit the impact.

## Handling Sensitive Reports

Use a minimal synthetic reproduction and fixed safe codes. Do not attach real
activity files, backups, tokens, authorization headers, console dumps, browser
profiles, screenshots with athlete data, or precise locations to a public
issue. Credential or private-data exposure must be handled privately without
repeating the sensitive value in repository history or public discussion.
