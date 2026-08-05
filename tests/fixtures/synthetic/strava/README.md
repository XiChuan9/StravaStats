# Synthetic Strava CSV fixtures

`activities.csv` is a deterministic, hand-authored fixture for PR-08. It is not
derived from a real Strava export or athlete. IDs, names, dates, summary values,
and the extra header are intentionally synthetic and exercise leading zeros,
URL-special opaque text, formula-like inert text, quoting, an embedded newline,
known repeated headers, missing values, zero values, and an unknown sport.

The fixture must never be replaced with a user export or copied from
`tests/fixtures/private/`.
