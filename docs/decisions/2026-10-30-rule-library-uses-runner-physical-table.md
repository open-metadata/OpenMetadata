# SQLAlchemy Rule Library queries use the runner's physical table and execution bind

- **Status:** Accepted
- **Revisions:** v1 2026-10-30 (initial)
- **Deciders:** Ingestion maintainers
- **Guard:** `test_rule_library_sql_expression_validator.py`, `test_rule_library_thresholds.py`, `test_runner.py`, `test_physical_table_expression.py`
- **Related:** https://github.com/open-metadata/openmetadata-collate/issues/7374

## Context

Metadata database labels and entity FQNs describe catalog identity. They do not necessarily form a valid source SQL address: PostgreSQL selects its database through the connection, while ClickHouse and Oracle can have metadata-only database labels. Reconstructing SQL from those labels can select the wrong table or abort validation.

## Decision

SQLAlchemy Rule Library table references come from the runner's unsampled physical table and execution bind; rendered spelling may change while physical identity must remain stable. Both column and table rules use this reference, and their percentage denominator counts the same raw table. Samples and profile queries do not replace it.

The runner compiles the SQLAlchemy Table with the initialized connection's dialect and effective schema translation map. It returns logical SQL for display, undoing identifier percent escaping for format/pyformat dialects. At the Jinja table-name substitution boundary, the SQL validators escape identifier colons for TextClause parsing. Final compilation applies DBAPI escaping once; user values retain their existing bound parameters.

Connector adapters own database/catalog selection before execution. Missing physical tables raise an error that the existing test-suite boundary reports as Aborted.

## Consequences

SQL rules share the source identity already selected by the sampler and test-suite session. Metadata labels and dotted service names cannot alter the SQL address. New connectors must supply a physical Table and a correctly targeted session. Generic and Pandas validators retain their existing execution contracts.
