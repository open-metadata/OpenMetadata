# Delta Lake table detection in database connectors: decision record

Spike for openmetadata-collate#5993 (epic #5992, implementation #5994).
Status: **PROPOSED, awaiting review.** Trino and StarRocks were confirmed on live systems and Presto was refuted; every other row is sourced from documentation and code only.

## Summary for reviewers

**Goal.** Delta Lake tables that other connectors already see (Glue, Athena, Trino, ...) are typed
`External` or `Regular`. Give them their own table type, the way Iceberg is handled today, using only
what each connector's own catalog reports. No connector opens `_delta_log`.

**What we did.** Read every database connector under
`ingestion/src/metadata/ingestion/source/database/` (51 directories; `common`, `dbt`, `query` and `my_db` are not connectors) and checked vendor
documentation and upstream engine source for a catalog-visible Delta marker. Reports are in
[delta-lake-detection-evidence/](delta-lake-detection-evidence/).

**Result.**
- 7 connectors can be implemented now: glue, athena, trino, unitycatalog, databricks, starrocks, snowflake (Delta external tables only). Trino and StarRocks are confirmed live.
- 4 need extra work: bigquery, clickhouse, redshift, hive.
- Presto was **refuted live**: PrestoDB has no column to detect the connector type, so its detection (and its existing Iceberg detection) never fires.
- 8 have no reliable indicator, 4 cannot host Delta, and the rest have no documented support (full table in section 2).

**How sure we are.** Trino and StarRocks: confirmed live (real engine, real Delta table, real
`metadata ingest`, API readback). Presto: refuted live. Every other row is **verified live: no**.
Code-level claims (file and line) were read in this repository. Vendor claims come from documentation and upstream source fetched during
the research. "No evidence found" means a documentation search found nothing; it is not proof of
absence. The connectors in the current 2.1 proposal are the ones we most need to test live before
this is accepted.

**Decisions we need from reviewers.**
1. **The dedicated `deltalake` connector is to be deprecated. What happens to its storage mode?**
   It reads `_delta_log` directly from S3 or MinIO (`deltalake/clients/s3.py:105-117`). Catalog
   detection cannot replace it, and `datalake` has no Delta handling. Options: keep a storage-only
   reader, teach `datalake` about Delta, or accept and announce the loss. Also confirm the
   deprecation decision and its owner: #5992 currently says the work "does not replace the dedicated
   Delta Lake connector", and we found no issue proposing deprecation.
2. **Which connectors ship in 2.1?** Current proposal: glue, athena, trino, unitycatalog. Presto is
   proposed to be dropped (section 10.1). Open: starrocks (now works, section 10.2), databricks,
   snowflake, bigquery, clickhouse (section 3).
3. **Who owns the three follow-ups?** Partitioned-table type overwrite; Unity Catalog metadata
   fidelity; Presto's existing Iceberg detection, which never fires on PrestoDB.
4. **Glue and Unity Catalog test backend** for #5994's "real representative table": emulated, or a real
   AWS account and Databricks workspace (section 8).
5. **Mistyped tables on shared metastores** (section 10): accept and document, or suppress the entity
   when the column fetch fails for a format-typed table.

**Known limitations we accept.**
- Partitioned Delta tables on athena, trino and starrocks will report `Partitioned`, not `DeltaLake` (section 6).
- Glue tables registered by Spark carry a placeholder schema in the catalog; detection is right, the column list is not (section 5).
- Trino and StarRocks detection is per catalog: Delta tables reached through a `hive` catalog are missed, and on a metastore shared by two catalogs a non-Delta table can be typed `DeltaLake` with no columns (section 10).
- Delta tables in a bucket with no catalog are not seen by any database connector.

## 1. Table type name: `DeltaLake` (decided)

Add `DeltaLake` to `tableType` in `openmetadata-spec/.../entity/data/table.json` (enum at lines
27-42 and the `javaEnums` block), then `make generate`. No such value exists today.

Why not `Delta`: the service type is already `DeltaLake` (`databaseService.json:45,160`), the
connector directory is `deltalake`, and the enum already holds compound values (`MaterializedView`,
`SecureView`). `Delta` alone reads as a diff in a metadata tool: six of the seven `delta` hits in
the connectors were `datetime.timedelta`.

## 2. Connector verdicts

**Now** = documented marker the connector can already reach. **Extra work** = marker exists but the
connector needs a code or query change. Evidence: audit letter and section, in
[delta-lake-detection-evidence/](delta-lake-detection-evidence/). All rows: verified live, no.

| Connector | Verdict | How to spot a Delta table | Can it wrongly match, or miss? | Evidence |
|---|---|---|---|---|
| glue | Now | `Parameters`: `spark.sql.sources.provider` = `delta`, or `table_type` = `DELTA`/`delta`; compare case-insensitively. Athena DDL, Spark and the crawler write different keys | Existing Iceberg check is exact uppercase. UniForm tables may carry both `ICEBERG` and `delta`, so precedence is undecided | B, Glue |
| athena | Now | Same Glue `Parameters`, already fetched (`athena/metadata.py:155-158`) | Same as glue | B, Athena |
| trino | Now | Catalog `connector_name = 'delta_lake'` (query already run, `trino/metadata.py:371`) | **LIVE-VERIFIED 2026-09-24.** Types the whole catalog: Delta tables in a `hive` catalog are missed, *and* non-Delta tables in a `delta_lake` catalog are over-matched — see section 10 | B, Trino, [live run](delta-lake-detection-evidence/live-trino-delta-detection.md) |
| presto | **Drop from 2.1 (proposed)** | ~~Catalog `connector_name = 'delta'`~~ — **REFUTED live 2026-09-24**: PrestoDB has no `connector_name` column | The existing query errors and is swallowed, so the shipped Iceberg rule is dead code too. See section 10.1 | B, Presto, [live run](delta-lake-detection-evidence/live-presto-delta-detection.md) |
| unitycatalog | Now | `TableInfo.data_source_format == DELTA` on the item already listed | Pinned `databricks-sdk~=0.20.0` returns None for UniForm/Iceberg values, so those are missed | C, unitycatalog |
| databricks | Now | `information_schema.tables.data_source_format`; add to the existing per-schema query (`databricks/metadata.py:801-837`) | `DELTA_UNIFORM_*` are Delta-backed; value on views unknown; the per-table fallback path has no format field | C, databricks |
| snowflake | Now, Delta external tables only | `SHOW EXTERNAL TABLES`, column `table_format` = `DELTA` (statement already run, `snowflake/queries.py:371`) | Delta external tables are a Preview feature on a deprecation track. Delta-backed Iceberg tables have no marker | C, snowflake |
| bigquery | Extra work | `externalDataConfiguration.sourceFormat = DELTA_LAKE` from `tables.get`; OM already fetches the table object | Release stage of BigLake Delta unverified | C, bigquery |
| clickhouse | Extra work | `system.tables.engine` starting `DeltaLake` | Exact engine string unverified | C, clickhouse |
| redshift | Extra work | `svv_external_tables.input_format` = `SymlinkTextInputFormat` and location ending `_symlink_format_manifest`; queries do not select these columns | Matches any symlink-manifest table. Product decision: does a manifest snapshot count as a Delta table? | B, Redshift |
| hive | **Now** for metastore-database mode (live-verified, implemented) | metastore `TABLE_PARAMS.spark.sql.sources.provider`, compared case-insensitively — the measured value is `DELTA`, **upper case** | **Only connector with a per-table indicator: no shared-metastore false positive.** Columns are the `col array<string>` placeholder. HiveServer2 mode still needs restructuring — see section 10.3 | B, Hive, [live run](delta-lake-detection-evidence/live-hive-delta-detection.md) |
| starrocks | **Now** (live-verified) | `INFORMATION_SCHEMA.tables.ENGINE = 'DELTALAKE'` — **upper case**, verified byte for byte on 3.2.16 | Casing suspicion **refuted**: the map keys are correct. External catalog reachable today via `connectionArguments` `init_command`. `ENGINE` names the catalog read through, not the table's format — see section 10.2 | B, StarRocks, [live run](delta-lake-detection-evidence/live-starrocks-delta-detection.md) |
| doris | No reliable indicator | none: `ENGINE` is NULL for Delta trino-connector tables (upstream source) | n/a | B, Doris |
| clickzetta | No reliable indicator | `SHOW TABLES` has `is_external` but no format column | Per-table `DESC EXTENDED` output undocumented | B, ClickZetta |
| iomete, datalake | No reliable indicator | iomete: Delta hosting not documented. datalake: no catalog, one object per table | n/a | B, IOMETE, Datalake |
| mssql, azuresql, vertica, teradata | No reliable indicator | vendors document reading Delta; no catalog marker documented | Needs a live instance | C |
| impala, exasol, druid, pinotdb | Cannot host Delta | none documented (Impala: negative evidence only) | n/a | B, C |
| mysql, oracle, postgres, saphana, couchbase | No catalog marker | Vendor-specific Delta reads exist: MySQL HeatWave (OCI), Oracle Autonomous DB (UniForm, read as Iceberg), Postgres via the EDB PGAA extension, SAP HANA Cloud, Couchbase Capella. None is visible through OM's current listing | n/a | D |
| timescale, db2, mongodb, cassandra, dynamodb, cockroach, mariadb, questdb, sqlite, bigtable, burstiq, sas, saperp, singlestore, salesforce, data360, domodatabase, greenplum | No evidence found | none | Absence of documentation, not proof | C, D |
| deltalake | Out of scope | the dedicated connector; see section 7 | n/a | A |

## 3. Proposed 2.1 scope (reviewers to confirm)

Current proposal: **glue, athena, trino, unitycatalog.** Presto is proposed out; starrocks is open for reviewers.

This list was first decided against an earlier matrix that later proved wrong for some rows. Reopened:
- **databricks, snowflake:** now candidates, both marked "Now" above.
- **bigquery, clickhouse:** possible with extra work.
- **starrocks:** the casing blocker is **gone**. Checked on a live StarRocks 3.2.16: external-catalog
  `ENGINE` values are upper case (`DELTALAKE`, `HIVE`, `ICEBERG`), so `RELKIND_MAP` is correct as
  shipped and no casing bug needs filing. Detection works end to end and needs no schema change.
  Reviewers may now consider starrocks for 2.1 on its merits — see section 10.2.
- **presto:** proposed out. The detection query fails on PrestoDB (section 10.1). Options: drop it, fix the
  Iceberg detection first as its own bug, or find a per-table indicator.

## 4. Design

- **Shared code:** a case-insensitive string comparison only. Every rule that names a field, SQL, driver
  or catalog API stays in its connector.
- **Tables already ingested as `External` or `Regular`:** `TableRepository` diffs `tableType` on
  update (`compareAndUpdate("tableType", ...)`, ~line 2308), so the next run flips the type on the
  same entity. No migration. An integration test must confirm the entity id and FQN are unchanged.
- **Athena metadata gap (in 2.1):** `get_table_extensions` returns None unless the type is Iceberg
  (`athena/metadata.py:362-369`). Adding `DeltaLake` there affects only Delta tables. The three Unity
  Catalog gaps (`partition_index` to `tablePartition`, `properties` to `extension`, `nullable` to
  NOT_NULL) are connector-wide, so they go to a separate follow-up titled as Unity Catalog metadata
  fidelity.
- **Trino:** `location` and `partitioned_by` via `$properties` cost one extra query per table; out of 2.1.
  Trino `delta_lake` metadata tables are `$history`, `$partitions`, `$properties`; there is no `$snapshots`.

## 5. Metadata available without reading `_delta_log`

ING = already sent to the server; AVAIL = catalog has it, code drops or never asks (dagger = extra
call per table); NO = not exposed. Detail in
[delta-metadata-fidelity.md](delta-lake-detection-evidence/delta-metadata-fidelity.md).

(The presto column applies only if Presto detection is revived.)

| Kind | glue | athena | trino | presto | unitycatalog |
|---|---|---|---|---|---|
| columns | ING (placeholder for Spark-registered) | ING (placeholder) | ING | ING | ING |
| partitions | columns only | ING | AVAIL (dagger) | NO | AVAIL, free |
| location | ING | ING | AVAIL (dagger) | AVAIL (dagger), unverified | ING |
| properties | ING, flag-gated | AVAIL, fetched then dropped | AVAIL (dagger) | NO | AVAIL, free |
| comments | ING | ING | ING | ING | ING |
| constraints | NO | NO | NOT NULL unverified | NO | PK+FK ING; NOT NULL free |
| protocol/version | NO | NO | AVAIL (dagger) | NO | unverified |

**Accepted limitation, Glue:** AWS documents the schema inserted for Spark-registered Delta tables as
a single `col array<string>` column with empty `PartitionKeys`. Detection is correct; the column list is
not, and cannot be fixed without reading `_delta_log`. #5994's "real representative table" definition
of done must say so. Separately, a crawler-created Delta table would currently get `fileFormat` `csv`
(`glue/metadata.py:536-544`, per the 2022 AWS sample).

## 6. Known limitation: partitioned tables lose the detected type

`common_db_source.py:629-633` sets `tableType = Partitioned` for any partitioned non-view table,
overwriting the detected type. This already happens to Iceberg. It affects connectors built on
`CommonDbSourceService` (35 files reference it): **athena, trino and starrocks**. Glue and unitycatalog
have their own `yield_table` and are unaffected. No partitioned Delta table has been tested on any connector.

**Not fixed in 2.1.** Deferred to a follow-up issue, owner to be named. Candidate fixes:
- (a) skip the overwrite when the detected type is `Iceberg` or `DeltaLake`: fixes both formats on all
  35 connectors, changes Iceberg behaviour for anyone filtering on `Partitioned`;
- (b) a `DeltaLake`-only exception: smallest diff, leaves the same defect for Iceberg.

Rejected: overwrite only when the detected type is `Regular`. Athena types tables `External` by default
(`athena/metadata.py:157`), so partitioned Athena tables would flip from `Partitioned` to `External`.

Consequences for #5994: representative test tables for athena, trino and starrocks must be
unpartitioned, and the connector documentation must state the limitation.

## 7. Deprecating the dedicated `deltalake` connector

Findings from [audit A](delta-lake-detection-evidence/audit-A-deltalake-impact.md), code-checked:
- **Storage mode** reads `_delta_log` directly with the `deltalake` library (S3 or MinIO only). Catalog
  detection does not replace it. Users with Delta tables in a bucket and no catalog would lose their
  tables, columns, partitions and descriptions.
- **Metastore mode** (Hive Thrift or metastore database, via PySpark) is replaceable only if another
  connector can reach the same metastore. For `hive` that needs the extra work in section 2.
- The `datalake` connector has no Delta handling; it treats each file as a table.
- The metastore path is effectively untested: `pyproject.toml:79` ignores `test_deltalake.py`
  (issue #21736).

## 8. Tests and infrastructure

Per in-scope connector, mirroring `TestTrinoIcebergDetection` in
`ingestion/tests/unit/topology/database/test_trino_metadata.py` (audit B section 15 lists the shape per
connector, and one Iceberg test that must not be copied because it never calls production code):
- positive: the Delta marker gives `TableType.DeltaLake`;
- negative: a regular table stays `Regular`, an Iceberg table stays `Iceberg`;
- glue and athena: each marker key, and mixed-case values.

Plus one real-ingestion proof (`metadata ingest`, read back via the API) per distinct mechanism: Glue
parameters, Trino/Presto catalog connector name, Unity Catalog format field.

**Trino, Presto and StarRocks are done.** Trino verified end to end on 2026-09-24 against Trino 418 with a real Delta table
(`_delta_log` present in MinIO), a real `metadata ingest`, and API readback of
`tableType: DeltaLake` — see
[live-trino-delta-detection.md](delta-lake-detection-evidence/live-trino-delta-detection.md). Unit
tests for the Delta branch were added to `TestTrinoIcebergDetection` (19 passed). That run also
proved the schema change is a hard prerequisite: with the unpatched server, identical payloads gave
`Iceberg -> 201` and `DeltaLake -> 400 Invalid request format`, so a connector emitting `DeltaLake`
fails at the sink, not at detection. Presto and StarRocks were tested the same way; see sections 10.1 and 10.2.

**Open risk:** Glue and Unity Catalog cannot be tested locally. Decide between an emulated backend (moto/LocalStack, a mocked Databricks
API) and a real AWS account and Databricks workspace. This decides whether "real representative table"
means a real catalog or a faithful fixture, and it is the main schedule risk.

## 10. NEW, from live verification: the catalog-wide rule over-matches

Section 2 records that a Delta table reached through a `hive` catalog goes undetected. The live run
found the converse too: **a non-Delta table visible through a `delta_lake` catalog is typed
`DeltaLake` with zero columns.** `query_table_names_and_types` types every table in the catalog from
the catalog's connector name alone, and one Hive metastore is commonly shared by both catalogs, so
every schema is visible through both. Trino itself refuses the cross-typed read
(`UNSUPPORTED_TABLE_TYPE ... is not a Delta Lake table`), the column fetch fails, and the entity is
created anyway. Observed readback:

```
trino_delta_probe.delta.delta_schema.delta_sales    tableType=DeltaLake  cols=3   <-- correct
trino_delta_probe.delta.hive_schema.hive_orders     tableType=DeltaLake  cols=0   <-- false positive
trino_delta_probe.minio.delta_schema.delta_sales    tableType=Regular    cols=0   <-- false negative
trino_delta_probe.minio.hive_schema.hive_orders     tableType=Regular    cols=2   <-- correct
```

The shipped Iceberg rule already has this defect; Delta inherits rather than introduces it. It
reproduces on StarRocks too (section 10.2), so it is a cross-connector problem, not a Trino quirk.
The entity survives because the shared column handler swallows the failure and returns no columns
(`sql_column_handler.py:296-303`), instead of failing the table.
**OPEN for reviewers (decision 5):** accept and document, or suppress the entity when the column fetch
fails for a format-typed table.

### 10.1 Presto: the rule does not fire at all (live-verified 2026-09-24)

The sentence "this applies to Presto identically" was wrong. Verified against PrestoDB 0.290 with
the same metastore, MinIO and tables — full evidence in
[live-presto-delta-detection.md](delta-lake-detection-evidence/live-presto-delta-detection.md):

- **`system.metadata.catalogs` on PrestoDB has no `connector_name` column.** It has `catalog_name`
  and `connector_id`. OM's `PRESTO_GET_CATALOG_CONNECTOR` (`presto/queries.py:21-27`) therefore
  fails with `SYNTAX_ERROR: Column 'connector_name' cannot be resolved`, which
  `query_table_names_and_types` swallows in a bare `except Exception`, falling back to `Regular`.
- **The shipped Presto Iceberg detection is dead code** for the same reason. Pre-existing defect,
  not introduced by Delta. Deserves its own bug.
- **`connector_id` is not a substitute:** it carries the catalog name, not the connector type. A
  second catalog named `lakehouse` with `connector.name=delta` reports `connector_id = lakehouse`.
  The `delta` row only looks right because the catalog is named `delta`.
- **Readback with the mirrored patch applied and the `DeltaLake` enum live on the server:**

```
presto_delta_probe.delta.delta_schema.delta_sales    tableType=Regular  cols=3
presto_delta_probe.delta.hive_schema.hive_orders     tableType=Regular  cols=0
```

- The section 10 false positive **could not be reproduced on Presto** — the shared metastore does
  expose `hive_schema` through the `delta` catalog, and the cross-typed read fails
  (`Could not move to latest snapshot`), but since detection never fires both tables land as
  `Regular`. The ingredients are present; only the trigger is missing.

**Consequence: the 2.1 connector list needs revisiting.** Presto should either be dropped, or the
broken query fixed first as its own bug (no replacement column is known), or a different per-table
mechanism found. Also note that Presto's connector name is `delta` while Trino's is `delta_lake`,
and PrestoDB's Hive connector is `hive-hadoop2` rather than `hive`.

**Per-table route verdict: CLOSED (live-verified 2026-10-06).** The "different per-table mechanism"
above was investigated on the live `dl-presto` and does not exist: PrestoDB's Delta connector exposes
no per-table property over SQL (no `$properties` table, `SHOW CREATE TABLE`/`DESCRIBE` show columns
only, `system.metadata.table_properties` lists only connector capability definitions), and
OpenMetadata's `PrestoConnection` has no metastore-database connection mode, so it cannot read
`spark.sql.sources.provider` from the metastore the way the Hive connector does. Full evidence in
[live-presto-delta-detection.md](delta-lake-detection-evidence/live-presto-delta-detection.md), section "Per-table route (live-verified 2026-10-06)".

### 10.2 StarRocks: detection works, and `ENGINE` describes the catalog, not the table (live-verified 2026-09-25)

Verified on StarRocks 3.2.16-8dea52d against the same metastore, MinIO and tables — full evidence in
[live-starrocks-delta-detection.md](delta-lake-detection-evidence/live-starrocks-delta-detection.md):

- **The `ENGINE` value is `DELTALAKE`, upper case** (`HEX` = `44454C54414C414B45`, 9 bytes), not
  `DeltaLake`. One entry added to `RELKIND_MAP`; no other key touched.
- **The suspected casing bug is refuted.** External-catalog tables report the catalog type upper
  cased: `DELTALAKE`, `HIVE`, `ICEBERG`; internal tables report `StarRocks`, which the query's
  existing `ENGINE = 'StarRocks'` branch already matches. The earlier suspicion came from
  `Table.getEngine()`, which serves a different path. `"ICEBERG"` and `"HIVE"` are correct as
  shipped — **no casing bug to file.** (`MYSQL`, `ELASTICSEARCH`, `JDBC`, `HUDI` remain unexercised.)
- **An external catalog is reachable without a schema change**, via
  `connectionArguments: {init_command: "SET CATALOG <catalog>"}`, which flows into SQLAlchemy
  `connect_args`. Passing the catalog as the URL database fails (`1049 Unknown database`). The
  workaround costs one OM service per catalog and hides the default catalog's tables in that
  service, so a first-class `catalog` field is still worth having — as an enhancement, not a
  prerequisite.
- **Readback:**

```
starrocks_delta_probe.deltalake_probe.delta_schema.delta_sales   tableType=DeltaLake  cols=3
starrocks_delta_probe.deltalake_probe.hive_schema.hive_orders    tableType=DeltaLake  cols=0
```

- **The section 10 false positive reproduces, and it originates in StarRocks, not the connector.**
  `hive_orders` read through the `deltalake` catalog reports `ENGINE = DELTALAKE`; `delta_sales`
  read through a `hive` catalog reports `HIVE`; through an `iceberg` catalog both report `ICEBERG`.
  **`ENGINE` names the catalog a table was read through, not the table's storage format.** No
  connector-side code change can fix that, which strengthens the case for the "suppress the entity
  when the column fetch fails" option in section 10.

### 10.3 Hive: a per-table indicator, and it does not false-positive (live-verified 2026-09-25)

Verified against the same Hive metastore the Trino run created, reading the metastore database
directly before any code was written — full evidence in
[live-hive-delta-detection.md](delta-lake-detection-evidence/live-hive-delta-detection.md). The
live run used a MySQL-backed metastore and an earlier single-constant shape of the change; **this PR
ships the per-dialect implementation** (`metastore_dialects/{mysql,postgres}/dialect.py`), whose MySQL
query is byte-identical to the one measured. The Postgres variant is the same query with quoted
identifiers and is not live-covered.

- **The property is there, and its value is `DELTA` — upper case, 5 bytes.** Trino 418 wrote it that
  way; Spark writes `delta`. The case-insensitive comparison is therefore **load-bearing, not
  defensive**: `== "delta"` would miss the only Delta table anyone has measured. `hive_orders`
  carries no key resembling it.
- **The type is decided before properties are read** — confirmed — but that did **not** require
  restructuring. `query_table_names_and_types` is the same seam trino and presto already use;
  `HiveSource` simply never overrode it. Implemented for metastore-database mode: one extra query
  per schema over `TBLS`/`DBS`/`TABLE_PARAMS`.
- **Readback:**

```
hive_delta_probe.default.delta_schema.delta_sales   tableType=DeltaLake  cols=1  [('col', 'ARRAY')]
hive_delta_probe.default.hive_schema.hive_orders    tableType=Regular    cols=2  [('id','INT'),('sku','STRING')]
```

- **The section 10 false positive does not occur here.** Trino and StarRocks mistype `hive_orders`
  as `DeltaLake` because they infer format from the catalog a table was read *through*; the Hive
  indicator is a property of the table row itself, so a shared metastore cannot confuse it:

| Connector | granularity | `delta_sales` | `hive_orders` |
|---|---|---|---|
| trino | per catalog | `DeltaLake`, 3 | **`DeltaLake`, 0** (wrong) |
| starrocks | per catalog | `DeltaLake`, 3 | **`DeltaLake`, 0** (wrong) |
| hive | **per table** | `DeltaLake`, 1 | **`Regular`, 2** (correct) |

  **Reviewers should prefer a per-table indicator wherever one exists** — notably Glue, where
  `spark.sql.sources.provider` sits on the same footing and would avoid the same class of error.
- **The placeholder schema is real:** `delta_sales` ingests with one `col ARRAY` column, because
  that is all the metastore stores (`COLUMNS_V2` holds exactly `col` / `array<string>`). Section 5's
  accepted limitation, confirmed in a second catalog. `hive_orders` reports both real columns, so
  the placeholder is Delta-specific, not a mode artifact.
- **HiveServer2 mode is not implemented and not tested.** The same parameter is only reachable per
  table there. The connector already runs `describe formatted {table_name}` for comments, whose
  output contains the Table Parameters block, so the cheapest fix reuses that call — but it lands
  after the type is fixed, so it needs restructuring. Deliberately out of scope for this pass.

### 10.4 Glue: read side on an emulator (EMULATED 2026-09-25), then real AWS with a real producer (LIVE 2026-10-07, section 10.4.1)

Verified against a **moto** Glue emulator, not real AWS — full evidence in
[live-glue-delta-detection.md](delta-lake-detection-evidence/live-glue-delta-detection.md). moto
returns a `Parameters` map verbatim through `get_tables`/`get_table`, so this run proves **how
OpenMetadata reads and types the `Parameters` it is given**; it does **not** prove **what real AWS
writes** for each producer.

- **Both markers detect, case-insensitively.** `table_type` = `DELTA`/`delta` and
  `spark.sql.sources.provider` = `delta`/`DELTA` all type as `DeltaLake`. The dotted provider key is
  read through `parameters.model_dump()` (the model's `extra="allow"`), not attribute access.
- **Iceberg keeps precedence.** The Delta branch sits after the existing Iceberg check, so a table
  carrying both `table_type=ICEBERG` and `spark.sql.sources.provider=delta` stays `Iceberg` — case
  `(i)`, confirmed on readback.
- **Implemented as a per-table check**, exactly the per-table indicator section 10.3 recommends: a
  Glue table's `Parameters` belong to the table row, so a shared metastore cannot cause the section 10
  false positive that Trino and StarRocks suffer.
- **Readback** (`metadata ingest`, then `GET /api/v1/tables?service=glue_delta_probe`):

```
a_delta_upper        tableType=DeltaLake  cols=3        d_provider_upper     tableType=DeltaLake  cols=3
b_delta_lower        tableType=DeltaLake  cols=3        e_spark_placeholder  tableType=DeltaLake  cols=1  [col]
c_provider_lower     tableType=DeltaLake  cols=3        f_plain_external     tableType=External   cols=2
g_iceberg            tableType=Iceberg    cols=2        h_iceberg_view       tableType=Iceberg    cols=1
i_iceberg_and_delta  tableType=Iceberg    cols=2  <-- both markers, Iceberg wins
```

- **Case `(e)`** confirms section 5's accepted limitation: a Spark-registered Delta table ingests with
  the single `col array<string>` placeholder, because that is all the catalog stores.
- **`fileFormat`** is derived from the SerDe, independent of Delta detection; the connector sets no
  Delta-specific `fileFormat`. The section 5 `csv` concern for crawler-created tables is a real-AWS
  behaviour the emulator cannot reproduce.
- **Producer strings, previously open, now part-closed.** **Athena DDL is measured on real AWS**
  (section 10.4.1) — and it writes `table_type` **lowercase**, plus `spark.sql.sources.provider`, both
  of which this emulated run had assumed. The **Glue crawler is blocked** by an account-level
  restriction, and **Spark `saveAsTable` is deliberately skipped**; both are still unmeasured.
- **Athena** shares only this `Parameters` check. Athena as a *producer* is now verified live;
  the Athena **connector** is still untested and, as section 10.4.1 records, carries no Delta branch
  at all.

#### 10.4.1 Real AWS: real Delta table, real Athena producer, real ingest (LIVE 2026-10-07)

Run against a real AWS account — `arn:aws:iam::654654299202:user/delta-glue-test`, region `ap-south-1`
— with no `endPointURL`, so the connector talked to live `glue.ap-south-1.amazonaws.com` over real
SigV4. This replaces the emulator for the read side and closes the Athena producer. Full evidence in
[live-glue-delta-detection.md](delta-lake-detection-evidence/live-glue-delta-detection.md).

**The underlying table is a real Delta table.** Written with the `deltalake` library (delta-rs 0.19.2,
the same dependency the dedicated `deltalake` connector uses in `clients/s3.py`), so it has a real
`_delta_log` with no Spark involved:

```
write_deltalake OK -> s3://om-delta-glue-probe-654654299202/delta-probe/orders
version: 0
schema: id: int64 / region: string / amount: double
    1279  delta-probe/orders/_delta_log/00000000000000000000.json
    1291  delta-probe/orders/part-00001-4d881a4a-8f18-4576-86cb-2dffbf5f6737-c000.snappy.parquet
```

**What real Athena DDL writes — the measurement that was missing.** The exact DDL from the AWS
getting-started page was submitted through `athena:StartQueryExecution` (state `SUCCEEDED`), with the
uppercase value AWS documents:

```sql
CREATE EXTERNAL TABLE
  delta_probe.athena_delta
  LOCATION 's3://om-delta-glue-probe-654654299202/delta-probe/orders/'
  TBLPROPERTIES ('table_type' = 'DELTA')
```

`glue:GetTable` then returned:

```json
{
  "EXTERNAL": "TRUE",
  "delta.lastCommitTimestamp": "1791371800952",
  "delta.lastUpdateVersion": "0",
  "spark.sql.partitionProvider": "catalog",
  "spark.sql.sources.provider": "delta",
  "spark.sql.sources.schema.numParts": "1",
  "spark.sql.sources.schema.part.0": "{\"type\":\"struct\",\"fields\":[{\"name\":\"id\",\"type\":\"long\",...}]}",
  "table_type": "delta"
}
```

Four claims in the committed code comment and in section 5 are corrected by this:

1. **`table_type` comes back lowercase `delta`, not `DELTA`.** The DDL said `DELTA`; Athena lowercases
   the value before writing it. This is Athena's DDL layer, not Glue — Glue stores values verbatim,
   proven in the same database by `a_delta_upper`, seeded `"DELTA"` through `glue:CreateTable` and
   returned `"DELTA"` unchanged. **The case-insensitive comparison in `_is_delta_table` is therefore
   load-bearing:** an exact `== "DELTA"` test — the style the Iceberg branch uses one line above —
   would type every real Athena-created Delta table as `External`.
2. **Athena writes both markers, not one.** `table_type=delta` *and*
   `spark.sql.sources.provider=delta`. The comment at `glue/metadata.py:331-332` splits them by
   producer ("Athena DDL writes table_type=DELTA, Spark and the crawler write
   spark.sql.sources.provider=delta"); real Athena writes both. The comment needs amending.
3. **Columns are real, not the placeholder.** `[('id','bigint'),('region','string'),('amount','double')]`
   with `PartitionKeys: []`, plus the full Delta schema serialised into
   `spark.sql.sources.schema.part.0`. Athena syncs the schema from `_delta_log` into Glue, so
   section 5's `col array<string>` limitation **does not apply to Athena-created tables**. It still
   applies to the Spark-registered shape, case `(e)`.
4. **`fileFormat` really is `csv`.** Section 5 flagged this as a suspicion about crawler-created
   tables; it is confirmed for Athena-created ones:

```
InputFormat : org.apache.hadoop.mapred.SequenceFileInputFormat
OutputFormat: org.apache.hadoop.hive.ql.io.HiveSequenceFileOutputFormat
SerDe       : org.apache.hadoop.hive.serde2.lazy.LazySimpleSerDe
SerDeParams : {"path": "s3://.../delta-probe/orders/", "serialization.format": "1"}
```

`get_format` matches `.LazySimpleSerDe` and, since `serialization.format != "\t"`, returns
`FileFormat.csv` (`glue/metadata.py:560-563`). Independent of Delta detection, and not something this
change alters.

**Real `metadata ingest` against live AWS** — service `glue_delta_real`, `databaseName: delta_catalog`,
schema filter `^delta_probe$`:

```
GetDatabases: Passed / GetTables: Passed / Test connection for 'Glue': Successful
Workflow Glue Summary:          Processed records: 11  Errors: 0  Success %: 100.0
Workflow OpenMetadata Summary:  Processed records: 12  Errors: 0  Success %: 100.0
Workflow Success %: 100.0
```

`GET /api/v1/tables?service=glue_delta_real&fields=columns`:

| table | producer | `Parameters` | tableType | cols | fileFormat |
|---|---|---|---|---|---|
| `athena_delta` | **real Athena DDL** | `table_type=delta` + `spark.sql.sources.provider=delta` + 5 more | `DeltaLake` | 3 | `csv` |
| `a_delta_upper` | seeded | `table_type=DELTA` | `DeltaLake` | 3 | `parquet` |
| `b_delta_lower` | seeded | `table_type=delta` | `DeltaLake` | 3 | `parquet` |
| `c_provider_lower` | seeded | `spark.sql.sources.provider=delta` | `DeltaLake` | 3 | `parquet` |
| `d_provider_upper` | seeded | `spark.sql.sources.provider=DELTA` | `DeltaLake` | 3 | `parquet` |
| `e_spark_placeholder` | seeded | provider + `numParts` | `DeltaLake` | 1 (`col`) | `parquet` |
| `f_plain_external` | seeded | `EXTERNAL=TRUE` | `External` | 3 | `parquet` |
| `g_iceberg` | seeded | `table_type=ICEBERG` | `Iceberg` | 3 | `parquet` |
| `i_iceberg_and_delta` | seeded | `ICEBERG` + provider `delta` | `Iceberg` | 3 | `parquet` |

The eight seeded rows are the emulator matrix re-run against the real Glue API; the only row that
closes a previously open question is `athena_delta`, because AWS wrote its `Parameters`, not us.
The only run warnings were `Elasticsearch search failed … [elasticsearch]` — the local
`openmetadata_elasticsearch` container was `Exited (137)`. Search indexing only; `Errors: 0`.

**Glue crawler: blocked at the account level, not by permissions.** All IAM prerequisites were
satisfied — role `OMDeltaProbeCrawlerRole` with trust
`{"Principal":{"Service":"glue.amazonaws.com"},"Action":"sts:AssumeRole"}`, `AWSGlueServiceRole`
attached plus an inline S3-read policy, and `iam:PassRole` granted to the caller. `create_crawler`
still fails:

```
BAD role  + DeltaTargets | ...not authorized to perform: iam:PassRole on resource: .../DoesNotExist0000
GOOD role + DeltaTargets | AccessDeniedException | Account 654654299202 is denied access.
GOOD role + S3Targets    | AccessDeniedException | Account 654654299202 is denied access.
```

The bad-role case still producing a specific `iam:PassRole` denial proves `PassRole` and
`glue:CreateCrawler` are both granted for the real role. Same result in `us-east-1`. Data Catalog
calls all succeed in the same session, no Glue resource policy exists
(`GetResourcePolicy → EntityNotFoundException`), so this is an account-level restriction on Glue's
compute surface, needing AWS Support rather than a policy change. **The crawler's `Parameters` and
its SerDe remain unmeasured** — including whether it writes `classification` instead of either key
this check matches.

**Spark `saveAsTable`: deliberately skipped.** It needs a Spark or EMR environment, and the Athena
result above already demonstrates the two things Spark would have tested — that a real producer writes
`spark.sql.sources.provider=delta`, and that real producers disagree with the documented case.

**Two findings for follow-up, outside this change:**

- **The Athena connector has no Delta branch at all.** `athena/metadata.py:144-159` builds its own Glue
  client and reads the same `Parameters`, but only tests
  `params.get("table_type") == ICEBERG_TABLE_TYPE` — exact case, and `spark.sql.sources.provider` is
  never read. Applied by hand to the measured `athena_delta` map: `"delta" != "ICEBERG"` →
  `TableType.External`. So a real Athena-created Delta table types as `DeltaLake` through the Glue
  connector and `External` through the Athena connector, on identical catalog rows.
  `get_table_extensions` (`:363-368`) also returns `None` for anything that is not Iceberg.
- **The UniForm rationale for Iceberg precedence is unverified.** UniForm's real table properties are
  `delta.universalFormat.enabledFormats` and `delta.enableIcebergCompatV2`
  ([AWS](https://aws.amazon.com/blogs/big-data/expand-data-access-through-apache-iceberg-using-delta-lake-uniform-on-aws/),
  [Databricks](https://docs.databricks.com/aws/en/delta/uniform)) — neither is a key `_is_delta_table`
  matches, and neither is `table_type=ICEBERG`. No published `get-table` output shows a UniForm table
  carrying both markers; case `(i)` was constructed by hand. Precedence is still the right default,
  but on a narrower ground that **is** verified: `origin/main` already types
  `table_type == "ICEBERG"` as `Iceberg` at `glue/metadata.py:327`, and `_is_delta_table` is new in
  this branch, so Iceberg-first is what keeps existing tables from being retyped.

## 11. Before this can be accepted

1. Live-verify the markers for the rest of the 2.1 scope: **athena, unitycatalog remain**; **glue** is verified on real AWS including a real Athena-written table (section 10.4.1); its crawler producer string is still unmeasured (account-level block). Done: **Trino** (confirmed), **Presto** (refuted, section 10.1), **StarRocks** (marker is `DELTALAKE`, casing suspicion refuted, section 10.2), **Hive** (confirmed and implemented for metastore mode, section 10.3), **Glue** (confirmed and implemented; read side re-verified on real AWS and the Athena producer measured, section 10.4.1; crawler producer still open).
2. Reviewer decisions 1 to 5 in the summary.
3. Name owners for the three follow-up issues.
4. File the Presto Iceberg dead-code bug as its own issue.
5. Close the unverified lists in the evidence reports (each ends with one): pyathena internals,
   `databricks-sdk` `TableInfo` fields, Trino `SHOW COLUMNS` and `is_nullable` for `delta_lake`,
   `SHOW CREATE TABLE` output for Delta, Athena `information_schema` behaviour for Delta, and the
   Glue `Parameters` written by the **crawler** (the Athena producer is now measured, section 10.4.1;
   Spark `saveAsTable` is skipped by decision).
