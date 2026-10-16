# An allowed or forbidden set is read as a Python literal or JSON, in its column's type

- **Status:** Accepted
- **Revisions:** v1 2026-10-16 (initial)
- **Deciders:** Shreyansh Verma
- **Guard:** `tests/unit/observability/data_quality/validations/test_utils.py` (`parse_set_values`, `is_boolean`), `test_validations_databases.py` (`..._boolean_strings`, `..._boolean_json`, `..._missing_column`), `test_validations_datalake.py` (`test_string_booleans_on_a_datalake_column_stay_strings`)
- **Related:** open-metadata/ai-platform#1650, #35274, #35276 (2.0 line); ADR:2026-10-12-test-cases-are-checked-against-their-definition-at-create

## Context

`columnValuesToBeInSet` and `columnValuesToBeNotInSet` parsed `allowedValues` / `forbiddenValues`
with `literal_eval`. Clients write these parameters differently: the UI writes a JSON array of
strings, a generated test writes JSON (`[false]`), older test cases hold Python literals
(`[True, False]`). `literal_eval` rejects JSON's lowercase `false` / `true` / `null`, which aborted
the test, and on a BOOLEAN column it kept `"true"` / `"false"` as strings, which an engine such as
Databricks refuses to compare with a boolean.

## Decision

`parse_set_values` reads a set as a Python literal and, when it is not one, as JSON; where both
parse a value they agree, so nothing that parsed before reads differently. A value that is neither
raises ValueError and the test is Aborted, as before. A value that parses but is not a list (a bare
string or number) is now rejected the same way, rather than compared as a single value. On a
column whose engine type is boolean, `"true"` / `"false"` in any case become booleans; nothing
else is mapped.

The column type is the engine's (`SQAValidatorMixin.get_set_values_type`). Pandas returns none, so
a datalake set keeps its values as written: pandas infers column types from the values, and a
column of `"True"` / `"False"` strings reads as BOOLEAN.

## Consequences

A set written by any client compares the same way, and a set test no longer aborts on JSON. A
boolean column read through pandas still compares as strings; that is deliberate, not an omission.
