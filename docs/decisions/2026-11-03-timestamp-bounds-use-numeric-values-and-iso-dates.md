# Timestamp bounds use numeric values and ISO dates

- **Status:** Accepted
- **Revisions:** v1 2026-11-03 (initial)
- **Deciders:** Ingestion maintainers
- **Guard:** `test_convert_numeric_timestamp`, `test_convert_timestamp`, `test_datetime_bounds_accept_epoch_and_iso`
- **Related:** [PR #36169](https://github.com/open-metadata/OpenMetadata/pull/36169), [PR #36144](https://github.com/open-metadata/OpenMetadata/pull/36144)

## Context

Data-quality bounds arrive as strings. Counting characters to infer timestamp units makes signs,
leading zeroes, and decimal precision change the interpreted date. ISO parsing in Python's
standard library also accepts different formats across supported Python versions.

## Decision

`convert_timestamp` tries numeric parsing first, so bare numeric strings such as `20230201`
remain epoch timestamps. Finite numeric values with absolute magnitude below 10**12 represent
seconds; larger magnitudes represent milliseconds. This retains the existing cutoff for
unsigned integer timestamps while making signs and numeric formatting irrelevant.

Non-numeric values use `dateutil.parser.isoparse`, an existing runtime dependency. Explicit
timezone offsets are honored; dates and datetimes without an offset use UTC. The output is
seconds since the Unix epoch, with fractional seconds preserved. Invalid dates and non-finite
numeric values raise `ValueError`.

The shared pandas min/max calculations preserve their default epoch-millisecond accumulators
and output for compatibility. The between validator requests
`preserve_datetime=True` through the existing metric configuration mechanism, so it compares
datetimes at their original precision with its parsed bounds using the same aggregation code as
other callers.

## Consequences

Bare numbers cannot unambiguously identify their units or distinguish compact calendar dates
from timestamps. The existing cutoff is retained for compatibility, not claimed as universal
unit detection. Older millisecond dates and compact calendar dates should use an unambiguous
ISO representation; supporting explicit epoch units would require a separate input contract.
