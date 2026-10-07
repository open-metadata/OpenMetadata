# Audit D sweep: Delta Lake support in the remaining database connectors

REPO = `<repo>`. Nothing under REPO was edited.
Everything below is "verified live: no". No connector was run against a real service.
Web evidence was gathered on 2026-09-24. Some vendor pages could not be fetched (see UNVERIFIED).

## STEP 1. Derived connector list

Command: for each dir under `REPO/ingestion/src/metadata/ingestion/source/database/`, check for `metadata.py` or `service_spec.py`.

Dirs found (51): athena azuresql bigquery bigtable burstiq cassandra clickhouse clickzetta cockroach common couchbase data360 databricks datalake db2 dbt deltalake domodatabase doris druid dynamodb exasol glue greenplum hive impala iomete mariadb mongodb mssql my_db mysql oracle pinotdb postgres presto query questdb redshift salesforce saperp saphana sas singlestore snowflake sqlite starrocks teradata timescale trino unitycatalog vertica.

Excluded:
- `common`: no metadata.py and no service_spec.py (shared helpers).
- `dbt`: dbt artifacts, told to ignore.
- `query`: lineage/usage only (`lineage.py`, `usage.py`, `service_spec.py`), told to ignore.
- `my_db`: not a real connector. It is a committed scaffold template. `my_db/CONNECTOR_CONTEXT.md:1-10` reads "MyDb Connector — Implementation Brief ... You are implementing a new OpenMetadata connector". Its service_spec uses `MyDbSource`/`MyDbConnection`, and it is tracked in git.
- All connectors in the brief's "other agents" list were subtracted (deltalake, glue, athena, redshift, trino, presto, hive, impala, iomete, starrocks, doris, clickzetta, datalake, databricks, unitycatalog, snowflake, bigquery, mssql, azuresql, clickhouse, vertica, singlestore, teradata, exasol, druid, pinotdb, salesforce, data360, domodatabase, greenplum). All 30 exist in the dir.

Remainder (18), my list:
bigtable, burstiq, cassandra, cockroach, couchbase, db2, dynamodb, mariadb, mongodb, mysql, oracle, postgres, questdb, saperp, saphana, sas, sqlite, timescale.

There is no informix or sapbw4hana directory in this checkout.

### Other service families under `REPO/ingestion/src/metadata/ingestion/source/` (no deep analysis)
`api`, `dashboard`, `database`, `drive`, `drives`, `messaging`, `metadata`, `mcp`, `mlmodel`, `pipeline`, `search`, `security`, `storage`.
- `storage/` holds `gcs`, `s3` and `storage_service.py`. This is the only family that hosts object-store data.
- `drive/` holds `googledrive` and `sftp`. `drives/` holds only `__init__.py`.
- `metadata/` holds `alationsink`, `amundsen`, `atlas`.
- `search/` holds `elasticsearch` and `opensearch`.
- There is no `lakehouse` dir.
- Nothing here looks like a DATABASE-like service hosting Delta tables, apart from `storage` (object stores).

## Summary table

Confidence means confidence in the vendor-doc finding, not in OpenMetadata behaviour.

| Connector | Delta support | Evidence (quote + URL) | Confidence |
|---|---|---|---|
| mysql | **YES**, but only MySQL HeatWave on OCI, read-only, from MySQL 9.5.0. Not community MySQL. | "Delta lake tables (as of MySQL 9.5.0)"; "Loading delta lake tables is only supported in MySQL HeatWave on OCI."; "Only reading of delta lake tables is supported." https://dev.mysql.com/doc/heatwave/en/mys-hw-supported-file-formats.html and https://dev.mysql.com/doc/heatwave/en/mys-hw-lakehouse-limitations-delta.html | High (primary pages fetched) |
| oracle | **YES**, but only Autonomous AI Database Serverless, and only Delta tables with UniForm enabled, read as Iceberg metadata. No native Delta reader documented. | "Autonomous AI Database Serverless can also query Delta Lake tables that have UniForm enabled ..."; "UniForm writes Apache Iceberg metadata for the Delta table, so you can create an external table in Autonomous AI Database against that Iceberg metadata ... and query it like any other Iceberg table." https://docs.oracle.com/en-us/iaas/autonomous-database-serverless/doc/query-external-data-apache-iceberg.html | High for the quote; the scope limit (Autonomous only) is my reading of that page. The fetch tool's own summary said this feature "appears specific to Autonomous"; that is not a direct vendor statement. |
| postgres | **NO in core PostgreSQL.** Third-party extension only: EDB Postgres Analytics Accelerator (PGAA) documents Delta support. | Core: the PostgreSQL wiki FDW list has no Delta entry (https://wiki.postgresql.org/wiki/Foreign_data_wrappers, fetched). EDB (third-party, not PostgreSQL project): "Postgres Analytics Accelerator (PGAA) is a high-performance extension that enables Postgres to query large-scale data stored in open table formats like Delta Lake, Apache Iceberg, and Parquet." https://www.enterprisedb.com/docs/pgaa/latest/ | High for existence; PGAA table syntax not verified (see notes). |
| timescale | NO-EVIDENCE-FOUND (Timescale-specific). Runs on the Postgres path, so the same third-party extensions could apply, but nothing documents that. | Searched Tiger Data docs for "Delta Lake tables query external". Only Iceberg is documented: "Tiger Lake is a native integration enabling synchronization between hypertables and relational tables running in Tiger Cloud services to Iceberg tables running in Amazon S3 Tables". https://docs.tigerdata.com/use-timescale/latest/tigerlake/ (search-result text; page not fetched) | Medium-low |
| saphana | **YES** (SAP HANA Cloud, "SQL on Files"): read-only virtual tables over Delta tables in data lake Files, plus a Delta Sharing remote source. | Search-result text of help.sap.com and community.sap.com, not fetched directly: "virtual tables can be created ... that retrieve their data from a CSV, Parquet, or Delta table stored on a data lake Files instance"; "read-only virtual tables". https://help.sap.com/docs/hana-cloud-database/sap-hana-cloud-sap-hana-database-sql-on-files-guide/delta-lake-table-version . Page titles under the same guide: "Time Travel Queries on Delta Tables", "Replicating Delta Tables to SAP HANA", "Create a Databricks Delta Sharing Remote Source". | Medium: help.sap.com is JS-rendered and returned only "SAP Help Portal" to WebFetch/curl, and community.sap.com returned 403. Existence is supported by page titles and search snippets. |
| couchbase | **YES, but only in Capella Analytics, a separate service from the Data/Query service the OM connector uses.** | "Read-only access to Delta Lake tables stored in cloud object stores." https://docs.couchbase.com/columnar/intro/intro.html ; "You can query `Delta` tables residing in S3 buckets, GCS buckets, or Azure Blob Storage containers ..." https://docs.couchbase.com/analytics/sources/manage-external.html | High for Capella Analytics; the OM connector does not target it (see notes). |
| db2 | NO-EVIDENCE-FOUND | Searched IBM Db2 Warehouse/Db2 12.1 Datalake table docs: "a Datalake table resides in a file or group of files that can be defined as ORC, PARQUET, AVRO or TEXTFILE formats" https://www.ibm.com/docs/en/db2-warehouse?topic=tables-accessing-watsonxdata . IBM community post (2026-03-31): Hive-style and Iceberg tables, "Parquet, ORC, Avro, and ... JSON or Text"; "Delta" does not appear. https://community.ibm.com/community/user/blogs/dominic-so/2026/03/31/datalake-tables-in-db2-open-flexible-access-to-you | Medium: Delta absent from the pages fetched; other IBM pages not searched exhaustively. |
| mongodb | NO-EVIDENCE-FOUND | Atlas Data Federation supported formats: "Avro, Parquet, ORC, JSON, MongoDB Extended JSON, BSON, CSV, TSV". Delta Lake is not in the list. https://www.mongodb.com/docs/atlas/data-federation/supported-unsupported/supported-data-formats/ . Overview lists sources: "MongoDB Atlas clusters, AWS S3 buckets, Azure Blob storage containers, Google Cloud storage buckets, HTTP URLs, and Online Archives." https://www.mongodb.com/docs/atlas/data-federation/overview/ | Medium-high |
| cassandra | NO-EVIDENCE-FOUND | Searched cassandra.apache.org and docs.datastax.com for "Delta Lake": 0 relevant hits (results were unrelated pages). | Low-medium: a negative search only |
| dynamodb | NO-EVIDENCE-FOUND | DynamoDB export to S3: "The export file formats supported are DynamoDB JSON and Amazon Ion formats." https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/S3DataExport.HowItWorks.html . Delta support exists in Athena for Glue-registered tables, not in DynamoDB itself. | Medium |
| cockroach | NO-EVIDENCE-FOUND | Searched cockroachlabs.com for "Delta Lake": nothing relevant. A Databricks community article covers a CockroachDB changefeed into Delta via Databricks. That is Databricks reading Parquet, not CockroachDB exposing Delta. | Low-medium |
| mariadb | NO-EVIDENCE-FOUND | Searched mariadb.com/mariadb.org docs for "Delta Lake": only "Delta Store" (MariaDB Xpand columnar index internals) and backup delta files, both unrelated to Delta Lake. | Low-medium |
| questdb | NO-EVIDENCE-FOUND | QuestDB blog: "Delta Lake and DuckLake are table formats that also keep their data as Parquet, so the same ..." This is a suggestion, not a feature. "Native Iceberg support is on the QuestDB roadmap." https://questdb.com/blog/parquet-and-iceberg-questdb/ | Medium |
| sqlite | NO-EVIDENCE-FOUND | Searched sqlite.org for "Delta Lake": only unrelated "delta" (fossildelta, test-delta). The DuckDB delta extension is not SQLite. https://duckdb.org/docs/current/core_extensions/delta | Low-medium |
| bigtable | NO-EVIDENCE-FOUND | Google Cloud search for Bigtable + Delta Lake returned only BigQuery/BigLake Delta pages (https://docs.cloud.google.com/bigquery/docs/create-delta-lake-table), which are BigQuery, not Bigtable. | Low-medium |
| burstiq | NO-EVIDENCE-FOUND | Searched "BurstIQ LifeGraph Delta Lake / Databricks": no BurstIQ statement about Delta. | Low |
| sas | NO-EVIDENCE-FOUND in vendor docs fetched. Unverified lead: SAS Viya DuckDB libname (2025.07+) could read Delta via DuckDB. | SAS/ACCESS DuckDB "What's New" page fetched; it mentions Parquet and Iceberg, "The document contains no mentions of Delta Lake." https://documentation.sas.com/doc/en/pgmsascdc/v_063/acwn/p1ozr0t2ly4bc2n0zxncjtshlyor.htm . A search summary said the Viya DuckDB libname lets it "consume Parquet data and open table formats such as Iceberg and Delta Lake"; the source pages returned 403 and it is not vendor-docs confirmed. | Low |
| saperp | NO-EVIDENCE-FOUND for the SAP ERP/S4 connector itself. SAP Business Data Cloud (BDC) shares SAP data products to Databricks via Delta Sharing, but that is a different product. | https://qubika.com/blog/sap-business-data-cloud-databricks-connector/ (third-party) says BDC Connect for Databricks "shares curated SAP data products ... through Delta Sharing". No SAP-primary quote gathered. | Low |

Summary by bucket:
- Documented Delta support: mysql (HeatWave on OCI only), oracle (Autonomous DB, UniForm only), saphana (HANA Cloud SQL on Files), couchbase (Capella Analytics only), postgres (third-party EDB PGAA only).
- NO-EVIDENCE-FOUND: timescale, db2, mongodb, cassandra, dynamodb, cockroach, mariadb, questdb, sqlite, bigtable, burstiq, sas, saperp.

## STEP 3. Where support is documented: catalog marker and how OM lists tables

### mysql (HeatWave, OCI, MySQL 9.5.0+)
- **Table creation.** Docs: `CREATE EXTERNAL TABLE table_1(col_1 int, ...) FILE_FORMAT = (FORMAT delta) FILES = (URI = 'oci://mybucket@mynamespace/data_files/');` Source: https://dev.mysql.com/doc/heatwave/en/mys-hw-lakehouse-table-syntax-sql.html . Release note: "MySQL HeatWave Lakehouse now supports reading Delta Lake tables, introducing a new dialect format called 'delta'." https://dev.mysql.com/doc/relnotes/heatwave/en/news-9-5-0.html (9.5.0, 2025-10-21 per the release-notes page title in the search results).
- **Catalog marker.** I found NO documented information_schema marker for the delta format. The limitations page says nothing on catalog representation. The 8.4 manual describes INFORMATION_SCHEMA.TABLES_EXTENSIONS.ENGINE_ATTRIBUTE as "Reserved for future use." https://dev.mysql.com/doc/refman/8.4/en/information-schema-tables-extensions-table.html . Whether the HeatWave `FILE_FORMAT` shows up there is not documented.
- **How OM lists tables.** `MysqlSource(CommonDbSourceService)` at `ingestion/src/metadata/ingestion/source/database/mysql/metadata.py:69`. It does not override `query_table_names_and_types`, so it uses `common_db_source.py:344-354`, which calls `self.inspector.get_table_names(schema_name)` and marks every table `Regular`. The SQLAlchemy MySQL dialect's actual SQL for `get_table_names` was not read.
- **Consequence.** Delta-format external tables are not distinguishable in the OM path. Nothing OM reads from the catalog carries the format.

### oracle (Autonomous AI Database Serverless, UniForm)
- **Table creation.** Docs: create the external table "against that Iceberg metadata (via an Iceberg catalog or the Iceberg root metadata file)"; the doc also says "configure the required object store and catalog credentials ... create the external table with DBMS_CLOUD.CREATE_EXTERNAL_TABLE". Source: the Autonomous Iceberg page above. The Delta table is exposed as an Iceberg external table.
- **Delta Sharing.** "Data shared with you through Delta Sharing is not automatically available and discoverable in your Autonomous Database." https://docs.oracle.com/en-us/iaas/autonomous-database-serverless/doc/adp-consume-share.html . The consume-share flow creates external tables via the "Link Cloud Object" data link job.
- **Catalog marker.** Nothing documented that marks a table as Delta. Oracle documents ALL_EXTERNAL_TABLES: "`ALL_EXTERNAL_TABLES` describes the external tables accessible to the current user." (https://docs.oracle.com/en/database/oracle/oracle-database/23/refrn/ALL_EXTERNAL_TABLES.html). I could not find a Delta or Iceberg format marker there.
- **How OM lists tables.** Oracle overrides `get_table_names` at `oracle/utils.py:357-374`. It runs `ORACLE_GET_TABLE_NAMES` (`oracle/queries.py:155-165`): `SELECT table_name FROM {prefix}_TABLES WHERE ... OWNER = :owner AND IOT_NAME IS NULL AND DURATION IS NULL AND TABLE_NAME NOT IN (SELECT mview_name FROM {prefix}_MVIEWS ...)`. `query_table_names_and_types` is at `oracle/metadata.py:144-160`. It returns regular tables plus materialized views. It does not use `ALL_EXTERNAL_TABLES` and does not set `TableType.External`.
- **Gap.** Whether external tables appear in `ALL_TABLES` (and so in this query) is UNVERIFIED. The Oracle page fetched did not say.

### postgres (third-party EDB PGAA only, not core PostgreSQL)
- **Compatibility.** PGAA supports "Postgres (PG)" 16, 17, 18, "EDB Postgres Extended Server (PGE)" 16-18, "EDB Postgres Advanced Server (EPAS)" 16-18. Community PostgreSQL is included under "Postgres (PG)". https://www.enterprisedb.com/docs/pgaa/latest/overview/compatibility
- **Mechanism.** The Concepts page defines a "Table Access Method (TAM) Architecture" as the "internal Postgres API that allows PGAA to plug in a custom storage engine". https://www.enterprisedb.com/docs/pgaa/latest/overview/concepts/ . A search summary quotes syntax `CREATE TABLE ... USING PGAA WITH (pgaa.format = 'delta', ...)`. I could not fetch a primary page showing it (the Delta Lake pages returned 404 or thin content), so treat the exact syntax as UNVERIFIED.
- **Catalog marker.** Inference, not documented: a TAM-based table would carry a non-default `pg_class.relam` (`pg_am` entry). The documented TAM design is why I infer that. Not verified.
- **How OM lists tables.** `PostgresSource.query_table_names_and_types` at `postgres/metadata.py:155-167`, using `POSTGRES_GET_TABLE_NAMES` (`postgres/queries.py:38-42`): `SELECT c.relname, c.relkind FROM pg_class c JOIN pg_namespace n ... WHERE n.nspname = :schema AND c.relkind in ('r', 'p', 'f') AND relispartition = false`. `RELKIND_MAP` at `common_pg_mappings.py:28-34` maps r to Regular, p to Partitioned, f to Foreign.
- **Consequence.** A PGAA table would surface as relkind `r` (Regular). If a FDW-based extension were used it would surface as `f` (Foreign). The query does not select `relam` or FDW options, so the format is not visible to OM today.
- **Other third-party items (only what I actually saw):**
  - `paradedb/pg_analytics` (formerly pg_lakehouse) supported Delta via FDW. The repo says "The `paradedb/pg_analytics` extension has been discontinued and is archived." https://github.com/paradedb/pg_analytics
  - `pg_mooncake`: its current README describes "a columnstore mirror of your Postgres tables in Iceberg", not Delta. https://github.com/Mooncake-Labs/pg_mooncake . A search summary said older versions could store Delta; that is not verified.
  - Tacnode's `delta_fdw` is a search-summary mention on a Postgres-compatible service, not PostgreSQL.
  - Supabase Wrappers/`wrapper_deltalake`: a community project. The Supabase docs list no Delta wrapper (search summary).
- **Timescale.** `TimescaleSource(PostgresSource)` is at `timescale/metadata.py:52`, so it would inherit this same path.

### saphana (SAP HANA Cloud, SQL on Files)
- **Mechanism.** Virtual tables over Delta tables in data lake Files, read-only. Also a Delta Sharing remote source: `CREATE VIRTUAL TABLE VT_TAB AT <remote_source_name>.<share_name>.<schema_name>.<table_name>;` (search summary of help.sap.com). Delta reader limits: "the existing limitation on Delta tables, which currently supports only reader version 1 ... has been lifted" as of QRC 01/2025 (SAP community, search summary). Not fetched directly.
- **Catalog marker.** Not fetched. Virtual tables are a distinct object type in HANA (SYS.VIRTUAL_TABLES), but that is my recollection, not sourced here. UNVERIFIED.
- **How OM lists tables.** `SaphanaSource(CommonDbSourceService)` at `saphana/metadata.py:103`. It does not override `query_table_names_and_types`, so it uses `common_db_source.py:344-354` (`inspector.get_table_names`). `saphana/connection.py:162` also uses `get_table_names` for the test-connection step "GetTables".
- **Gap.** Whether `sqlalchemy-hana`'s `get_table_names` returns virtual tables was not verified. A filesystem search for the package timed out.

### couchbase (Capella Analytics, not the OM-targeted service)
- Analytics is a separate service: "You do not have to deploy a Couchbase operational database or App Services trial to use Capella Analytics." Its data is "stored in cloud object stores, and separated from computation features." https://docs.couchbase.com/columnar/intro/intro.html
- OM's connector uses the Couchbase SDK: `couchbase/connection.py:38-46` (`Cluster.connect`), and lists buckets and collections (`connection.py:70-80`). It lists tables in `CouchbaseSource.query_table_names_and_types` (`couchbase/metadata.py:93`) and runs N1QL queries through `self.couchbase.query` (`metadata.py:123-161`).
- Delta tables in Capella Analytics do not surface through that path. Nothing documented ties them to buckets, scopes or collections. Not verified live.

## Notes
- The scoping question here is "which of these 18 DB engines document Delta Lake table access at all". None of the 5 positives is plain core open-source engine behaviour. Each is a vendor-cloud or extension feature: MySQL HeatWave on OCI, Oracle Autonomous Serverless, SAP HANA Cloud, Couchbase Capella Analytics, EDB PGAA.
- Delta exposure in these engines is by external table or virtual table over object storage. OM's default listing (`common_db_source.py:344-354`) does not distinguish the format for mysql, saphana, or oracle. Only postgres selects relkind and maps r/p/f, and even that would not show the format.
- I did not read the untracked `docs/delta-lake-detection-connector-matrix.md` and `docs/delta-lake-detection-decision.md` in REPO, to keep this sweep independent.

## UNVERIFIED
1. SAP HANA: help.sap.com and community.sap.com pages could not be fetched (JS shell or 403). The Delta virtual-table claim rests on page titles and search-engine snippets. The exact `CREATE VIRTUAL TABLE ... FORMAT` syntax, catalog marker, minimum HANA Cloud QRC version, and whether `sqlalchemy-hana` lists virtual tables are all unconfirmed.
2. EDB PGAA: exact `CREATE TABLE ... USING PGAA WITH (pgaa.format='delta')` syntax, read-only status, and catalog representation (`pg_class.relam`) are not confirmed from a fetched primary page (some EDB URLs returned 404). PGAA exists and supports Delta per the landing page.
3. Oracle: whether ALL_TABLES includes external tables (affects OM listing). Whether on-prem Oracle Database 23ai/26ai can query Delta tables: only Autonomous pages were found. The Oracle blog post "Query Databricks Delta tables from Oracle Autonomous Database using UniForm" returned 403, so its date is not confirmed. Release note "DBMS_SHARE Subprograms" (2026-05-08) exists but does not name Delta Lake.
4. MySQL: HeatWave `SHOW CREATE TABLE` or information_schema output for a delta table not documented in fetched pages. HeatWave on other clouds (AWS/Azure): the docs say OCI only, not checked for later changes.
5. Couchbase: Capella Analytics only. Whether self-managed "Enterprise Analytics" is separately licensed was in a search snippet, not verified.
6. SAS: the DuckDB-libname Delta lead came from search summaries only. The SAS community pages returned 403, and the fetched SAS/ACCESS DuckDB "What's New" page does not mention Delta.
7. saperp and burstiq: only weak or third-party searches. No vendor-primary docs were read.
8. Timescale/Tiger, Cassandra, Cockroach, MariaDB, SQLite, Bigtable, DynamoDB negatives: based on site-restricted search results, not full-site reads. NO-EVIDENCE-FOUND means no relevant page was found in those queries. It is not proof of absence.
9. The search tool's summary text is not verbatim vendor text. Quotes marked "search summary" are the tool's paraphrase. Quotes from fetched pages are the fetch tool's extraction and may be trimmed.
10. Version numbers are as stated on the cited pages on 2026-09-24. They were not cross-checked against release archives, except the MySQL 9.5.0 release note.

## Addendum (SAP HANA listing, follow-up)
The background search for `sqlalchemy_hana` finished (installed 3.0.3 at `<workspace>/venv/lib/python3.11/site-packages/sqlalchemy_hana`).
`dialect.py:855-869`: `get_table_names` runs `SELECT TABLE_NAME FROM SYS.TABLES WHERE SCHEMA_NAME=:schema AND IS_USER_DEFINED_TYPE='FALSE' AND IS_TEMPORARY='FALSE'`.
Whether HANA virtual tables appear in `SYS.TABLES` is still UNVERIFIED (no SAP page fetched; the venv version may differ from what REPO pins).
This narrows the UNVERIFIED item 1 gap: the listing source is SYS.TABLES only.
