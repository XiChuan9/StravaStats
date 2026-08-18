# Data Domain Instructions

These rules extend the repository-level `AGENTS.md` for all files under
`js/data/`. They do not weaken any repository privacy, safety, Git, or
verification requirement.

- Canonical contracts must remain provider-neutral. Provider-specific fields
  must not spread into Canonical top-level objects.
- Validators must be pure functions with no network, storage, DOM, UI, or
  Service Worker side effects.
- Ordinary invalid data must return a validation result rather than throw.
- Validators must not mutate, sort, coerce, default, normalize, or strip input
  data.
- Validation errors and warnings must not contain raw activity values,
  locations, credentials, tokens, or other sensitive data.
- Contract data must use only plain JSON-safe objects, arrays, strings,
  booleans, finite numbers, and null.
- Contract modules must not depend on application, UI, Storage, Repository,
  Analysis, provider, Connector, Decoder, or Import runtime modules.
- Tests must use only inline, synthetic, deterministic data and must remain
  offline.
- Never weaken the root `AGENTS.md` privacy and data-safety rules.
