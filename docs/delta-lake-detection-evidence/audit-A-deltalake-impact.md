# Audit A: what users of the dedicated `deltalake` connector lose on deprecation

REPO = <repo> (HEAD 5c69bb45b4). All paths below are relative to REPO unless absolute.
Short forms: SRC = `ingestion/src/metadata/ingestion/source/database/deltalake`, SPEC = `openmetadata-spec/src/main/resources/json/schema/entity/services/connections/database`.

## Bottom line

1. The connector has two families of config. (a) **Metastore** (Hive metastore via Thrift / JDBC DB / local Derby file), served by a PySpark session with the Delta extension + DeltaCatalog. (b) **Storage** (S3 only, incl. MinIO via endpoint URL), served by the `deltalake` (delta-rs) Python lib, which opens `_delta_log` directly.
2. **Storage/S3 mode is the one with NO catalog-detection equivalent.** It is the only way today to ingest Delta tables that live in a bucket with no catalog at all (no Glue, no Hive, no Unity). It reads `_delta_log` metadata and gets: table name (from Delta metadata name, else folder), description (Delta table description), partition columns, and columns. Glue/Athena/Trino/etc. cannot supply this for tables that are not registered in a catalog. Users with un-catalogued Delta on S3/MinIO lose ingestion entirely.
3. **Metastore mode is a catalog read** (Spark catalog listTables + DESCRIBE) that another connector *could* replace if that metastore is fronted by a supported connector. But it is a *generic* Hive-metastore reader: nothing in the code filters to Delta tables. Users whose metastore is a plain Hive Metastore reachable only via Thrift/JDBC/Derby have NO replacement connector unless the `hive` connector (or another) is pointed at the same thing; that is not established here (see UNVERIFIED).
4. Field-level loss even where a replacement connector exists: the dedicated connector's `CreateTableRequest` sets only name, tableType, description, columns, partition (S3 mode only), view definition (Spark mode). The catalog-detection approach (per the untracked draft docs and issue #5992/#5994) sets only a new TableType plus whatever the host connector already emits, and explicitly does not open `_delta_log`. Known accepted degradations in the draft: Glue Spark-registered Delta tables show a degenerate single `col array<string>` column; Presto detection-only; partitioned Delta tables on athena/trino/presto report `Partitioned` not the Delta type.
5. **Discrepancy to flag to the team:** openmetadata-collate#5992 body says "This work does not replace the dedicated Delta Lake connector and is not a migration". I found NO issue in either repo about deprecating the connector (Section 6). So "deprecate" is not backed by a tracked issue that I could find.
6. Existing open gap that shows the S3 mode is being asked to grow, not shrink: OpenMetadata#27491 (Delta table detection in ADLS for Datalake-Azure) is OPEN. The dedicated connector supports S3 only; the `datalake` connector has no Delta folder detection (Section 4).

---

## 1. Supported configurations and client classes

### Connection schema
- `SPEC/deltaLakeConnection.json:26-35`: `configSource` is `oneOf` `./deltalake/metastoreConfig.json` | `./deltalake/storageConfig.json`; `configSource` is `required` (last lines of file).
- Other properties: `databaseName` (line ~33), `connectionArguments` (`:40-44`, described "If using Metastore, Key-Value pairs that will be used to add configs to the SparkSession"), schema/table/database filter patterns, `supportsMetadataExtraction`, `supportsDBTExtraction`.

### Dispatch
- `SRC/connection.py:50-75`: singledispatch `get_deltalake_client`. `MetastoreConfig` -> `DeltalakePySparkClient.from_config` (`:59-65`); `StorageConfig` -> `DeltalakeS3Client.from_config` only `if isinstance(connection.connection, S3Config)` (`:68-75`); any other storage connection type returns `None` (no error branch).
- `SRC/service_spec.py:5-8`: `DefaultDatabaseSpec(metadata_source_class=DeltalakeSource, connection_class=DeltaLakeConnection)`.
- Base interface: `SRC/clients/base.py:43-75` (`get_database_names`, `get_database_schema_names`, `get_table_info`, `update_table_info`, `close`, test-connection fns).

### Metastore variants (`SPEC/deltalake/metastoreConfig.json`) -> `SRC/clients/pyspark.py` (`DeltalakePySparkClient`)
| Variant | Schema line | How the client uses it |
|---|---|---|
| `metastoreHostPort` (Hive Metastore Service, Thrift, e.g. localhost:9083) | `metastoreConfig.json:13` | `pyspark.py:86-93` sets `hive.metastore.uris = thrift://<hostPort>` |
| `metastoreDb` (JDBC to metastore DB) + `username`, `password`, `driverName`, `jdbcDriverClassPath` | `metastoreConfig.json:25` onward | `pyspark.py:95-120` sets `spark.hadoop.javax.jdo.option.ConnectionURL/UserName/Password/DriverName`, `spark.driver.extraClassPath` |
| `metastoreFilePath` (local Derby `metastore.db`) | `metastoreConfig.json:58` | `pyspark.py:121-132` sets `spark.driver.extraJavaOptions=-Dderby.system.home=<path>` |
| `appName` (default "OpenMetadata") | `metastoreConfig.json:83` | `pyspark.py:74` |

Mechanism (all three variants): a PySpark session built with `.enableHiveSupport()`, `spark.sql.extensions=io.delta.sql.DeltaSparkSessionExtension`, `spark.sql.catalog.spark_catalog=org.apache.spark.sql.delta.catalog.DeltaCatalog`, `spark.jars.packages=io.delta:delta-spark_2.12:3.2.0` (`pyspark.py:73-83`, `:137`). Extra Spark configs from `connectionArguments` are applied at `:134-135`. Databases = `spark.catalog.listDatabases()` (`:143-146`); tables = `spark.catalog.listTables(dbName)` (`:148-160`); columns = `spark.sql("describe <schema>.<table>")` + `spark.table(...).schema` (`:237-261`); view text = `describe extended` (`:218-235`).

Whether Spark's DESCRIBE/schema on a Delta table is answered from `_delta_log` or from the metastore: the Delta docs (https://docs.delta.io/latest/delta-batch.html, fetched) say: "The metastore is not the source of truth about the latest information of a Delta table. In fact, the table definition in the metastore may not contain all the metadata like schema and properties. It contains the location of the table, and the table's transaction log at the location is the source of truth." So Spark+DeltaCatalog reads the log *inside the Spark JVM* for Delta tables. The OM code itself never touches `_delta_log`. Which tables actually go through that path in practice: UNVERIFIED (not run).

### Storage variant (`SPEC/deltalake/storageConfig.json`) -> `SRC/clients/s3.py` (`DeltalakeS3Client`)
- `storageConfig.json:20-25`: `connection` `oneOf` has exactly ONE entry, `../datalake/s3Config.json`. So S3 (and S3-compatible via `endPointURL`, MinIO: `s3.py:63-67`, `:76-77` sets `AWS_ALLOW_HTTP`). No GCS, no Azure, no local.
- Extra properties `bucketName` and `prefix` (`storageConfig.json` properties block).
- Mechanism: `from deltalake import DeltaTable` (`s3.py:22`); `DeltaTable(url, storage_options=..., without_files=True)` (`s3.py:105-117`). This is delta-rs opening the table's `_delta_log` (Delta protocol: log is JSON files in `_delta_log` at table root, holding the `metaData` action with `schemaString`, `partitionColumns`, `configuration`; https://raw.githubusercontent.com/delta-io/delta/master/PROTOCOL.md, fetched).
- Discovery: recursive folder walk through `DatalakeS3Client.get_folders_prefix` trying `DeltaTable` on each prefix, descending only when no Delta table is found (`s3.py:125-144`). Schemas = bucket names (`s3.py:101-103`; integration test comment "schema name is the bucket name", `ingestion/tests/integration/sources/database/delta_lake/test_deltalake_storage.py:143`).

## 2. Metadata ingested per table (CreateTableRequest)

Single builder for both modes: `SRC/metadata.py:216-247` (`yield_table`).
`CreateTableRequest(name, tableType, description, columns, tableConstraints=None, databaseSchema, schemaDefinition=view_definition, tablePartition)`. Nothing else: no owners, tags (`yield_tag` is a no-op, `metadata.py:263-264`), no extension/properties, no location field, no constraints, no sample data, no stored procedures (`:266-273`).

| Field | Metastore/PySpark mode | Storage/S3 mode |
|---|---|---|
| name | `table.name` from `listTables` (`pyspark.py:157`) | Delta metadata `name`, else last prefix segment, else metadata id (`s3.py:130`) |
| tableType | `TABLE_TYPE_MAP` MANAGED->Regular, VIEW->View, EXTERNAL->External, default Regular; TEMPORARY skipped (`pyspark.py:51-55`, `:151-153`, `:159`) | always `TableType.Regular` (`s3.py:136`) |
| description | `table.description` from Spark catalog (`pyspark.py:158`) | Delta `metadata().description` (`s3.py:135`) |
| columns | parsed from DESCRIBE via `ColumnTypeParser` (`pyspark.py:187-216`, `:237-261`); column comment only in the fallback branch (`:211`) | `ParquetDataFrameColumnParser(data_frame=table.to_pandas()).get_columns()` (`s3.py:119-120`): types are inferred from a pandas DataFrame, and `to_pandas()` materialises table data (source of type-fidelity and cost concerns; behaviour on large tables UNVERIFIED, not run) |
| partitions | NOT populated. `TableInfo.table_partitions` is never set in `get_table_info` (`pyspark.py:155-160`) and `update_table_info` just copies it (`:170`); the partition rows in DESCRIBE are skipped (`:250-259`) | populated from `table.metadata().partition_columns` (`s3.py:122-123`, `:155`) |
| location | `TableInfo.location` never set (`pyspark.py:155-171`) and not sent to the server in either mode (`metadata.py:230-247`) | used internally only (`s3.py:134`) |
| table properties | not ingested | not ingested |
| views | yes; view SQL from `describe extended` "View Text" -> `schemaDefinition` (`pyspark.py:218-235`, `metadata.py:225`) gated by `includeViews` (`metadata.py:204-209`) | not applicable (all Regular) |
| filtering | schema and table filter patterns, `useFqnForFiltering` (`metadata.py:139-146`, `:187-195`) | same |
| non-Delta tables | NOT filtered out: every non-temporary table in the Hive metastore is ingested (`pyspark.py:150-160`, no format check). Related upstream note in OpenMetadata#14885: "double-check how we are listing & filtering tables in the connector to only fetch delta tables" | only Delta tables found |

Other capabilities:
- Test connection steps GetDatabases/GetTables: `SRC/connection.py:98-101`; definition `openmetadata-service/src/main/resources/json/data/testConnections/database/deltalake.json`.
- Lineage dialect mapping `DeltaLake -> Dialect.SPARKSQL`: `ingestion/src/metadata/ingestion/lineage/models.py:152` (used by other lineage code; not an ingestion feature of this connector).
- `DeltaLake` is in `NON_SQA_DATABASE_CONNECTIONS` (`ingestion/src/metadata/utils/constants.py:193`). Profiler/DQ: issue OpenMetadata#8515 (CLOSED) and #13040 (CLOSED) requested profiler support; whether profiler works for this service today: UNVERIFIED.

## 3. Which configurations read the transaction log directly

- **Storage/S3 (delta-rs): reads `_delta_log` directly, from OM's own process** (`s3.py:105-117`). No catalog involved. **No catalog-detection equivalent.** The replacement approach cannot cover it, by design (#5994: "without opening Delta transaction logs from connectors that only expose catalog metadata").
  - Sub-case that is fully uncovered: Delta tables in S3/MinIO with no Glue/Hive/Unity registration.
  - Sub-case partially covered: Delta tables in S3 that ARE registered in Glue (Glue/Athena detection would see them, with the caveats in bottom line #4).
- **Metastore (PySpark): reads the catalog via Spark; Spark itself consults `_delta_log` for Delta tables** (Delta docs quote above). From the OM code's perspective it is a catalog read (`listDatabases`, `listTables`, `DESCRIBE`). Replaceable only by a connector that can reach the same metastore:
  - Hive Metastore Thrift/JDBC/Derby: the `hive` connector exists in the repo, but I did not verify that it can connect to these three forms or detect Delta; the draft matrix marks redshift/hive "connector access not established" (`docs/delta-lake-detection-connector-matrix.md`, untracked). UNVERIFIED.
  - If the metastore is AWS Glue: Glue connector (draft in scope). If Unity Catalog: unitycatalog connector (draft in scope). These are not options in the dedicated connector's schema, so users of those catalogs would not have used it via Hive Thrift unless they exposed a Hive-compatible endpoint. UNVERIFIED.
- Note the metastore path has effectively no CI coverage: `ingestion/pyproject.toml:79` `addopts = "--ignore=ingestion/tests/unit/topology/database/test_deltalake.py ..."`, and that test is `skipUnless(sys.version_info < (3, 11))` (`ingestion/tests/unit/topology/database/test_deltalake.py:103-106`, referencing OpenMetadata#14408). CI Python is 3.10 per CLAUDE.md, but the file is ignored via addopts regardless. Only S3 mode has an integration test (`ingestion/tests/integration/sources/database/delta_lake/test_deltalake_storage.py:142-151`, asserts name, description, first partition column).

## 4. Does the `datalake` connector ingest Delta tables today?

**NOT FOUND** as Delta-aware behaviour.
- `grep -rniE "delta" ingestion/src/metadata/ingestion/source/database/datalake/` -> zero matches (exit 1).
- `_delta_log` handling: no match anywhere in datalake source. The only `_delta_log` mentions outside the deltalake connector are in storage-container manifest schemas as an ignore-list default: `openmetadata-spec/.../metadataIngestion/storage/manifestMetadataConfig.json:64` and `containerMetadataConfig.json:66` ("Path segments to skip during glob discovery ... _delta_log, _temporary, ..."), i.e. the S3/GCS *storage* connector skips it, not ingests it.
- The datalake connector treats each object as a table: `ingestion/src/metadata/ingestion/source/database/datalake/metadata.py:231-253` iterates `client.get_table_names(...)`, derives a file extension, and skips keys with no supported extension. Supported extension list includes parquet variants (`ingestion/src/metadata/readers/dataframe/reader_factory.py:39-64`). So Delta table folders are NOT recognised as one asset. This is consistent with OpenMetadata#27491 (OPEN): "the connector is treating each file as a separate asset". Actual outcome for a Delta folder if run: UNVERIFIED (I did not run it).
- Only Delta-flavoured code in shared datalake utils: `ingestion/src/metadata/utils/datalake/datalake_utils.py:710-800`, a *JSON file* column parser that handles a JSON file with top-level `schema.fields` (`_is_iceberg_delta_metadata`, `:721-732`). Tests: `ingestion/tests/unit/utils/test_datalake.py:670-818`. Per the Delta protocol the schema lives at `metaData.schemaString` in log entries, not `schema.fields`; I did not test whether a `_delta_log/*.json` commit file would match that parser, and in any case the connector has no logic to look inside `_delta_log`. Treat this as an Iceberg-style metadata.json parser, UNVERIFIED for real Delta logs.
- Datalake storage backends: local, Azure, GCS, S3 (`SPEC/datalakeConnection.json:34-46`); the dedicated Delta connector only supports S3 (Section 1).

## 5. Places in REPO referencing deltalake that need change on deprecation (paths only)

Connector code / schema / registry
- ingestion/src/metadata/ingestion/source/database/deltalake/ (whole dir: connection.py, metadata.py, service_spec.py, clients/base.py, clients/pyspark.py, clients/s3.py)
- openmetadata-spec/src/main/resources/json/schema/entity/services/connections/database/deltaLakeConnection.json
- openmetadata-spec/src/main/resources/json/schema/entity/services/connections/database/deltalake/metastoreConfig.json
- openmetadata-spec/src/main/resources/json/schema/entity/services/connections/database/deltalake/storageConfig.json
- openmetadata-spec/src/main/resources/json/schema/entity/services/databaseService.json (lines 45, 160, 298: enum, name, connection ref)
- ingestion/src/metadata/utils/constants.py (:52-53 import, :193 NON_SQA list)
- ingestion/src/metadata/ingestion/lineage/models.py (:37-38, :152 SPARKSQL dialect)
- ingestion/src/metadata/utils/metadata_service_helper.py (Amundsen "delta" mapper)
- ingestion/src/metadata/examples/workflows/deltalake.yaml

Dependencies / packaging
- ingestion/setup.py (:315-323 plugins `deltalake`, `deltalake-storage`, `deltalake-spark`; :561 pulled into a bundle via `*plugins["deltalake"]`; :645-646 excluded from `slim`)
- ingestion/pyproject.toml (:79 pytest ignore)
- ingestion/.ruff-g004-baseline.json, ingestion/.basedpyright/baseline.json
- No matches in `docker/`, `.github/`, `ingestion/Dockerfile*`, `ingestion/Makefile`, root `Makefile` (grep for deltalake|delta-spark|delta_lake returned nothing there). Docker packages audit collate#5955 is unrelated except that pyspark/JVM weight may be a motivation: UNVERIFIED.

Backend (Java)
- openmetadata-service/src/main/java/org/openmetadata/service/secrets/converter/DeltaLakeConnectionClassConverter.java
- openmetadata-service/src/main/java/org/openmetadata/service/secrets/converter/StorageConfigClassConverter.java
- openmetadata-service/src/main/java/org/openmetadata/service/secrets/converter/ClassConverterFactory.java
- openmetadata-service/src/main/resources/json/data/testConnections/database/deltalake.json
- bootstrap/sql/migrations/ (historical, append-only per rules; references only): native/1.5.0/mysql/schemaChanges.sql, native/1.5.0/postgres/schemaChanges.sql, flyway/*/v004__create_db_connection_info.sql, flyway/*/v005__create_db_connection_info.sql (both MySQL and Postgres dirs)

UI
- openmetadata-ui/src/main/resources/ui/public/locales/en-US/Database/DeltaLake.md
- openmetadata-ui/src/main/resources/ui/public/jsons/connectionSchemas/connections/database/deltaLakeConnection.json (+ deltalake/metastoreConfig.json, deltalake/storageConfig.json, connections/serviceConnection.json) (generated/copied schemas)
- openmetadata-ui/src/main/resources/ui/src/jsons/ingestionSchemas/workflow.json, testSuitePipeline.json (generated)
- openmetadata-ui/src/main/resources/ui/src/utils/EntityUtils.interface.ts, DatabaseServicePureUtils.ts, ServiceIconUtils.ts, DataAssetServiceUtils.tsx
- openmetadata-ui/src/main/resources/ui/src/components/Settings/Services/ServiceConfig/ConnectionConfigForm.schema-render.test.tsx (:314 DeltaLake test)
- asset: openmetadata-ui/src/main/resources/ui/src/assets/img/service-icon-delta-lake.webp (imported at ServiceIconUtils.ts:26)
- No matches under openmetadata-ui playwright/, locale/ dirs, or openmetadata-integration-tests for "deltalake".

Tests
- ingestion/tests/unit/topology/database/test_deltalake.py
- ingestion/tests/unit/source/database/deltalake/test_connection.py
- ingestion/tests/integration/sources/database/delta_lake/ (conftest.py, test_deltalake_storage.py)
- ingestion/tests/unit/test_parser_connection_fallback.py, test_parser_connection_module.py, test_source_parsing.py
- ingestion/tests/unit/source/database/test_leaf_sources_inherit_base_test_connection.py
- ingestion/tests/unit/topology/database/test_unity_catalog_lineage.py
- ingestion/tests/unit/utils/test_datalake.py (Iceberg/Delta JSON parser tests; not the connector)
- ingestion/tests/integration/amundsen/test_metadata.py

Docs / skills
- skills/connector-building/references/architecture-decision-tree.md (:41 lists deltalake as example)
- Untracked working drafts by the team, in this worktree: docs/delta-lake-detection-decision.md, docs/delta-lake-detection-connector-matrix.md (git status: `??`; docs/index.md modified). Not verified by me except where quoted.
- Public connector docs (docs.open-metadata.org/connectors/database/deltalake, linked in `DeltaLake.md`) are not in this repo.

## 6. GitHub issues

Commands run as specified. open-metadata/OpenMetadata `--search deltalake` (40 results); most relevant:
- #27491 OPEN "Support Delta table detection in ADLS for Datalake-Azure connector": user says Delta connector "only supports S3 and Metastore"; datalake-azure treats each file as separate asset; use case is ADLS Delta with no metastore. Direct evidence of a Delta coverage gap that dedicated connector does not fill and catalog detection cannot fill either.
- #14885 CLOSED "Deltalake without metastore": origin of S3 storage mode (delta-rs); notes the need to "only fetch delta tables" when listing.
- #24840 CLOSED "DeltaLake metadata agent allows duplicate delta tables names": S3 mode registers only one of two same-named tables in different prefixes (name collision).
- #8515 CLOSED, #13040 CLOSED: profiler/DQ for Deltalake requested.
- #17909 CLOSED: incompatible with `deltalake` 0.20.0 (why setup.py pins `<0.20`, `setup.py:319`).
- #14408 CLOSED: listTables error with Python 3.11 (why the unit test is skipped on >=3.11).
- #28981 CLOSED: BaseConnection migration incl. deltalake.
- Older closed config issues: #6023 connection args, #7716 hadoop config, #16075 extraClassPath, #7121 external Hive metastore in MySQL, #7970 metastore DB examples, #6110 HDFS HA, #4973 sample data not ingested.
- #24311 OPEN "Cross-DatabaseService Lineage Support for Athena": matched search term; relevance to Delta UNVERIFIED (body not read).
- No issue in this search concerns deprecating/removing the connector. Second search "deprecate delta" returned nothing relevant.

open-metadata/openmetadata-collate `--search delta` (15 results); relevant:
- #5992 OPEN "Support Delta Lake table discovery through compatible database connectors". Body: "This work does not replace the dedicated Delta Lake connector and is not a migration from Delta Lake to Iceberg. It adds source-native detection and typing..."; DoD includes "Existing non-Delta table ingestion remains unchanged". Comment links OpenMetadata#24840 as a sub-issue to check.
- #5993 OPEN Spike: canonical TableType, per-connector indicator "without opening transaction logs directly", audit at minimum Glue, Athena, Trino, Presto, Databricks, Unity Catalog; asks what metadata each can supply (columns, partitions, location, properties, comments, constraints, format/version).
- #5994 OPEN Implement: "Ingest the metadata fields proven available by the spike without opening Delta transaction logs from connectors that only expose catalog metadata."
- `--search "deprecate deltalake"` -> `[]`. #5955 (Docker native packages audit) surfaced by search; no Delta content seen in its body.
- Conclusion: none of the three issues proposes deprecation; #5992 states the opposite. The deprecation plan is not tracked in any issue I could find.

Cross-check with the team's untracked draft (`docs/delta-lake-detection-decision.md:20-33`): 2.1 list = glue, athena, trino, presto, unitycatalog; `databricks, deltalake` "out of scope"; `impala, iomete, clickzetta, datalake` "no indicator found, excluded"; hive/redshift follow-up. Confirms no plan in that draft to cover the dedicated connector's S3 or Hive-metastore modes.

## UNVERIFIED / could not determine

- Whether the `hive` connector (or any other existing connector) can connect to the same Thrift / JDBC / Derby-file metastores the dedicated connector supports, and whether it would identify Delta tables there. Not investigated in code.
- For metastore mode, which tables Spark actually resolves through `_delta_log` versus the metastore in real deployments (only the Delta docs quote above; nothing run).
- Runtime behaviour of the `datalake` connector on a Delta folder (per-file assets is inferred from code at datalake/metadata.py:231-253 and from #27491, not executed).
- Whether a `_delta_log/*.json` commit file would match `_is_iceberg_delta_metadata` (not tested).
- Memory/time cost and type fidelity of `table.to_pandas()` in S3 mode on large tables (not run).
- Whether profiler/DQ works today for DeltaLake services (issues closed; code not checked).
- Number of real users on each mode (no telemetry available to me).
- Whether the public docs/site or `openmetadata-docs` (outside this repo) reference the connector.
- Relevance of open OpenMetadata#24311 to Delta.
- Content of the untracked draft docs was only sampled (decision doc lines 20-33, 72-100); its claims are "doc-sourced, needs live check" by its own label and I did not verify them.
- Housekeeping note: a first Write went to a mistyped scratchpad path; I removed that stray directory tree. It contained only my placeholder file as far as I know, but I did not list it before deleting. No file in REPO was modified.
