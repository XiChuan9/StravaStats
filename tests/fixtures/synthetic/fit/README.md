# Synthetic FIT fixture builder

`fit-fixture.js` creates deterministic FIT bytes from hand-authored message
definitions and values. It is deliberately independent from the production
Decoder: it has its own byte writers, base64 encoder, and CRC implementation.

The builder contains only invented timestamps, coordinates, summary values,
device labels, and manufacturer/profile enum values. It was not derived from an
athlete export or a provider file. No `.fit` binary is checked in.

Tests may use the low-level definition/data helpers for malformed framing and
boundary cases, or `createSyntheticFitActivity()` for the frozen Garmin,
COROS, Wahoo, Zwift, indoor, no-GPS, no-HR, split-record, CRC, pause/resume,
and HR-message matrix.
