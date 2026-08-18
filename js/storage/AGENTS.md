# V2 Storage Instructions

These rules extend the repository-level `AGENTS.md` for `js/storage/`.

- This directory has one hotspot owner per task. Change only paths listed in the
  active Task Brief phase allowlist.
- Production code may open or upgrade only the independent `strava-stats-v2`
  database. Do not import Legacy cache modules or embed the Legacy database name.
- Never expose or call database deletion, object-store clearing, bulk cleanup,
  restore, downgrade, or overwrite-as-recovery helpers.
- Keep imports side-effect free. A factory must not open IndexedDB until an
  explicit operation requires it.
- Close connections immediately on `versionchange`. Do not return an early
  timeout or blocked failure while a request could later mutate schema.
- Public descriptors, results, and errors must be detached, immutable, and
  redacted. Never expose IDB handles, requests, transactions, cursors, raw causes,
  keys, activity IDs, payloads, credentials, or precise locations.
- Inspect public inputs without executing accessors. Unsafe reflection, Proxies,
  cycles, special objects, and non-JSON-safe values fail closed before any
  readwrite transaction.
- Canonical writes must pass the Accepted bundle validator and remain atomic.
  B1 must not implement B2 write, query, or backup-manifest behavior.
- Do not import pages, tabs, analysis, Repository consumers, application wiring,
  or provider-specific persistence into this directory.
- Tests are synthetic, deterministic, offline, and must distinguish Node
  `fake-indexeddb` evidence from real-browser IndexedDB evidence.
