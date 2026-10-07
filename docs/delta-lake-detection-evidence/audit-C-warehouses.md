# Audit C: warehouse / lakehouse connectors, Delta Lake detection from catalog metadata

Scope: 17 connectors under `REPO/ingestion/src/metadata/ingestion/source/database/`, with REPO = `<repo>`.
Researched 2026-09-24. Every row: **verified live: no** (no system could be run).
Evidence tags: DOC-QUOTED = vendor/upstream primary source fetched this session; CODE-READ = REPO code (and installed library code) read; UNVERIFIED = needs a live system.
"Search-snippet" = I only saw a WebSearch summary of a primary URL, not the fetched page; treat as weaker than DOC-QUOTED.

Notation: paths below are relative to `ingestion/src/metadata/ingestion/source/database/` unless absolute. `TableType` has no `DeltaLake` member yet (`openmetadata-spec/.../entity/data/table.json` enum contains `Iceberg` at line 34 and no Delta member; grep of that file for "Delta" only hits a compression-codec description at :1236).

## Summary table

| Connector | Verdict | Delta marker (catalog-visible) | Evidence confidence |
|---|---|---|---|
| databricks | IMPLEMENTABLE-NOW (info-schema path; fallbacks lack it) | `information_schema.tables.data_source_format = 'DELTA'` (also `DELTA_UNIFORM_ICEBERG`/`DELTA_UNIFORM_HUDI` are Delta-backed); DESCRIBE `Provider` row is a fallback | DOC-QUOTED (marker existence) + CODE-READ (query already run); value casing/`Provider = delta` on Databricks UNVERIFIED |
| unitycatalog | IMPLEMENTABLE-NOW | `TableInfo.data_source_format == DELTA` on the `tables.list` item already in hand | DOC-QUOTED + CODE-READ; SDK pin caveat |
| snowflake | IMPLEMENTABLE-NOW for Delta external tables only; Iceberg-from-Delta has NO marker | `SHOW EXTERNAL TABLES` column `table_format` in {`DELTA`,`UNSPECIFIED`}; OM already runs this statement per database | DOC-QUOTED + CODE-READ |
| bigquery | IMPLEMENTABLE-WITH-EXTRA-WORK (small) | `externalDataConfiguration.sourceFormat == "DELTA_LAKE"` via `tables.get`, not in `tables.list` | DOC-QUOTED + CODE-READ |
| mssql | NO-RELIABLE-INDICATOR (can host Delta; marker undocumented) | none documented; candidate `sys.external_tables` -> `sys.external_file_formats` is UNVERIFIED | DOC-QUOTED (hosting) / UNVERIFIED (marker) |
| azuresql | NO-RELIABLE-INDICATOR (same as mssql; Azure SQL DB support is labelled Preview) | none documented | DOC-QUOTED / UNVERIFIED |
| clickhouse | IMPLEMENTABLE-WITH-EXTRA-WORK | `system.tables.engine` starting `DeltaLake` (exact string UNVERIFIED) | DOC-QUOTED + upstream source read; exact value UNVERIFIED |
| vertica | NO-RELIABLE-INDICATOR (only a manifest-based workaround; no native Delta docs found) | none | DOC-QUOTED (KB) + NO EVIDENCE for native |
| teradata | NO-RELIABLE-INDICATOR (reads Delta via OTF DATALAKE objects; marker/visibility in `DBC.TablesV` not found) | none found | DOC-QUOTED (support) / UNVERIFIED (catalog) |
| exasol | CANNOT-HOST-DELTA as a table (import-only extension) | n/a | DOC-QUOTED (README), narrow |
| druid | CANNOT-HOST-DELTA as a table (ingest-only, contrib extension) | n/a | DOC-QUOTED |
| pinotdb | CANNOT-HOST-DELTA as a table (OSS PR unmerged/closed; vendor ingest connector only) | n/a | DOC-QUOTED (PR) + search-snippet (StarTree) |
| singlestore | NO-EVIDENCE-FOUND | n/a | UNVERIFIED (absence) |
| salesforce (CRM sObjects) | NO-EVIDENCE-FOUND | n/a | UNVERIFIED (absence) |
| data360 | NO-EVIDENCE-FOUND for Delta-as-Delta (built on Iceberg/Parquet; Delta only via UniForm to Iceberg federation) | n/a | DOC-QUOTED (architecture) |
| domodatabase | NO-EVIDENCE-FOUND | n/a | UNVERIFIED (absence) |
| greenplum | NO-EVIDENCE-FOUND | n/a | DOC-QUOTED (PXF format list) / UNVERIFIED (absence) |

"NO EVIDENCE FOUND" and "CANNOT-HOST-DELTA" are conclusions from searches of vendor docs, not proof of absence.

---

## Corrections to `docs/delta-lake-detection-connector-matrix.md` (untrusted; re-verified)

1. **Snowflake**: doc says "no documented catalog-view column". Wrong for the external-table case: `SHOW EXTERNAL TABLES` has a `table_format` column (Delta/UNSPECIFIED), and OM already executes that statement (see Snowflake section).
2. **BigQuery**: doc says detection "costs an extra API call". OM already calls `client.get_table()` for every table (cached) to build columns, so no net extra call if the list-stage decision is moved to use the cached object (see BigQuery section).
3. **mssql, azuresql, clickhouse, teradata, vertica, data360, singlestore, exasol, druid, pinotdb, salesforce, domodatabase, greenplum** are all listed as "not-lakehouse-capable-exclude / no lakehouse". Vendor docs contradict that for mssql, azuresql (Delta external tables), clickhouse (DeltaLake engine), teradata (Delta OTF), and a manifest workaround exists for Vertica. Druid/Pinot/Exasol have Delta ingest/import paths. The "exclude" classification was not evidence-based for these.
4. Matrix says the UC enum includes `DELTA_UNIFORM_ICEBERG` etc. Confirmed in the REST docs, but the SDK pinned by OM (0.20.0) does not know those values (see UC section).

---

## databricks

### 1. Can it host Delta?
Yes, natively. Quote (https://docs.databricks.com/aws/en/delta/): "Delta Lake is the default format for all operations on Databricks. Unless otherwise specified, all tables on Databricks are Delta Lake tables." That page states no GA/preview label (fetch summary). Edition/version: n/a; `DESCRIBE TABLE ... AS JSON` needs Databricks Runtime 16.2+ per REPO comment (`databricks/metadata.py:193`).

### 2. How OM lists tables and decides type today (CODE-READ)
- `get_table_names` (`databricks/metadata.py:770-798`): `USE CATALOG`, `SHOW TABLES IN <schema>`, then per table `get_table_type()`; if the returned type is empty or `"FOREIGN"` the table is skipped (`:788-792`). Views are subtracted via `get_view_names` (`:797-798`).
- `get_table_type` (`:840-866`): first the per-schema bulk map from `_get_schema_table_types` (`:801-837`) which runs `DATABRICKS_GET_TABLE_TYPES` = `SELECT table_name, table_type FROM {catalog}.information_schema.tables WHERE table_schema = :schema_name` (`databricks/queries.py:55-61`); on failure or a miss it falls back to `DESCRIBE TABLE EXTENDED` and reads the `Type` row (`:851-863`).
- `DatabricksSource.query_table_names_and_types` (`:980-994`) builds `TableNameAndType(name=table_name)` only; default `type_ = TableType.Regular` (`common_db_source.py:92-99`). Views get `TableType.View` (`:996-1010`).
- **Answer to "does typing differ by Delta/non-Delta today": No.** Every non-view, non-FOREIGN table is `Regular`. The only per-table format-like field consumed is `table_type` (MANAGED/EXTERNAL/FOREIGN...), used solely to skip FOREIGN. `DescribeJsonPayload` models `type`, `location`, comments, columns, view text; it does not model `provider` (`databricks/models.py:57-70`).

### 3. Marker
- **Best marker:** `information_schema.tables.data_source_format`. Doc quote (https://docs.databricks.com/aws/en/sql/language-manual/information-schema/tables): "DATA_SOURCE_FORMAT: Format of the data source such as `PARQUET`, or `CSV`." Full column list includes TABLE_TYPE, DATA_SOURCE_FORMAT, STORAGE_PATH. TABLE_TYPE values documented: VIEW, FOREIGN, MANAGED, STREAMING_TABLE, MATERIALIZED_VIEW, EXTERNAL, MANAGED_SHALLOW_CLONE, EXTERNAL_SHALLOW_CLONE.
- The REST enum (https://docs.databricks.com/api/workspace/tables/get) lists: DELTA, CSV, JSON, AVRO, PARQUET, ORC, TEXT, UNITY_CATALOG, DELTASHARING, DATABRICKS_FORMAT, MYSQL_FORMAT, ORACLE_FORMAT, POSTGRESQL_FORMAT, REDSHIFT_FORMAT, SNOWFLAKE_FORMAT, SQLDW_FORMAT, SQLSERVER_FORMAT, SALESFORCE_FORMAT, SALESFORCE_DATA_CLOUD_FORMAT, TERADATA_FORMAT, BIGQUERY_FORMAT, NETSUITE_FORMAT, WORKDAY_RAAS_FORMAT, MONGODB_FORMAT, HIVE, VECTOR_INDEX_FORMAT, DATABRICKS_ROW_STORE_FORMAT, DELTA_UNIFORM_HUDI, DELTA_UNIFORM_ICEBERG, ICEBERG. That is the REST enum; that the SQL `information_schema` column emits the same strings/casing is UNVERIFIED live.
- **Can it occur on non-Delta tables?** Value is per table. Non-Delta values exist (PARQUET, CSV, ICEBERG, foreign-connector `*_FORMAT`, HIVE). `DELTA_UNIFORM_ICEBERG/HUDI` are Delta tables exposed to other clients (doc lists them; semantics UNVERIFIED beyond the name). DELTASHARING (shared tables) is a separate value. Views: value UNVERIFIED (probably null).
- **Per-table**, not per-catalog. Already exposed? The bulk query already runs once per schema (`:801-837`); adding `data_source_format` to that SELECT costs no extra round trip. Caveats: (a) it only runs when `database` is set and falls back to per-table DESCRIBE on any failure (`:832-836`); the REPO code itself treats a catalog without `information_schema` as possible (`:700-703`, `SHOW SCHEMAS` check); (b) the fallback path has no format field in the JSON model.
- **Fallbacks (weaker):**
  - `SHOW TABLE EXTENDED` output includes `Provider`. Quote (https://docs.databricks.com/aws/en/sql/language-manual/sql-ref-syntax-aux-show-table): "Created By: Spark 3.0.0, Type: MANAGED, Provider: hive" (example) and "basic table information and file system information like `Last Access`, `Created By`, `Type`, `Provider`, `Table Properties`, `Location`...". OM does not run this command.
  - `DESCRIBE TABLE EXTENDED` has a `Provider` row and the AS JSON form has key `provider` (https://docs.databricks.com/aws/en/sql/language-manual/sql-ref-syntax-aux-describe-table, example shows `"provider": "parquet"`). OM already runs this per table (`queries.py:51,53`). That a Delta table prints `delta` is inferred: Spark emits `"Provider" -> provider` (`apache/spark .../catalog/interface.scala:671`) and Delta's short name is `DeltaSourceUtils.ALT_NAME` (`delta-io/delta .../DeltaDataSource.scala:353-355`); the literal `delta` on Databricks UC tables is UNVERIFIED live.
  - `DESCRIBE DETAIL` is per-table and not Delta-only. Quote (https://docs.databricks.com/aws/en/delta/table-details): "Use `DESCRIBE DETAIL` to retrieve detailed metadata about a Delta Lake or Apache Iceberg table"; returns a `format` column ("delta or iceberg"). Expensive (one call per table); OM does not run it.

### 4. Verdict: IMPLEMENTABLE-NOW (via the existing info-schema query), with caveats
Delta is the default, so `DELTA` will mark most tables; the value distinguishes DELTA vs ICEBERG/PARQUET/foreign. Requires threading the new column through `_get_schema_table_types` -> `get_table_type` -> `query_table_names_and_types` (currently discards everything but the name). `hive_metastore` catalog and older runtimes: UNVERIFIED.

---

## unitycatalog

### 1. Can it host Delta? Yes, natively (Unity Catalog on Databricks; see databricks section quote).

### 2. How OM lists tables and decides type (CODE-READ)
- `get_tables_name_and_type` (`unitycatalog/metadata.py:470-510`): `client.tables.list(catalog_name, schema_name, max_results=0)` via `partial` (`:491-496`); tables with constraints are re-fetched via `client.tables.get(full_name)` (`:501-502`). Incremental mode calls `client.tables.get` per changed table (`:538`).
- `_process_table` (`:550-593`): starts `TableType.Regular`; `table.table_type` lower-cased: `view` -> View, `materialized_view` -> MaterializedView, `external` -> External (`:571-578`); the whole `TableInfo` is stored in `context.table_data` (`:579`) and read again in `yield_table` (`:625`). `TableType.Iceberg` is never assigned in this file (only referenced in a DDL guard at `:601`), i.e. there is no Iceberg precedent here, contradicting the task premise; the older matrix doc noted the same.
- Note the `if/if/elif` chain at `:573-578` is not a single elif chain (a `view` value cannot reach the `materialized_view` branch, so harmless).

### 3. Marker
- REST `TableInfo.data_source_format`. The list endpoint response items include `data_source_format` and `table_type` (https://docs.databricks.com/api/workspace/tables/list, fetch summary; enum list identical to the databricks section).
- Installed/pinned SDK: `ingestion/setup.py:63` pins `databricks-sdk~=0.20.0`; the installed 0.20.0 (`<workspace>/venv/lib/python3.11/site-packages/databricks/sdk/service/catalog.py:1514-1525`) `DataSourceFormat` only has AVRO, CSV, DELTA, DELTASHARING, JSON, ORC, PARQUET, TEXT, UNITY_CATALOG. `TableInfo.data_source_format` exists (`:4193`), parsed with `_enum`, and unknown enum values become `None` (`_internal.py:18-26`). So with this pin `DELTA` is detectable, but `DELTA_UNIFORM_ICEBERG`, `DELTA_UNIFORM_HUDI`, `ICEBERG`, and the foreign `*_FORMAT` values arrive as `None` (indistinguishable from "absent"). This matters: a UniForm table would not be detectable, and `ICEBERG` managed tables not distinguishable. A SDK bump would be needed for full fidelity. (Installed version is the Desktop venv, not REPO's; the setup.py pin is what governs.)
- Per-table; already in the object OM has (`table` from list, `:579`). No extra call for unconstrained tables; constrained tables use `get`, which carries the same field.
- Can occur on non-Delta tables: yes (values above). `DELTA` on views: UNVERIFIED (likely absent).

### 4. Verdict: IMPLEMENTABLE-NOW (`data_source_format == DataSourceFormat.DELTA`), with the SDK-pin caveat for UniForm/Iceberg values.

---

## snowflake

### 1. Can it host Delta?
Yes, via external tables (Preview, deprecation-track) and Iceberg tables over Delta files.
- External table Delta (https://docs.snowflake.com/en/sql-reference/sql/create-external-table): "This preview feature is available to all accounts."; "When the metadata for an external table is refreshed, Snowflake parses the Delta Lake transaction logs and determines which Parquet files are current."; requires `REFRESH_ON_CREATE`/`AUTO_REFRESH` FALSE; "This feature is still supported but will be deprecated in a future release. Consider using an Apache Iceberg table instead." Same in https://docs.snowflake.com/en/user-guide/tables-external-intro ("Preview Feature - Open. Available to all accounts.").
- Iceberg over Delta ("Delta Direct"): https://docs.snowflake.com/en/sql-reference/sql/create-iceberg-table-delta: "Creates or replaces an Apache Iceberg table ... using Delta Lake metadata files in object storage"; needs a catalog integration with `CATALOG_SOURCE = OBJECT_STORE` and `TABLE_FORMAT = DELTA`. Page states no preview/GA label (fetch summary). BASE_LOCATION must contain `_delta_log/`.

### 2. How OM lists tables and decides type (CODE-READ)
- `snowflake/queries.py:19-31` `SNOWFLAKE_GET_TABLE_NAMES` selects `TABLE_NAME` and a computed `TABLE_TYPE`: TRANSIENT -> 'TRANSIENT TABLE', DYNAMIC -> 'DYNAMIC TABLE', `IS_ICEBERG = 'YES'` -> 'ICEBERG TABLE', else `TABLE_TYPE`. Incremental variant `:33-55` uses `account_usage.tables`.
- Mapping in `snowflake/utils.py:319-329` (`_get_table_type`): BASE TABLE->Regular, VIEW, MATERIALIZED VIEW, EXTERNAL TABLE->External, TRANSIENT, DYNAMIC, ICEBERG TABLE->Iceberg; unknown -> Regular.
- `_get_table_names_and_types` (`snowflake/metadata.py:745-775`) passes `table.type_` through.
- Separately, `set_external_location_map` (`snowflake/metadata.py:332-343`, called unconditionally per database at `:513`) runs `SHOW EXTERNAL TABLES IN DATABASE {db}` (`queries.py:370-372`) and keeps only `(database_name, schema_name, name) -> location`.
- `SNOWFLAKE_GET_EXTERNAL_TABLE_NAMES` (`queries.py:124-127`) is defined but has no other reference in REPO (grep).

### 3. Marker
- `SHOW EXTERNAL TABLES` output column `table_format`. Quote (https://docs.snowflake.com/en/sql-reference/sql/show-external-tables): "Table format of the staged files that are referenced by the external table. Possible values: DELTA, UNSPECIFIED." Also columns `name`, `database_name`, `schema_name`, `location`, `file_format_type`, etc.
- Per table. Cannot occur on a non-Delta external table with value DELTA (UNSPECIFIED otherwise). Already exposed: the statement is already executed per database (`:513`, `:332-343`); only `row.table_format` needs reading (no extra query). Match key: `(database_name, schema_name, name)` already used.
- `INFORMATION_SCHEMA.TABLES` has no format column. Doc column list (https://docs.snowflake.com/en/sql-reference/info-schema/tables): TABLE_TYPE values `BASE TABLE, TEMPORARY TABLE, EXTERNAL TABLE, EVENT TABLE, VIEW, MATERIALIZED VIEW`; `IS_ICEBERG` YES/NO; no delta/format column.
- **Iceberg-from-Delta: no marker found.** `SHOW ICEBERG TABLES` columns (https://docs.snowflake.com/en/sql-reference/sql/show-iceberg-tables) include `external_volume_name`, `catalog_name`, `iceberg_table_type` (UNMANAGED / NOT ICEBERG), `catalog_table_name`, `base_location`, `auto_refresh_status`; none says Delta. The `CATALOG` integration (TABLE_FORMAT=DELTA) is referenced by the table but whether `catalog_name`/`SHOW CATALOG INTEGRATIONS` distinguishes it: UNVERIFIED. Such tables already map to `TableType.Iceberg` via `IS_ICEBERG` and would stay Iceberg.

### 4. Verdict: IMPLEMENTABLE-NOW for Delta external tables (deprecation-track Preview feature); NO-RELIABLE-INDICATOR for Delta-backed Iceberg tables.

---

## bigquery

### 1. Can it host Delta? Yes: BigLake external tables for Delta Lake.
https://docs.cloud.google.com/bigquery/docs/create-delta-lake-table: "BigLake lets you access Delta Lake tables with more granular access control. Delta Lake is an open source, tabular data storage format developed by Databricks..."; limitations: Delta reader version 3 with relative-path deletion vectors and column mapping, no Delta V2 checkpoints, no CDC, no schema modification via BigQuery, no materialized views/Read API, no `timestamp_ntz`. Storage: page shows Cloud Storage (a search snippet also mentioned S3; UNVERIFIED). Release stage: the fetched page shows no Preview/GA banner (absence of banner in a summarizer output; GA status is therefore UNVERIFIED).
Identification: `"externalDataConfiguration": { "sourceFormat": "DELTA_LAKE", ... }` (same page).

### 2. How OM lists tables and decides type (CODE-READ)
- `query_table_names_and_types` (`bigquery/metadata.py:374-411`): `client.list_tables(dataset_ref)`; type = `_bigquery_table_types.get(table.table_type, TableType.Regular)` (`:405`) with map at `:127-133` (`BASE TABLE`, `EXTERNAL`, `MATERIALIZED_VIEW`, `VIEW`, `ICEBERG`).
- The BigQuery REST discovery doc (fetched, revision 20260811: https://bigquery.googleapis.com/discovery/v1/apis/bigquery/v2/rest) says `Table.type` values are `TABLE`, `VIEW`, `EXTERNAL`, `MATERIALIZED_VIEW`, `SNAPSHOT`, and the `tables.list` item schema has only: creationTime, clustering, view, tableReference, friendlyName, kind, id, labels, type, requirePartitionFilter, rangePartitioning, expirationTime, timePartitioning. So a Delta BigLake table is listed with `type = EXTERNAL` -> OM `TableType.External`. Side observation: the map keys `BASE TABLE` and `ICEBERG` do not appear in that enumeration (they look like INFORMATION_SCHEMA vocabulary); whether the Iceberg precedent ever fires from `list_tables` is UNVERIFIED live.
- Per-table `client.get_table()` is already called and cached: `get_table_obj` (`:791-805`, bounded cache, `TABLE_OBJ_CACHE_SIZE = 2048` at `:~32`), used for columns (`:359`), tags (`:809`), DDL/partition details (`:986,1051,1071`). `:1074-1083` already reads `table.external_data_configuration`.

### 3. Marker
- `Table.externalDataConfiguration.sourceFormat == "DELTA_LAKE"` (string). Not in `tables.list` (schema above). Per table. Only external tables carry it, so it is Delta-specific (but the REST doc's own `sourceFormat` description in the discovery doc lists CSV, GOOGLE_SHEETS, NEWLINE_DELIMITED_JSON, AVRO, DATASTORE_BACKUP, ICEBERG, ORC, PARQUET, BIGTABLE and does NOT list DELTA_LAKE; the Delta page does show it, so the value is documented on one page and omitted from the field description).
- Python client (installed google-cloud-bigquery 3.41.0): `ExternalConfig.source_format` returns the raw `_properties["sourceFormat"]` string (`external_config.py:732-739`), so an unknown enum value is still returned (`SourceFormat` enum in `enums.py:226+` has no DELTA_LAKE, irrelevant since it is not validated).
- Extra work: the type must be decided at list time (`:405`), before per-table `get_table_obj`. Restrict the extra `get_table_obj` call to items whose list `type == "EXTERNAL"`; the cached object is then reused for columns/tags, so total API calls are unchanged (cache is bounded at 2048 entries and the topology runs multi-threaded per schema: eviction between list and column steps would cause a re-fetch; UNVERIFIED impact).

### 4. Verdict: IMPLEMENTABLE-WITH-EXTRA-WORK (fetch table object for EXTERNAL list items; compare `external_data_configuration.source_format`).

---

## mssql

### 1. Can it host Delta?
- SQL Server 2022 (16.x) and later: yes via PolyBase data virtualization. Quote (https://learn.microsoft.com/en-us/sql/relational-databases/polybase/virtualize-delta?view=sql-server-ver16): "Applies to: SQL Server 2022 (16.x) and later versions. SQL Server 2022 (16.x) can query data directly from a delta table folder." Via `OPENROWSET(BULK ..., FORMAT = 'DELTA', DATA_SOURCE = ...)` or `CREATE EXTERNAL FILE FORMAT ... WITH(FORMAT_TYPE = DELTA)` + `CREATE EXTERNAL TABLE`. No preview label on that page. Limitation quoted: "If you create an external table pointing to partitioned delta table, the column used for partitioning returns `NULL`".
- CREATE EXTERNAL FILE FORMAT page (https://learn.microsoft.com/en-us/sql/t-sql/statements/create-external-file-format-transact-sql?view=sql-server-ver17): "Delta: Applies *only* to serverless SQL pools in Azure Synapse Analytics, Azure SQL Database, SQL Server 2022 (16.x) and later versions. You can query Delta Lake version 1.0 ... Changes introduced since, in Delta Lake 1.2, like renaming columns are not supported. If you are using the higher versions of Delta with delete vectors, v2 checkpoints, and other features, consider using other query engines like Microsoft Fabric SQL analytics endpoint". (Same page's FORMAT_TYPE section says `DELTA` "Applies to serverless SQL pools in Azure Synapse Analytics and SQL Server 2022 (16.x)": the two spots disagree on Azure SQL Database.)
- Synapse serverless: `FORMAT = 'delta'` in OPENROWSET (search snippet of https://learn.microsoft.com/en-us/azure/synapse-analytics/sql/query-delta-lake-format; snippet described Delta as "(preview)" in the format list; UNVERIFIED as fetched text).

### 2. How OM lists tables and decides type (CODE-READ)
- Patched `MSDialect.get_table_names` (`mssql/metadata.py:62,95`; implementation `mssql/utils.py:446-462`): `INFORMATION_SCHEMA.TABLES` filtered `table_type == "BASE TABLE"`. Views: `:464-480`. Default `CommonDbSourceService.query_table_names_and_types` returns `TableNameAndType(name=...)` = `Regular` (`common_db_source.py:344-353`). No per-table type logic.

### 3. Marker
- INFORMATION_SCHEMA.TABLES doc (https://learn.microsoft.com/en-us/sql/relational-databases/system-information-schema-views/tables-transact-sql): "TABLE_TYPE: Type of table. Can be VIEW or BASE TABLE." and a warning that "INFORMATION_SCHEMA views could be incomplete since they are not updated for all new features." Whether external tables show up there, and as what, is not documented -> UNVERIFIED.
- `sys.external_tables` (https://learn.microsoft.com/en-us/sql/relational-databases/system-catalog-views/sys-external-tables-transact-sql) columns: `data_source_id`, `file_format_id` ("For external tables over a HADOOP external data source, this is the object_id for the external file format"), `location` (same HADOOP qualifier). `sys.external_file_formats` doc: `format_type` "Range: DELIMITEDTEXT, RCFILE, ORC, PARQUET" (no DELTA; applies to SQL Server 2016+, Managed Instance, Synapse; not listed for Azure SQL Database). So there is **no documented catalog field** that says an external table is Delta. A `JOIN sys.external_tables -> sys.external_file_formats` looking for the Delta format type is plausible but UNVERIFIED (the doc range is stale/incomplete, or Delta external tables do not populate `file_format_id`).
- OPENROWSET/views over Delta leave no table marker at all (they are views or ad hoc).

### 4. Verdict: NO-RELIABLE-INDICATOR (documentation gap; needs a live SQL Server 2022 instance with a Delta external table to check `sys.external_file_formats`/`sys.external_tables`/`INFORMATION_SCHEMA.TABLES`).

---

## azuresql

### 1. Can it host Delta?
Azure SQL Database data virtualization is labelled Preview. Quote (https://learn.microsoft.com/en-us/azure/azure-sql/database/data-virtualization-overview?view=azuresql, title "Data virtualization (Preview)"): "The data virtualization feature of Azure SQL Database allows you to execute Transact-SQL (T-SQL) queries on files that store data in common data formats like CSV ..., Parquet, and Delta (1.0)." But the same page's File formats section says "Parquet and delimited text (CSV) file formats are directly supported," and its own external-table example only shows `FORMAT_TYPE=PARQUET`. So Delta on Azure SQL Database is asserted in the intro and the CREATE EXTERNAL FILE FORMAT page but not demonstrated; treat as Preview and inconsistent. Managed Instance: page sibling exists (link in doc), not fetched.

### 2. How OM lists tables (CODE-READ)
`azuresql/metadata.py` imports `MSDialect` and the mssql utils (`azuresql/metadata.py:16,~43-52`) but does not patch `get_table_names`. It therefore either uses SQLAlchemy's stock MSDialect (`sqlalchemy/dialects/mssql/base.py:3351-3364`, installed SA 2.0.51: identical `INFORMATION_SCHEMA.TABLES` `BASE TABLE` query) or, if `mssql/metadata.py` is imported in the same process, the patched one; both give Regular for every listed table.

### 3. Marker: same as mssql, none documented.

### 4. Verdict: NO-RELIABLE-INDICATOR.

---

## clickhouse

### 1. Can it host Delta? Yes: `DeltaLake` table engine and `deltaLake()` table function.
- https://clickhouse.com/docs/engines/table-engines/integrations/deltalake: "This engine provides an integration with existing Delta Lake tables in S3, GCP and Azure storage and supports both reads and writes". Writes are Beta (`allow_delta_lake_writes`; v26.7+), S3/GCS writes from v25.10, Azure writes from v26.9. Syntax `CREATE TABLE t ENGINE = DeltaLake(url, ...)`.
- Upstream source (fetched): the engine is registered only `#if USE_PARQUET && USE_DELTA_KERNEL_RS` (`src/Storages/ObjectStorage/registerStorageObjectStorage.cpp:2206`), i.e. build-dependent. The setting `allow_delta_kernel_rs` (default true) is tier BETA with alias `allow_experimental_delta_kernel_rs` (`src/Core/Settings.cpp:9330-9332`, master). Read status therefore: Beta setting, enabled by default, per current master (version at which this applies: UNVERIFIED).
- `DataLakeCatalog` database engine: https://clickhouse.com/docs/engines/database-engines/datalakecatalog: "Databricks Unity Catalog for both Delta Lake and Iceberg formats", with catalog settings (`allow_database_unity_catalog`) and some features experimental.

### 2. How OM lists tables (CODE-READ)
`clickhouse/metadata.py:113-136` `query_table_names_and_types`: regular tables from `Inspector.get_table_names`, materialized views from `get_mview_names` (`clickhouse/utils.py:137-141`, `engine = 'MaterializedView'`), views (`utils.py:161-172`, `engine = 'View'`). `get_table_names` is the library's (`clickhouse_sqlalchemy/drivers/base.py:394-404` installed 0.2.9; upstream master `:430-440`, same SQL): `SELECT name FROM system.tables WHERE engine NOT LIKE '%View' AND name NOT LIKE '.inner%' AND database = :database`. So Delta-engine tables are listed today, all as `Regular`, and the engine value is selected by the WHERE clause but not returned. (setup.py requires `clickhouse-sqlalchemy>=0.3`; the installed 0.2.9 differs; upstream master SQL matches.)

### 3. Marker
- `system.tables.engine` ("Table engine name (without parameters)", https://clickhouse.com/docs/operations/system-tables/tables). Upstream: `StorageObjectStorage::getName()` returns `configuration->getEngineName()` (`StorageObjectStorage.cpp:432-435`), and for data-lake configs `getEngineName()` = `DataLakeMetadata::name + BaseStorageConfiguration::getEngineName()` (`DataLakeConfiguration.h:111`) with `DeltaLakeMetadata::name = "DeltaLake"` (`DeltaLakeMetadata.h:34`). So the displayed value is `"DeltaLake"` plus the backend engine name (for S3 likely `DeltaLakeS3`; Azure/Local variants also registered as `DeltaLakeAzure`, `DeltaLakeLocal`). Exact strings UNVERIFIED live: match with `engine LIKE 'DeltaLake%'`.
- Per table. Not present on non-Delta tables (engine name is Delta-specific). Only tables created with the `DeltaLake*` engine; the `deltaLake()` table function creates no catalog object; tables inside a `DataLakeCatalog` database: engine value UNVERIFIED and they live in a separate database (are they even under `system.tables`? UNVERIFIED).
- Extra work: currently the engine column is discarded; need a `SELECT name, engine FROM system.tables WHERE database = :database` (or override `get_table_names`) and pass a per-table type into `query_table_names_and_types`.

### 4. Verdict: IMPLEMENTABLE-WITH-EXTRA-WORK.

---

## vertica

### 1. Can it host Delta?
- No native Delta documentation found. Searched: docs.vertica.com for "Delta Lake" (latest docs are 26.3.x per the fetched landing page): `working-with-external-data`, `data-load/data-formats` (lists Delimited, Binary, Native varchar, Fixed-width, ORC, Parquet, JSON, Avro, regex, CEF; no Delta/Iceberg), and `new-features` (no "Delta"/"Iceberg" mention) via fetch; a `site:` search returned Iceberg pages (e.g. `CREATE EXTERNAL TABLE ICEBERG`, `EXPORT TO ICEBERG`) and nothing for Delta.
- A vendor KB exists: https://www.vertica.com/kb/Vertica_DeltaLake_Technical_Exploration/Content/Partner/Vertica_DeltaLake_Technical_Exploration.htm: "This document explores the integration of Vertica and Delta Lake using external tables"; uses Spark `deltaTable.generate('symlink_format_manifest')`, then external tables over the manifest and over the parquet data joined in a view; tested with "Vertica 10.0"; no support statement. So Vertica reads Delta only through a user-built manifest workaround (edition/version: KB tested 10.0).

### 2. How OM lists tables (CODE-READ)
`vertica/metadata.py` does not override table listing/typing (no `TableType` or `get_table_names` in the file; grep). Uses `sqlalchemy_vertica` `get_table_names`: `SELECT table_name FROM v_catalog.tables WHERE lower(table_schema) = '<schema>'` (installed 0.0.5, `sqlalchemy_vertica/base.py:205-219`), so external tables and native tables alike, all `Regular` via `common_db_source.py:344-353`.

### 3. Marker: none. Manifest-backed external tables are ordinary Parquet external tables with a manifest path; no Delta field. Not implementable reliably.

### 4. Verdict: NO-RELIABLE-INDICATOR (native Delta: NO EVIDENCE FOUND, searched docs.vertica.com 26.3.x pages above).

---

## teradata

### 1. Can it host Delta? Yes: Teradata Open Table Format (OTF) for Iceberg and Delta Lake.
- https://www.teradata.com/press-releases/2024/teradata-embraces-open-table-formats-iceberg: "Linux Foundation Delta Lake" named among supported OTFs; "OTF support will be available for VantageCloud Lake and AI Unlimited on AWS and Azure in June 2024." (2024 press release: status may have changed.)
- https://docs.teradata.com/r/Enterprise_IntelliFlex_Lake_VMware/Teradata-Open-Table-Format-for-Apache-Iceberg-and-Delta-Lake-User-Guide/Apache-Iceberg-and-Delta-Lake-Open-Table-Format: "Users can effortlessly query and write Iceberg and Delta Lake OTF tables stored in popular catalogs such as Unity Catalog, AWS Glue Data Catalog, or Apache Hive using simple and intuitive SQL syntax." Document covers Teradata Vantage release 20.00, published October 2025 (from the fetched "When to use Iceberg vs Delta Lake" page). Access is through `DATALAKE` objects created with `CREATE DATALAKE` (search snippet), referenced as `table@datalake`.
- Native Object Store manifests page (search snippet only) describes Delta Lake via manifest files.

### 2. How OM lists tables (CODE-READ)
Teradata dialect `get_table_names` (installed `teradatasqlalchemy/dialect.py:947-985`) selects from `dbc.tablesV` with `tablekind` in `T`,`O`,`Q`; `teradata/metadata.py` adds no table-type logic (patches `get_columns`, `get_table_comment`, `get_all_table_comments` only: `:54-56`). `TERADATA_GET_TABLE_NAMES` (`teradata/queries.py:15-18`, TableKind `T`,`V`,`O`) is defined but unreferenced elsewhere (grep). All listed tables are `Regular`.

### 3. Marker: not found. OTF tables are reached through DATALAKE objects (search snippet: introspection via `HELP DATALAKE`/`HELP DATABASE`/`HELP TABLE`); whether they appear in `DBC.TablesV`, which TableKind they carry, and any Delta flag are UNVERIFIED (the `DBC.DATALAKEINFOV` doc page returned 404 via fetch). The OM path (`DBC.TablesV` by database) may not see them at all.

### 4. Verdict: NO-RELIABLE-INDICATOR.

---

## exasol

### 1. Can it host Delta? Import only.
README of the Exasol Cloud Storage Extension (https://github.com/exasol/cloud-storage-extension/blob/main/README.md): "Allows data import from Delta Lake." Supported: S3, GCS, Azure Blob, ADLS Gen1/Gen2 (plus HDFS, Alluxio). It loads data into native Exasol tables via UDFs (imported data, not a Delta-format table). No evidence found of a Delta external/virtual table (searched Exasol docs results: `IMPORT`, `loading_data/other_file_formats`, `delta_import` in exasol/database-migration; the `delta_import` README in that repo was not fetched, so "Delta" there may refer to something else: UNVERIFIED).

### 2. How OM lists (CODE-READ)
`exasol/metadata.py` has no table listing/typing override; `sqlalchemy_exasol` `get_table_names` = `SELECT table_name FROM SYS.EXA_ALL_TABLES WHERE table_schema = ...` (installed 5.2.0, `base.py:900-915`; setup.py pins `>=7.1.1,<8`, different version, not read). All `Regular`.

### 3. Marker: n/a. 4. Verdict: CANNOT-HOST-DELTA (as a queryable Delta table; import-only per vendor README).

---

## druid

### 1. Ingest only. https://druid.apache.org/docs/latest/development/extensions-contrib/delta-lake/: "DeltaLakeInputSource lets you ingest data stored in a Delta Lake table into Apache Druid." It "extracts the underlying Delta files in the table's latest snapshot"; "community extension" (contrib); requires loading `druid-deltalake-extensions`. Result is a Druid datasource (Druid segments), not a Delta table.
### 2. OM (CODE-READ): `druid/metadata.py` has no overrides; pydruid dialect `get_table_names` = `SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES [WHERE TABLE_SCHEMA = ...]` (installed 0.6.9, `pydruid/db/sqlalchemy.py:156-164`), views empty. All `Regular`.
### 3. Marker: none. 4. Verdict: CANNOT-HOST-DELTA (ingest-only).

---

## pinotdb

### 1. Ingest only / vendor product. Upstream PR "Input format support for reading delta lake tables" (https://github.com/apache/pinot/pull/9140): "Adds initial support for reading/parsing a delta lake table formatted input, using the delta standalone library, without the need to use Spark." Limitations: primitive types only, batch only. Status (fetched): closed as stale June 18, 2026, not merged into master. StarTree Cloud advertises a Delta connector (search snippet: "Delta Lake ingestion can only be enabled for offline Pinot tables ... only supports Delta tables hosted on Amazon S3"; the StarTree docs page itself did not load via fetch, so UNVERIFIED). Either way data is copied into Pinot segments.
### 2. OM (CODE-READ): `pinotdb/metadata.py` only patches column types and returns database `default` (`:57-84`); table names from the controller `/tables` API (installed pinotdb 5.7.0, `pinotdb/sqlalchemy.py:247-252`); views empty. All `Regular`.
### 3. Marker: none. 4. Verdict: CANNOT-HOST-DELTA.

---

## singlestore

### 1. Search: SingleStore docs for "Delta Lake" / "Iceberg" (WebSearch restricted to docs.singlestore.com/singlestore.com; fetched https://docs.singlestore.com/cloud/load-data/about-singlestore-pipelines/ and found no mention of Delta, Iceberg, or external tables). Found Iceberg ingest (https://docs.singlestore.com/cloud/load-data/data-sources/iceberg-ingest/: "Iceberg tables can be directly ingested into SingleStore", catalogs Glue/Snowflake/REST/JDBC/Hive/Hadoop; Unity is REST) as search-snippet only. **NO EVIDENCE FOUND** (searched: "SingleStore Delta Lake read support pipeline OR external table", "SingleStore Delta Lake OR Iceberg ingest external catalog", pipelines page fetch). Not proof of absence.
### 2. OM (CODE-READ): `singlestore/metadata.py:36-49` no table logic; uses SQLAlchemy MySQL dialect `SHOW FULL TABLES FROM <schema>` (installed SA 2.0.51, `sqlalchemy/dialects/mysql/base.py:3271-3287`). All `Regular`.
### 3. Marker: n/a. 4. Verdict: NO-EVIDENCE-FOUND.

---

## salesforce (CRM sObjects, not Data Cloud)

### 1. NO EVIDENCE FOUND (searched: "Salesforce sObject describe Delta Lake", "Salesforce CRM objects Salesforce Connect external Delta"): results were Salesforce Connect external objects (OData) and Databricks Lakeflow Connect ingesting Salesforce into Delta (Salesforce is the source there). sObjects are Salesforce-hosted objects.
### 2. OM (CODE-READ): `salesforce/metadata.py:150-194`: `sobjectNames` from config or `client.describe()["sobjects"]`; every object is yielded as `TableType.Regular` (`:194`); `yield_table` calls `sobjects/{name}/describe/` (`:246-250`).
### 3. Marker: none. 4. Verdict: NO-EVIDENCE-FOUND.

---

## data360 (Salesforce Data Cloud)

### 1. Storage is Iceberg/Parquet. https://architect.salesforce.com/docs/architect/fundamentals/guide/data-360-architecture: "Built on Apache Iceberg and Parquet, combining data lake scale with warehouse governance"; "At the base, storage consists of data lake files ... in Parquet format"; DLOs "form the core persistent storage layer". Delta appears only in file federation: search-snippet statements say Databricks Delta tables are federated through UniForm (Iceberg view) and Data 360 reads them "through the Iceberg abstraction" (https://www.salesforce.com/blog/unlock-trapped-data-in-your-data-lakes-introducing-zero-copy-file-federation-in-data-cloud/ and related; snippets only, UNVERIFIED as fetched text). Nothing found saying a Data 360 object is exposed as a Delta-format table.
### 2. OM (CODE-READ): `data360/metadata.py:89-91` `DATA360_TABLE_TYPE_MAP`: DLO->Regular, DMO->Regular, CIO->View; applied at `:272`. Objects enumerated via `GET ssot/metadata?entityType=...&dataspace=...` (`data360/client.py:130-147`). Whether that payload has any storage-format field: UNVERIFIED.
### 3. Marker: none found. 4. Verdict: NO-EVIDENCE-FOUND (Delta as a table format).

---

## domodatabase

### 1. NO EVIDENCE FOUND of Domo hosting Delta tables (searched: "Domo Delta Lake connector OR Delta Lake Domo Magic ETL Databricks federated dataset Delta"). Results are Domo integrating with Databricks (Domo writing to / federating against Databricks, which uses Delta), i.e. the Delta table lives in Databricks, not in Domo.
### 2. OM (CODE-READ): `domodatabase/metadata.py:142-167` lists `domo_client.datasets.list()` and yields every dataset as `TableType.Regular` (`:167`); `OutputDataset` model has rows, columns, schema, owner, description only (`domodatabase/models.py:47-52`), no format field.
### 3. Marker: none. 4. Verdict: NO-EVIDENCE-FOUND.

---

## greenplum

### 1. NO EVIDENCE FOUND of Delta support. Fetched https://techdocs.broadcom.com/us/en/vmware-tanzu/data-solutions/tanzu-greenplum/7/greenplum-database/admin_guide-external-pxf-overview.html: formats "text, Avro, JSON, RCFile, Parquet, SequenceFile, and ORC formats"; Delta Lake, Iceberg, Hudi not mentioned there. A search result (Tanzu Greenplum update blog, snippet only) claims "native, full read-write access to Apache Iceberg foreign tables via PXF"; no Delta hit in results. Not proof of absence.
### 2. OM (CODE-READ): `greenplum/metadata.py:109-121` runs `GREENPLUM_GET_TABLE_NAMES` (`greenplum/queries.py:19-27`: `pg_class` relkind in `('r','p','f')`, excluding partition children) and maps relkind via `RELKIND_MAP` (`common_pg_mappings.py:28-34`: r Regular, p Partitioned, f Foreign, v View, m MaterializedView; unknown -> Regular). Foreign tables (`f`) become `TableType.Foreign`; a foreign table's data format is not read.
### 3. Marker: none. 4. Verdict: NO-EVIDENCE-FOUND.

---

## UNVERIFIED / needs a live system

1. **Databricks**: literal `information_schema.tables.data_source_format` strings/casing returned by SQL (REST enum documented; SQL column doc only shows examples "PARQUET"/"CSV"); value for views; behaviour on `hive_metastore` catalog and runtimes without information_schema; that `DESCRIBE TABLE EXTENDED` prints `Provider delta` for UC Delta tables (docs example shows `parquet`; only Spark/Delta OSS source reasoning); meaning/prevalence of `DELTA_UNIFORM_ICEBERG/HUDI`.
2. **Unity Catalog**: that `tables.list` items populate `data_source_format` at runtime with SDK 0.20.0 and for tables with default `omit_*` flags; how UniForm and managed Iceberg tables appear under the SDK pin (expected `None` because enum lacks them).
3. **Snowflake**: `table_format` returned as `DELTA` (upper case) for a real Delta external table; whether Delta-backed Iceberg tables expose any distinguishing field (`SHOW ICEBERG TABLES`, catalog integration lookup); `IS_ICEBERG` value for them; role visibility limits of `SHOW EXTERNAL TABLES IN DATABASE`.
4. **BigQuery**: BigLake Delta release stage (GA vs preview) and cloud support beyond Cloud Storage; that `tables.get` returns `sourceFormat: "DELTA_LAKE"` and `list_tables().table_type == "EXTERNAL"` for such tables; whether `_bigquery_table_types` keys `BASE TABLE`/`ICEBERG` ever match `list_tables` output.
5. **mssql / azuresql**: how a Delta external table appears in `INFORMATION_SCHEMA.TABLES`, `sys.external_tables`, `sys.external_file_formats.format_type` (documented range omits DELTA); Azure SQL Database/Managed Instance Delta status (Preview page vs CREATE EXTERNAL FILE FORMAT "Applies to"); Synapse serverless "preview" wording (search snippet only).
6. **ClickHouse**: exact `system.tables.engine` string for Delta tables (`DeltaLake` vs `DeltaLakeS3`...), first release with the engine and its read-stage label, presence of `DataLakeCatalog`-database Delta tables in `system.tables`, `clickhouse-sqlalchemy>=0.3` `get_table_names` (upstream master read, installed 0.2.9).
7. **Vertica**: whether any newer Vertica release added native Delta reading (docs pages checked did not mention it).
8. **Teradata**: whether OTF/DATALAKE Delta tables appear in `DBC.TablesV`, their TableKind, any Delta flag (`DBC.DATALAKEINFOV` page returned 404).
9. **Exasol**: whether the extension or any other Exasol feature exposes Delta data as external/virtual tables; `sqlalchemy_exasol` version actually used (setup pins >=7.1.1, installed 5.2.0).
10. **Pinot**: StarTree Delta connector limits (docs page did not load); OSS status beyond the closed PR.
11. **SingleStore, Salesforce CRM, Domo, Greenplum, Data 360**: all "no evidence" conclusions are absence-of-results from limited searches; Data 360 `ssot/metadata` payload format fields unknown.
12. **Web-search summaries** (labelled "search-snippet") were used for: Synapse OPENROWSET Delta wording, SingleStore Iceberg ingest, Teradata DATALAKE/HELP commands and NOS manifest page, Data 360 UniForm federation, StarTree connector limits, Greenplum Iceberg PXF. These are not verbatim primary-page fetches.
