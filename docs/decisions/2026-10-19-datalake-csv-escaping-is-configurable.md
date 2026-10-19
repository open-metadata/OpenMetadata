# Datalake CSV escaping is configurable without changing the default

- **Status:** Accepted
- **Revisions:** v1 2026-10-19 (initial)
- **Deciders:** Luciano Viola
- **Guard:** `test_csv_escape_character_preserves_values`, `test_csv_dialect_reaches_schema_inference`
- **Related:** `DatalakeConnection.csvEscapeChar`

## Context

The Datalake reader treats backslash as an escape character. Files that use
doubled quotes and literal backslashes can lose characters or fail to parse.
Changing the default would break files that rely on backslash escaping.

## Decision

`csvEscapeChar` is an optional connection setting for CSV, compressed CSV,
and TSV. Omission keeps backslash escaping. An empty string disables escaping;
a nonempty value must be one character. Normalize the empty string to
`None` at the reader boundary. Metadata extraction, profiling, and data
quality use the same setting. Preserve any configured field separator.
The connection form preserves an empty string when the field is cleared.

## Consequences

Existing configurations need no migration. Users can select the file's dialect
without rewriting its contents. Deploy the updated server before sending the
new field from a client; older servers reject unknown connection fields.
This does not change quoting rules or add per-file dialect detection.
