# Evidence for the Delta Lake detection decision

Supports [../delta-lake-detection-decision.md](../delta-lake-detection-decision.md). Research dates: 2026-09-24, 2026-09-25, and 2026-10-07 (real-AWS Glue run).

| File | Covers |
|---|---|
| audit-A-deltalake-impact.md | What users of the dedicated `deltalake` connector lose on deprecation |
| audit-B-lake-engines.md | glue, athena, redshift, trino, presto, hive, impala, iomete, starrocks, doris, clickzetta, datalake; also the Iceberg unit-test shapes to copy |
| audit-C-warehouses.md | databricks, unitycatalog, snowflake, bigquery, mssql, azuresql, clickhouse, vertica, teradata, exasol, druid, pinotdb, singlestore, salesforce, data360, domodatabase, greenplum |
| audit-D-sweep.md | All remaining connectors |
| delta-metadata-fidelity.md | Which metadata each in-scope connector already supplies for a Delta table |
| live-trino-delta-detection.md | Live run on Trino 418: detection confirmed |
| live-presto-delta-detection.md | Live run on PrestoDB 0.290: detection refuted |
| live-starrocks-delta-detection.md | Live run on StarRocks 3.2.16: detection confirmed, casing suspicion refuted |
| live-hive-delta-detection.md | Live run on a Hive metastore: per-table indicator confirmed, no false positive |
| live-glue-delta-detection.md | Part 1 emulator (moto); part 2 **real AWS**: real `_delta_log`, real Athena DDL producer, real `metadata ingest`. Corrects the documented `table_type` case; crawler blocked, Spark skipped |

How to read them:
- The audit reports are documentation and code research. Their rows are **verified live: no**, except where a live-run
  file says otherwise. **The live-run files override the audits where they disagree** (Presto and StarRocks).
- Code claims cite `file:line` in this repository; vendor claims cite a documentation or upstream-source URL.
- "No evidence found" means a documentation search found nothing. It is not proof of absence.
- Each audit ends with an UNVERIFIED list, which is the to-do list for live verification.
- Reports refer to `<repo>` (this repository), `<scratchpad>` and `<workspace>` (local paths removed) and to an
  earlier draft matrix. That draft was superseded and removed because the audits found it wrong on several rows.
