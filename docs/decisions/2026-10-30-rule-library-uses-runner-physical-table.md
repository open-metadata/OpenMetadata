# SQLAlchemy Rule Library queries use the runner's physical table and execution bind

- **Status:** Accepted
- **Revisions:** v1 2026-10-30 (initial) · v2 2026-11-02 (connector default context) · v3 2026-11-02 (defer table rendering) · v4 2026-11-02 (BigQuery query project and settings isolation)
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

## Amendment: connector default context

Connector-owned context selection must distinguish physical catalog names from synthetic metadata labels. When IOMETE has no configured catalog, ingestion uses the driver's default catalog but names its metadata Database `default`. Its sampler, test-suite and profiler preserve the unset connection catalog for that label. An explicitly configured `default` catalog remains physical, and a resolved Database with another name selects that catalog.

BigQuery copies the attached Database's project into inline, key-file and ADC credentials before creating the test-suite session, including when the configured project is absent or scalar. Billing and authentication settings remain unchanged. External-account credentials have no project field and retain their existing default resolution.

The connector `test_table_context.py` suites guard these cases, including original-config isolation and session selection.

## Amendment: defer table rendering until execution

The runner exposes `get_table_reference()` as an explicit method. Timeout wrapping inspects runner attributes while constructing interfaces; a property would acquire a source connection during that inspection and reject missing raw tables before any case can report a result. Both SQL validators call the method within per-case validation, where missing or unsupported raw tables produce Aborted results. Wrapping the runner alone must not acquire a source connection. `test_rule_library_suite_construction.py` guards this through the normal sampler and test-suite constructors.

## Amendment: BigQuery query project and settings isolation

BigQuery's data project must remain independent of its billing client project. The dialect omits its computed project settings for supplied clients, and external-account credentials have no project field to carry a table-specific target. The connector therefore resolves the attached table's Database and binds its project through the engine's supported `job_config` execution option. Sampling, profiling and test-suite sessions all apply this same helper before creating sessions.

The helper copies existing job settings and replaces only the `dataset_project_id` connection property. Other properties and fields survive; a minimal configuration still permits the client's defaults to merge at execution. Credentials, client billing, endpoints and original engine settings remain unchanged.

The BigQuery DBAPI mutates job settings when adding bound parameters. An `engine_connect` listener on the returned engine gives each SQLAlchemy Connection its own copy, isolating concurrent sessions and other target engines. `test_table_context.py` guards real driver/DBAPI requests, deterministic interleaving, client defaults and object isolation without cloud queries.
