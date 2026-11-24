# ClickZetta capability matrix

This page describes the ClickZetta connector capabilities and their execution boundaries. ClickZetta follows OpenMetadata's standard SQLAlchemy behavior where possible and keeps connector-specific code only for dialect or API differences.

## Current status

| Capability | Status | Notes |
| --- | --- | --- |
| Metadata extraction | Supported | Reads workspace, schema, table, view, and column metadata. |
| Usage extraction | Supported | Reads a configured native or custom query-history view with a time window and result limit. |
| Query lineage | Supported | Uses the same bounded query-history source and OpenMetadata's query parser. |
| Profiling | Supported | Uses the standard SQLAlchemy profiler. Configure OpenMetadata sampling when a full-table profile is not desired. |
| Sampling | Supported | Uses ClickZetta `TABLESAMPLE ROW` or `SYSTEM` for row-count and percentage sampling. OpenMetadata's sampling configuration controls method and size. |
| Data diff | Supported | Uses ClickZetta `DESCRIBE` for schema discovery and a ClickZetta data-diff dialect for generated comparison queries. Use a stable supported key. |
| Native test execution | Supported | Uses OpenMetadata's standard SQLAlchemy test-suite interface, including the validators supported by that interface. |
| DBT extraction | Supported | The standard DBT ingestion pipeline reads artifacts from local, HTTP, S3, or another configured source. It does not run DBT models. |

## Standard OpenMetadata execution boundaries

Profiling, sampling, data quality tests, custom SQL, and data diff can read table data and create ClickZetta jobs. The connector no longer adds private limits or an `allowFullTableScan` option that other SQLAlchemy connectors do not require. Operators control workload with OpenMetadata's normal configuration:

- Set profiler sample type, method, and size when a full-table profile is not desired.
- Apply database, schema, and table filters to ingestion workflows.
- Scope data-quality tests to the intended tables and review custom SQL before enabling it.
- Configure data diff with a stable key and appropriately scoped source and target tables.
- Keep usage and query-lineage windows and `resultLimit` bounded.

An omitted sampling configuration can cause standard profiler metrics such as row count to read the full table. Start production validation with explicitly named small tables and conservative settings.

For backward compatibility, an existing data-diff configuration with `allowFullTableScan=true` is accepted. An explicit legacy value of `false` must be removed before data diff is enabled, so the upgrade cannot silently change an operator's previous opt-out into permission to query table data.

## DBT behavior

DBT ingestion is an artifact workflow attached to the database service. It can read `manifest.json` plus optional `catalog.json`, `run_results.json`, and `sources.json`, then enrich existing OpenMetadata tables with DBT descriptions, owners, tags, tests, and lineage. It does not execute `dbt run`, `dbt compile`, or ClickZetta SQL.

For a DBT model merge:

1. Run `dbt parse` when only a refreshed manifest is needed, or use the approved affected-model job when runtime artifacts are required.
2. Upload the artifacts to a versioned object-store prefix.
3. Promote the artifact set atomically or update the pointer consumed by OpenMetadata.
4. Trigger the DBT ingestion pipeline.
5. Trigger ClickZetta metadata ingestion only when catalog structure changed, and usage/query-lineage ingestion when its history window needs refresh.

## Validation evidence

Offline tests compile ClickZetta core profiler metrics and all native sampling combinations: `ROWS` and `PERCENTAGE`, each with `ROW` and `SYSTEM`. They also verify standard profiler and test-suite registration, ClickZetta `DESCRIBE` schema loading, data-diff query execution, and standard capability defaults.

Earlier bounded live checks exercised metadata extraction, a 10-row sample, a count metric, a not-null validator, and typed-table data diff against explicitly named `seller_center` tables. These checks did not run a whole-schema profile or bulk production query.

## Query-history permission

The usage/query-lineage identity needs `SELECT` and metadata access to the configured native history view. For cross-workspace history this is normally `sys.information_schema.job_history`. The connector still applies the workflow time window, validated filters, and result limit after permission is granted.
