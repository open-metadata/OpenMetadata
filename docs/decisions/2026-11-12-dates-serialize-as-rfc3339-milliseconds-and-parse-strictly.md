# Dates serialize as RFC-3339 UTC milliseconds and parse strictly with floor millisecond truncation

- **Status:** Accepted
- **Revisions:** v1 2026-11-12 (initial)
- **Deciders:** OpenMetadata maintainers
- **Guard:** JsonUtilsTest, OpenLineageMapperTest, OpenLineageLineageResolutionIT
- **Related:** [#33028](https://github.com/open-metadata/OpenMetadata/issues/33028); [#37634](https://github.com/open-metadata/OpenMetadata/pull/37634)

## Context

`java.util.Date` stores epoch milliseconds. OpenMetadata 2.0.0–2.0.7 configured
`SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSSSSS'Z'")` on `JsonUtils.DATE_TIME_FORMAT` and
`RestUtil.DATE_TIME_FORMAT`, with `JsonUtils.LenientIsoDateDeserializer` delegating string parsing
to `DeserializationContext.parseDate`. Because `SimpleDateFormat` treats `S` as milliseconds rather
than fractional seconds and defaults to `lenient = true`:

- Numeric UTC offsets such as Python `datetime.isoformat()`'s `"2026-09-08T08:29:49.711594+00:00"`
  were rejected (`HTTP 400`).
- Six-digit microsecond fractions such as Spark's `"2026-09-08T08:29:49.711594Z"` added
  `711,594 ms` (`+11m 51.594s`) to `:49` instead of parsing `0.711594s`.
- Serializing `new Date(1714000000918L)` left-padded milliseconds into six digits
  (`"2024-04-24T23:06:40.000918Z"`), persisting `.000dddZ` inside entity JSON columns.

## Decision

- `java.util.Date` fields serialize in UTC as `yyyy-MM-dd'T'HH:mm:ss.SSS'Z'` (`lenient = false`)
  across `JsonUtils.DATE_TIME_FORMAT`, `RestUtil.DATE_TIME_FORMAT`, the Dropwizard bootstrap
  `ObjectMapper`, and `JsonPatchProvider`.
- `JsonUtils.LenientIsoDateDeserializer` accepts:
  - Strict RFC-3339 / ISO-8601 timestamps (`ResolverStyle.STRICT`, `SignStyle.NOT_NEGATIVE`) with
    mandatory `Z` or numeric offset (`±HH:mm:ss`, `±HH:mm`, `±HHmmss`, `±HHmm`, `±HH`) and `0–9`
    fractional second digits, truncated toward floor epoch milliseconds via
    `Instant.toEpochMilli()` and capped at `64` characters.
  - JSON numbers and signed `10–19` digit epoch-millisecond strings; `null` and blank strings map
    to `null`; JSON objects and arrays are rejected via `handleUnexpectedToken`.
  - Exact 27-character `yyyy-MM-ddTHH:mm:ss.000dddZ` strings persisted by 2.0.0–2.0.7, normalized
    to `.dddZ` before strict parsing so stored entity JSON reads back its original `ddd`
    milliseconds without migration or spurious `ChangeDescription` diffs.

## Consequences

External producers (Airflow, Spark, dbt, Python `isoformat()`, JVM `Instant`) interoperate on
standard RFC-3339 timestamps without timestamp drift, server-emitted `Date` strings match their
millisecond precision, and existing 2.0.0–2.0.7 database rows round-trip losslessly on upgrade.
Sub-millisecond fractions from external callers lose sub-millisecond precision (`0.000dddZ` with
uppercase `T`/`Z` and three fractional digits after `.000` is interpreted as legacy `ddd`
milliseconds; all other sub-millisecond fractions truncate toward floor epoch milliseconds).
