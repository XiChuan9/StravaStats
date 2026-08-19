# Synthetic TCX fixtures

Every TCX document produced by `tcx-fixture.js` is assembled from invented,
deterministic literals. The dates are deliberately in 2031, the coordinates
are simple synthetic values, the namespace used for unknown extensions is
`urn:stravastats:synthetic:tcx`, and device/application labels explicitly say
`Synthetic`. No athlete export, route, account, token, serial number, or real
provider response was consulted or copied.

The builder emits Garmin TCX v2 core elements plus narrowly selected Garmin
ActivityExtension v2 and TrackPointExtension v1 fields. Tests vary those
generated strings to exercise namespace equivalence, missing fields, exact
zero values, limits, malformed structures, XML attacks, and redacted errors.
The fixture module is test-only and never enters the production Registry,
Source Manager, Import Worker, persistence, or provider paths.
