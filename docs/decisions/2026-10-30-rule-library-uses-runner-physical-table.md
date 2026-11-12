# SQLAlchemy Rule Library queries use the runner's physical table and execution bind

- **Status:** Accepted
- **Revisions:** v1 2026-10-30 (initial)
- **Deciders:** Ingestion maintainers
- **Guard:** `test_rule_library_sql_expression_validator.py`, `test_rule_library_thresholds.py`, `test_rule_library_suite_construction.py`, `test_runner.py`, `test_physical_table_expression.py`, BigQuery and IOMETE `test_table_context.py`
- **Related:** https://github.com/open-metadata/openmetadata-collate/issues/7374

## Context

Metadata database labels and entity FQNs describe catalog identity. They do not necessarily form a valid source SQL address: PostgreSQL selects its database through the connection, while ClickHouse and Oracle can have metadata-only database labels. Reconstructing SQL from those labels can select the wrong table or abort validation.

The runner already holds the physical table and execution session. Reusing them keeps connector qualification rules in one place. BigQuery additionally separates the project containing data from the project paying for a query; IOMETE allows the execution connection to override the catalog recorded in metadata.

## Decision

SQLAlchemy Rule Library table references come from the runner's unsampled physical table and execution bind; rendered spelling may change while physical identity must remain stable. Both column and table rules use this reference, and their percentage denominator counts the same raw table. Samples and profile queries do not replace it.

The runner compiles the SQLAlchemy Table with the initialized connection's dialect and effective schema translation map. It returns logical SQL for display, undoing identifier percent escaping for format/pyformat dialects. At the Jinja table-name substitution boundary, the SQL validators escape identifier colons for TextClause parsing. Final compilation applies DBAPI escaping once; user values retain their existing bound parameters.

The runner exposes `get_table_reference()` as an explicit method called within per-case validation. Timeout wrapping inspects attributes during construction, so a property would acquire a connection too early. Wrapping the runner must not acquire a source connection; missing or unsupported physical tables produce per-case Aborted results.

Connector adapters own database/catalog selection before execution through existing ServiceSpec extension points:

- BigQuery's data-quality adapter resolves the attached table's Database and DatabaseSchema and copies the engine's public `schema_translate_map`, mapping the table's schema to `project.schema`. The table's entry is authoritative; unrelated mappings and options remain intact. The adapter binds an OptionEngine through the existing session factory before inherited runner/timeout construction, preserving qualification after rollback or connection recheckout. Rule text and the ORM denominator use the same map. Missing metadata context raises before engine creation. The original engine, mapped model, connection configuration, SDK client defaults and billing settings remain unchanged.
- IOMETE uses its inherited sampler, test-suite and profiler. The execution connection selects the catalog, including explicit runtime overrides of the ingested catalog. An unset catalog remains unset; an explicitly named `default` remains physical. The metadata Database label does not replace that selection. Both rule levels and their denominator use the runner's schema/table in the selected catalog.

## Consequences

SQL rules share the physical table and execution context used by their denominator. Metadata-only labels and dotted service names cannot alter the SQL address. IOMETE rules follow the runtime catalog when it differs from the ingested catalog, aligning them with their existing denominator. New connectors must supply a physical Table and a correctly targeted session. Generic and Pandas validators retain their existing contracts.

BigQuery qualification is confined to the data-quality session through public SQLAlchemy options. Lazy sample queries can use that session's map at execution; eager randomized-row sampling can query through the sampler's separate session before data-quality construction. Profiler queries and user-authored sample SQL retain their existing resolution policies. This decision establishes source qualification for Rule Library rules and their denominator; sampling and profiling have separate execution paths.

The guards cover physical target/denominator agreement, identifier handling, deferred rendering, registered constructors, runtime catalog overrides, rollback recovery and configuration isolation. BigQuery and IOMETE driver-boundary tests substitute external responses; live source resolution requires separate service validation.
