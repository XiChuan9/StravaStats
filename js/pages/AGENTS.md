# Page Consumer Boundary Rules

These rules extend the repository-root `AGENTS.md`; they do not replace or weaken it.

## Provider, authentication, and storage boundaries

- Page consumers must not read or write Tokens or Authorization data.
- Page consumers must not call `/api/strava-*` or another provider endpoint directly.
- Page consumers must not select a provider, Connector, cache, storage implementation, or
  Repository implementation.
- Provider-owned page data must come from the public Repository entry or an explicitly approved
  page-local read façade.
- Page consumers must not read provider-owned storage keys, including real or Demo Token, activity,
  athlete, zones, gear, cache, or timestamp keys.
- Demo/Real mode is determined exactly once per document. A Demo document must not construct a Real
  connector or fall back to real Token, cache, storage, or provider I/O.

## IDs, errors, and data safety

- Activity IDs are non-empty opaque strings. Do not use `parseInt`, `parseFloat`, `Number`, `BigInt`,
  arithmetic, or another numeric conversion on an activity ID.
- Errors exposed through DOM, console, or a public result must not include Token, Authorization,
  response body, payload, cause, raw provider/underlying messages, or private activity content.
- Pages and page-local façades must never clear or delete Local Library, Legacy cache, IndexedDB,
  provider storage, or user data as error recovery or rollback.
- Tests must remain deterministic, synthetic, offline, and independent of real credentials, private
  fixtures, and the user's browser profile.

## Scope and parity

- Modifying a detail renderer, analysis algorithm, analysis/export behavior, or public Repository API
  requires explicit task and file-scope approval.
- Data-boundary work must preserve approved HTML, CSS, copy, routes, DOM IDs/classes, chart/map/lap
  behavior, ordering, and visual output unless a task explicitly accepts an exception.
- PR-04B B1 authorizes only Router, `DetailReadSession`, Connector compatibility, governance, and B1
  tests. It does not authorize migration of the four detail consumers or changes to Advanced
  Analysis; those remain B2 work.
