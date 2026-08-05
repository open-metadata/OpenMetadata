# ClickZetta capability matrix

This page is the support contract for the ClickZetta connector in this branch. A capability is not advertised as supported merely because OpenMetadata has a generic SQLAlchemy implementation. It must be compatible with the ClickZetta dialect, bounded for the configured workload, and covered by unit, container, and live smoke evidence.

## Current status

| Capability | Status | Why |
| --- | --- | --- |
| Metadata extraction | Supported | The connector reads workspace/schema/table/column catalog structure. The existing seller-center probe completed successfully for one table. |
| Usage extraction | Code-supported; live permission gate pending | Native history mapping is implemented. The ingestion identity still needs read access to `sys.information_schema.job_history`. |
| Query lineage | Code-supported; live permission gate pending | It uses the same bounded native history source and canonical OpenMetadata query parser. |
| Profiling | Offline implementation complete; live registration pending | ClickZetta ORM type conversion, core aggregate SQL compilation, metadata-only table metrics, and an explicit full-scan opt-in are implemented. A bounded live profile is still required before the service spec is enabled. |
| Sampling | Offline implementation complete; live registration pending | The connector now requires a positive row `LIMIT` (maximum 1,000), rejects unbounded custom SQL, and disables percentage/random sampling. A bounded seller-center smoke test and sample-storage/PII review are still required. |
| Data diff | Offline adapter complete; live registration pending | An opt-in `data-diff` adapter, ClickZetta DB-API dialect, schema SQL, and explicit `allowFullTableScan=true` guard are implemented. No data-diff service registration or production scan is enabled. |
| Native test execution | Offline adapter complete; live registration pending | Standard read-only validators use the bounded sampler; custom SQL, rule-library SQL, and table diff definitions are rejected. A bounded seller-center test run is still required. |
| DBT extraction | Separate source supported | OpenMetadata already ingests DBT artifacts from S3/local/HTTP/cloud. This is not executed by the ClickZetta SQL connector and does not run DBT models. |

## Why the five capabilities were disabled

`DefaultDatabaseSpec` supplies generic SQLAlchemy profiler, sampler, test-suite, and data-diff classes. The ClickZetta service spec still overrides all four with `None`, even though this branch now contains connector-specific adapters, so a user cannot accidentally launch an unvalidated data read against ClickZetta. The adapters register the ClickZetta dialect and common type mapping only in the ingestion code path; service capability registration remains the final live gate.

Profiling and sampling are data reads. They can scan rows, create ClickZetta jobs, expose sensitive values, and increase virtual-cluster cost. The sampler fails closed unless a row limit is configured, and row-count profiling requires the explicit `allowFullTableScan=true` opt-in in connection options or arguments. Data diff reads two data sets and computes keys/hashes; its adapter rejects data queries unless that same explicit opt-in is present. Native tests use the bounded sampler and reject custom SQL/data-diff definitions. Each feature still needs its own bounded seller-center smoke test before service registration.

DBT is different. The existing DBT source reads `manifest.json`, optional `catalog.json`, `run_results.json`, and `sources.json` from the configured artifact store. It enriches existing OpenMetadata tables with DBT descriptions, owners, tags, glossary/domain references, tests, and lineage. It does not query ClickZetta or execute `dbt run`. Keep the S3 DBT pipeline separate from ClickZetta metadata ingestion.

## Gates before enabling a capability

1. Add offline SQL/type tests first and observe them fail before implementation.
2. Implement the smallest connector-specific adapter; do not enable a generic fallback.
3. Run focused local tests, Ruff, JSON validation, and the same tests in the OpenMetadata 1.13.0 ingestion image.
4. Run one bounded live smoke test in `seller_center` using an explicitly named table and a configured limit. Never run a whole-schema profiler, sampler, test suite, or diff as the first live test.
5. Record the ClickZetta permission, query limit, runtime, and result. Do not record credentials or raw sensitive values.
6. Only then set the corresponding class/capability flag in `service_spec.py` and the connection schema.

## Current production safety boundary

This branch has not changed the EC2 deployment, ClickZetta permissions, or the
running OpenMetadata instance. The ClickZetta service spec continues to expose
metadata, usage, and lineage only. Do not set `allowFullTableScan` in the
production connection for the current validation; use a separate non-production
workspace/table for the future profiling, native-test, and data-diff smoke
gates.

## DBT production sequence

For a DBT model merge, the safe artifact path is:

1. Run `dbt parse` (or the approved affected-model artifact job) without querying ClickZetta production.
2. Upload `manifest.json` and any available `catalog.json`, `run_results.json`, and `sources.json` to a versioned S3 prefix.
3. Promote the new artifact set atomically or update the pointer consumed by the OpenMetadata DBT pipeline.
4. Trigger the DBT ingestion pipeline. Use its table/schema filters so only affected models are patched.
5. Trigger ClickZetta metadata ingestion only when catalog structure changed, and trigger usage/query-lineage ingestion only when the history window needs refresh.

The `supportsDBTExtraction` connection flag remains false until the attached DBT UI workflow is separately validated. It is not required for the S3 DBT source.

## External permission gate for native history

The usage/query-lineage source requires a least-privilege ClickZetta role that can read the native history object and the catalog objects used by the configured filters. Until that grant is made, a live `LIMIT 0` probe is expected to fail with a permission error; do not compensate by granting broad production access.
