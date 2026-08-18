# Synthetic Strava CSV fixtures

`activities.csv` is a deterministic, hand-authored fixture for PR-08. It is not
derived from a real Strava export or athlete. IDs, names, dates, summary values,
and the extra header are intentionally synthetic and exercise leading zeros,
URL-special opaque text, formula-like inert text, quoting, an embedded newline,
known repeated headers, missing values, zero values, and an unknown sport.

The fixture must never be replaced with a user export or copied from
`tests/fixtures/private/`.

`archive-fixture.js` code-generates deterministic synthetic ZIP bytes for
PR-09. Its CSV rows and opaque child payloads are invented test data and are
not valid FIT, TCX, or GPX recordings. No binary archive or athlete export is
committed.

`api-import-fixture.js` hand-authors the deterministic C3a reduced provider
envelopes and code-generates only boundary arrays during tests. Its positive
string identities, dates, coordinates, summaries, streams, laps, warnings, and
canaries are inventions and were not copied from a provider response, account,
export, screenshot, or private fixture. It contains no credential, Token,
authorization header, athlete profile, route URL/polyline, gear/device
identifier, serial, or provider error body. It must never be replaced with or
augmented from a real account response or user export.
