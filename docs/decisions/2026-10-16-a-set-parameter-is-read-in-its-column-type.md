# An allowed or forbidden set is read as a Python literal or JSON, in its column's type

- **Status:** Accepted
- **Revisions:** v1 2026-10-16 (initial)
- **Deciders:** Shreyansh Verma
- **Guard:** `tests/unit/observability/data_quality/validations/test_utils.py` (`parse_set_values`, `is_boolean`), `test_validations_databases.py` (`..._boolean_strings`, `..._boolean_json`, `..._missing_column`), `test_validations_datalake.py` (`test_string_booleans_on_a_datalake_column_stay_strings`)
- **Related:** open-metadata/ai-platform#1650, #35274, #35276 (2.0 line); ADR:2026-10-12-test-cases-are-checked-against-their-definition-at-create

## Context

`columnValuesToBeInSet` and `columnValuesToBeNotInSet` parsed `allowedValues` / `forbiddenValues`
with `literal_eval`. The UI writes a set as a JSON array of strings, and a generated test writes a
JSON array, whose booleans and null are lowercase (`[false]`). `literal_eval` rejects JSON's
lowercase `false` / `true` / `null`, which aborted the test, and on a BOOLEAN column it kept
`"true"` / `"false"` as strings, which an engine such as Databricks refuses to compare with a
boolean.

## Decision

`parse_set_values` reads a set as a Python literal and, when `literal_eval` rejects it, as JSON.
`literal_eval` runs first, so a value it read before reads the same. A value neither reads still
Aborts the test, as before. A value that parses but is not a list (a bare string or number) is now
rejected with a ValueError, so it Aborts too. On a column typed BOOLEAN, `"true"` / `"false"` in
any case become booleans; nothing else is mapped.

The column type is the one OpenMetadata records for the column, which the SQL runner maps to
SQLAlchemy (`SQAValidatorMixin.get_set_values_type`). The pandas runner returns none, so a datalake
set keeps its values as written: `GenericDataFrameColumnParser` types a column of `"True"` /
`"False"` strings as BOOLEAN.

## Consequences

A set test no longer aborts on a JSON set, and on a column typed BOOLEAN `"true"` / `"false"`
compare as booleans. On a datalake the set is not typed, so its values compare as written. That is
deliberate: typing it by `GenericDataFrameColumnParser` would turn a set of `"True"` / `"False"`
strings into booleans, which the column's string values do not equal.
