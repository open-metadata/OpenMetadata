# ClickZetta capability matrix

This page is the support contract for the ClickZetta connector in this branch. A capability is not advertised as supported merely because OpenMetadata has a generic SQLAlchemy implementation. It must be compatible with the ClickZetta dialect, bounded for the configured workload, and covered by unit, container, and live smoke evidence.

## Current status

| Capability | Status | Why |
| --- | --- | --- |
| Metadata extraction | Supported | The connector reads workspace/schema/table/column catalog structure. The existing seller-center probe completed successfully for one table. |
| Usage extraction | Code-supported; workspace-local live read passed | Native history mapping supports both `information_schema.job_history` and `sys.information_schema.job_history`. The workspace-local source passed a bounded live read; the cross-workspace source requires additional shared-system-schema permission. |
| Query lineage | Code-supported; live permission gate pending | It uses the same bounded native history source and canonical OpenMetadata query parser. |
| Profiling | Registered with explicit sampling/full-scan guards | ClickZetta ORM type conversion, core aggregate SQL compilation, metadata-only table metrics, and an explicit full-scan opt-in are implemented. Row-count metrics require `allowFullTableScan=true`; column metrics do not scan data. |
| Sampling | Registered with bounded ROWS-only guard | The connector requires a positive row `LIMIT` (maximum 1,000), rejects unbounded custom SQL, and disables percentage/random sampling. Sample storage remains subject to the normal OpenMetadata PII policy. |
| Data diff | Registered with explicit full-scan guard | The ClickZetta adapter uses `DESCRIBE` schema discovery, normalizes ClickZetta types, requires `allowFullTableScan=true` for data queries, and passed a temporary typed-table smoke test. Use a stable numeric/hash key; date columns are comparison values, not keys. |
| Native test execution | Registered with bounded read-only guard | Standard read-only validators use the bounded sampler; custom SQL, rule-library SQL, and table diff definitions are rejected. Use an explicit ROWS sample configuration for ClickZetta test runs. |
| DBT extraction | Separate source supported | OpenMetadata already ingests DBT artifacts from S3/local/HTTP/cloud. This is not executed by the ClickZetta SQL connector and does not run DBT models. |

## Why the remaining capabilities are guarded

`DefaultDatabaseSpec` supplies generic SQLAlchemy profiler, sampler, test-suite, and data-diff classes. The ClickZetta service spec registers connector-specific adapters for all four data capabilities. Each adapter fails closed outside its validated subset: sampling requires a bounded ROWS limit, native tests reject custom SQL and diff definitions, profiling rejects unsupported metrics and protects row-count scans, and data diff requires `allowFullTableScan=true` for data queries.

Profiling and sampling are data reads. They can scan rows, create ClickZetta jobs, expose sensitive values, and increase virtual-cluster cost. The sampler fails closed unless a row limit is configured, and row-count profiling requires the explicit `allowFullTableScan=true` opt-in in connection options or arguments. Data diff reads two data sets and computes keys/hashes; its adapter rejects data queries unless that same explicit opt-in is present. Native tests use the bounded sampler and reject custom SQL/data-diff definitions. Keep live validation to one explicitly named seller-center table at a time with a limit below 100.

DBT is different. The existing DBT source reads `manifest.json`, optional `catalog.json`, `run_results.json`, and `sources.json` from the configured artifact store. It enriches existing OpenMetadata tables with DBT descriptions, owners, tags, glossary/domain references, tests, and lineage. It does not query ClickZetta or execute `dbt run`. Keep the S3 DBT pipeline separate from ClickZetta metadata ingestion.

## Gates before enabling a capability

1. Add offline SQL/type tests first and observe them fail before implementation.
2. Implement the smallest connector-specific adapter; do not enable a generic fallback.
3. Run focused local tests, Ruff, JSON validation, and the same tests in the OpenMetadata 1.13.0 ingestion image.
4. Run one bounded live smoke test in `seller_center` using an explicitly named table and a configured limit. Never run a whole-schema profiler, sampler, test suite, or diff as the first live test.
5. Record the ClickZetta permission, query limit, runtime, and result. Do not record credentials or raw sensitive values.
6. Set the corresponding class/capability flag in `service_spec.py` and the connection schema only for the adapter whose offline and bounded live checks pass. Data diff, profiling, sampling, and native tests are now registered with their fail-closed guards; production runs still require explicit bounded configuration.

## Current production safety boundary

This branch has not changed the EC2 deployment, ClickZetta permissions, or the
running OpenMetadata instance. The ClickZetta service spec exposes metadata,
usage, lineage, and the guarded data-reading adapters. Do not set
`allowFullTableScan` in the production connection unless a data-diff or
row-count profile run is intentionally approved; use a separate workspace or
explicitly named mock tables for validation. All registered data-reading
adapters fail closed outside their explicit bounded configuration.

## DBT production sequence

For a DBT model merge, the safe artifact path is:

1. Run `dbt parse` (or the approved affected-model artifact job) without querying ClickZetta production.
2. Upload `manifest.json` and any available `catalog.json`, `run_results.json`, and `sources.json` to a versioned S3 prefix.
3. Promote the new artifact set atomically or update the pointer consumed by the OpenMetadata DBT pipeline.
4. Trigger the DBT ingestion pipeline. Use its table/schema filters so only affected models are patched.
5. Trigger ClickZetta metadata ingestion only when catalog structure changed, and trigger usage/query-lineage ingestion only when the history window needs refresh.

The `supportsDBTExtraction` connection flag remains false until the attached DBT UI workflow is separately validated. It is not required for the S3 DBT source.

## Bounded live smoke evidence

On 2026-08-06, the registered sampler/profiler/test path was exercised against
the explicitly named `seller_center.raw__lazada_dashboard_key_metrics` table in
the pinned ClickZetta image. The generated query returned 10 rows with
`LIMIT 10`, a sample count metric returned 10, and a bounded not-null check
completed. No full-table row count, data diff, sample-storage upload, or whole
schema workflow was run. Row-count profiling and data diff remain opt-in via
`allowFullTableScan=true`.

## External permission gate for native history

The usage/query-lineage source requires a least-privilege ClickZetta role that can read the native history object and the catalog objects used by the configured filters. Until that grant is made, a live `LIMIT 0` probe is expected to fail with a permission error; do not compensate by granting broad production access.
