# Synthetic GPX fixtures

| Field | Value |
| --- | --- |
| Fixture ID | `synthetic-gpx-m10` |
| Classification | Synthetic |
| Format/version | GPX 1.1 with selected Garmin extension schemas |
| Sport | Invented run/ride/walk/hike/workout cases |
| Capabilities | WGS84 position, elevation, HR, cadence, power, missing time |
| Expected warnings/errors | Frozen static codes in the PR-13 Task Brief |
| Expected Canonical output | One validated `ImportedActivityBundle` |
| Construction | JavaScript string builder from fixed invented literals |
| License/source | Original test data; format structure follows public schemas |
| Privacy reviewer | Required independent PR-13 Final Review |
| Last reviewed | 2026-08-05 |

The coordinates, timestamps, names, sensor values, and track structure are
invented for this repository. They were not copied, transformed, rounded, or
redacted from a real athlete, device export, route, account, or private file.

The fixture remains JavaScript instead of a committed `.gpx` artifact so tests
can construct exact resource boundaries, malformed XML, namespace attacks, and
missing/null/zero cases without carrying an opaque sports-data file.
