# Rule-library failed rows samples are the rule's own rows, stored only when they name the table's columns

- **Status:** Accepted
- **Revisions:** v1 2026-11-12 (initial)
- **Deciders:** Data Quality maintainers
- **Guard:** `test_rule_library_failed_rows_sample.py`, `test_table_rule_library_sql_expression.py::test_aggregate_rule_output_is_not_stored_as_a_sample` (Postgres and MySQL)
- **Related:** #37594, ADR:2026-10-09-failed-rows-sample-follows-failed-rows-not-status

## Context
Test Library (`sqlExpression`) tests counted the rows their SQL returned and threw them away, so no
failed rows sample was ever stored. Custom SQL tests sample by running their query a second time
and post the sample with `validateColumns=false`. A second scan is costly on large tables and can
return different rows. The server masks a sample's PII by column name only, so skipping its column
check would let a definition such as `SELECT ssn AS id_number …` serve unmasked values, and a
Test Library definition is reused by every test case built on it.

## Decision
A rule-library validator keeps up to `FAILED_ROW_SAMPLE_SIZE` (50) of the rows its SQL or pandas
expression already returned, and never runs a second query. The sample is posted with the server's
column validation on. On SQL sources the sample is kept only when every output column matches a
column of the table, case-insensitively, as the server's check does; aggregate or aliased output is
not stored, and the run logs that at info level. The inspection query is the executed SQL with its
bind parameters rendered as literals, and it is stored even when the sample is not. Pandas
expressions return the frame's own columns, so they are always sampled, and they have no
inspection query.

## Consequences
Samples cost no extra query and show the rows that were counted. Rules that aggregate or rename
columns get no sample. An alias to another existing column name, or a join that returns another
table's column under a name this table has, is masked by this table's tags: the same limit as
custom SQL. Revisit if the server learns to mask by source column rather than by name.
