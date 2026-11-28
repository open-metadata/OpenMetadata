# Rule-library failed rows samples preserve source column identity

- **Status:** Accepted
- **Revisions:** v1 2026-11-12 (initial); v2 2026-11-19 (source identity and deliberate sample invalidation)
- **Deciders:** Data Quality maintainers
- **Guard:** `test_rule_library_failed_rows_sample.py`, `postgres/test_table_rule_library_sql_expression.py::test_aggregate_rule_output_is_not_stored_as_a_sample`, `mysql/test_table_rule_library_sql_expression.py::test_mysql_aggregate_rule_output_is_not_stored_as_a_sample`
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
column validation on. On SQL sources a bounded SQLGlot AST check accepts only a single SELECT from
the linked physical table, with unchanged direct source columns or plain stars. Table aliases and
identity column aliases are accepted. Renamed outputs, expressions, joins, CTEs, derived tables,
set operations, modified stars, executable SQL comments, and uncertain parsing or source identity are omitted.
Executable-comment markers are rejected before parsing because SQLGlot discards content that MySQL or
MariaDB may execute. MySQL/MariaDB queries containing backslashes or a double dash are also omitted.
SQL modes can change literal boundaries, and SQLGlot can interpret a double dash differently from
the server. This supersedes
v1's unsafe output-name membership rule: `SELECT ssn AS status` must not inherit `status`'s tags.
Classification and conversion happen during sample collection so they cannot invalidate counts or
verdicts. The inspection query is the executed SQL with its
bind parameters rendered as literals, and it is stored even when the sample is not. Pandas
validators keep up to 50 raw matching rows and convert them only when the enabled sample hook
runs. Pandas has no inspection query.

When the enabled sample hook completes successfully and returns no sample, an internal clear flag
instructs the REST sink to delete the preceding sample through the existing endpoint. A missing
sample caused by disabled collection or a fetch exception does not clear it. Result ingestion remains
first and inspection-query ingestion remains independent; DELETE 404 is idempotent and other deletion
errors are reported without changing the validation result. No public schema or API changes are needed.

## Consequences
Samples cost no extra query and show the rows that were counted. Rules that aggregate or rename
columns get no sample. An alias to another existing column name and output from joined tables are
also omitted, preventing values from being masked using unrelated column tags. A deliberately omitted
current sample no longer leaves an older sample visible. Conservative source matching may omit safe
queries whose syntax or physical-table qualification cannot be established; their counts and verdicts
remain available. Column-removal retention policy remains separate work in #37485.
