# Delta table metadata fidelity per connector — research for #5993 section 6

**Question.** For a Delta Lake table seen through `glue`, `athena`, `trino`, `presto`,
`unitycatalog`: (A) what does the current OpenMetadata code path already put on the
`CreateTableRequest`, and (B) what else does the catalog API expose without opening `_delta_log`?

Researched 2026-09-24. Code line numbers verified against the working tree on that date
(branch `delta-format-detection-fields`). Vendor claims are cited to a primary source URL.
All paths below are relative to
`<repo>/ingestion/src/metadata/ingestion/source/database/`
unless written out in full.

---

## 1. Summary matrix

Cell legend:
- **ING** = already ingested — the value reaches `CreateTableRequest` / `Column` and is persisted.
- **AVAIL** = available from the catalog without `_delta_log`, but the code drops it or never asks.
- **NO** = not available from that catalog API at all (so not a gap, a limit).
- `†` = costs an extra API call or an extra SQL query per table. `‡` = see the caveat in the
  per-connector section — the value is present but is *wrong or degenerate* for a Delta table.

| Metadata kind | glue | athena | trino | presto | unitycatalog |
|---|---|---|---|---|---|
| 1. columns (name + type) | ING ‡ [a] | ING ‡ [b] | ING [c] | ING [d] | ING [e] |
| 2. partitions (spec) | ING-as-columns, no `tablePartition` [f] | ING [g] ‡ | AVAIL † [h] | NO (undocumented) [i] | AVAIL, free [j] |
| 3. location (storage URI) | ING [k] | ING [l] | AVAIL † [m] | AVAIL † unverified [n] | ING [o] |
| 4. properties / TBLPROPERTIES | ING (flag-gated) [p] | AVAIL, **already fetched and dropped** [q] | AVAIL † [r] | NO (undocumented) [i] | AVAIL, free [s] |
| 5. comments (table + column) | ING [t] | ING [u] | ING [v] | ING [w] | ING [x] |
| 6. constraints (PK / NOT NULL) | NO [y] | NO [z] | NOT NULL: unverified; PK: NO [aa] | NO [aa] | PK/FK: ING [ab]; NOT NULL: AVAIL free [ac] |
| 7. format marker | AVAIL (`Parameters`, read for Iceberg only) [ad] | AVAIL (same Glue read) [ae] | AVAIL (`connector_name`, read for Iceberg only) [af] | AVAIL (`connector_name`, same) [ag] | AVAIL, free (`data_source_format`) [ah] |
| 7b. protocol / reader-writer version | NO [ai] | NO [aj] | AVAIL † (`$properties`) [ak] | NO / unverified [i] | unverified [al] |
| 7c. table version number | NO [ai] | NO [aj] | AVAIL † (`$history.version`) [am] | unverified (`@vN` is a read syntax only) [an] | unverified (`DESCRIBE HISTORY` †) [al] |

### Footnotes

- [a] `glue/metadata.py:528-529` → `_get_column_object` `:421-435` → `columns=list(columns)` `:373`.
  ‡ A Spark/Databricks-registered Delta table carries only a degenerate Hive schema in Glue —
  see Glue section.
- [b] `athena/metadata.py:342-361` → `athena/utils.py:138-245` → `sql_column_handler.py:330-340`.
  ‡ Same degeneracy risk; depends on whether Athena/a crawler synced the schema.
- [c] `trino/metadata.py:198-230` (`SHOW COLUMNS`), installed at `:327`.
- [d] `presto/metadata.py:59-99`, installed at `:114`.
- [e] `unitycatalog/metadata.py:810-843` from `TableInfo.columns`, set at `:647`.
- [f] `glue/metadata.py:531-533` appends `PartitionKeys` to the plain column list;
  `grep -n tablePartition glue/` → no hits. The partition *spec* is never modelled.
- [g] `athena/metadata.py:169-205` builds `TablePartition`; set by `common_db_source.py:634-635`.
  ‡ `common_db_source.py:629-633` then **overwrites `tableType` with `Partitioned`** — this will
  clobber a future `DeltaLake` type. See "implications".
- [h] Trino `delta_lake` exposes a `$partitions` metadata table and a `partitioned_by` table
  property: <https://trino.io/docs/current/connector/delta-lake.html>. OM overrides neither
  `get_table_partition_details` (default `common_db_source.py:491-500` returns `(False, None)`).
- [i] The prestodb Delta connector docs document no metadata tables, no table properties and no
  limitations section:
  <https://github.com/prestodb/presto/blob/master/presto-docs/src/main/sphinx/connector/deltalake.rst>
- [j] `ColumnInfo.partition_index` is in the `tables/list` + `tables/get` response
  (<https://docs.databricks.com/api/workspace/tables/get>); `grep -rn partition_index unitycatalog/`
  → no hits. Also `system.information_schema.columns.PARTITION_INDEX`
  (<https://docs.databricks.com/aws/en/sql/language-manual/information-schema/columns>).
- [k] `glue/metadata.py:390` `locationPath=storage_descriptor.Location`.
- [l] `athena/utils.py:269` → recorded `athena/metadata.py:331-333` → `get_location_path` `:207-211`
  → `common_db_source.py:621`.
- [m] Trino `location` table property, <https://trino.io/docs/current/connector/delta-lake.html>;
  OM does not override `get_location_path` (`common_db_source.py:518-522` returns `None`).
- [n] Presto's connector reuses the Hive metastore modules
  (<https://github.com/prestodb/presto/blob/master/presto-docs/src/main/sphinx/connector/deltalake.rst>),
  so `SHOW CREATE TABLE` (already wired as a string at `presto/queries.py:19`) plausibly carries
  `external_location`. **Unverified** — no primary source states it for the delta connector.
- [o] `unitycatalog/metadata.py:661` `locationPath=table.storage_location`.
- [p] `glue/metadata.py:404-415` → `extension=` `:391`; `models.py:28-33` keeps every extra key
  (`extra="allow"`). Gated on `includeCustomProperties`
  (`custom_property_extension_mixin.py:82-83`) — off by default, so properties are dropped unless
  the pipeline enables it.
- [q] `athena/utils.py:274` already puts `awsathena_tblproperties` in the dict;
  `athena/metadata.py:330-333` reads only `awsathena_location` out of it and discards the rest.
  `get_table_extensions` `:363-374` then returns `None` for anything that is not
  `TableType.Iceberg` (the guard is `:368-369`).
- [r] Trino `$properties` metadata table "provides access to Delta Lake table configuration, table
  features and table properties", <https://trino.io/docs/current/connector/delta-lake.html>.
  OM does not override `get_table_extensions` (`common_db_source.py:524-531`).
- [s] `TableInfo.properties` (key-value map) and `delta_runtime_properties_kvpairs` are in the same
  `tables/list` response, <https://docs.databricks.com/api/workspace/tables/get>; `grep -rn
  "\.properties" unitycatalog/` → no hits, and `yield_table` `:643-662` passes no `extension=`.
- [t] table: `glue/metadata.py:371` `description=table.Description`; column:
  `glue/metadata.py:434` `parsed_string["description"] = column.Comment`.
- [u] table: `athena/metadata.py:326-340`; column: `athena/utils.py:150` / `:207` / `:237`.
- [v] table: `trino/queries.py:36-46` (`system.metadata.table_comments`, batched per schema) via
  `trino/metadata.py:233+`; column: `trino/metadata.py:215`.
- [w] table: `presto/metadata.py:104-111` (regex over `SHOW CREATE TABLE`); column:
  `presto/metadata.py:93`.
- [x] table: `unitycatalog/metadata.py:646`; column: `:828-829`, plus nested struct/array field
  comments via `add_complex_datatype_descriptions` `:833-836`.
- [y] `glue/metadata.py:351` hardcodes `table_constraints = None`. The Glue `Table` structure has no
  constraint member at all: <https://docs.aws.amazon.com/glue/latest/webapi/API_Table.html>.
- [z] `sql_column_handler.py:162-187` calls `get_pk_constraint` / `get_unique_constraints` /
  `get_foreign_keys`; the pyathena dialect implements none, and the underlying Glue catalog has no
  constraint structure (same URL as [y]).
- [aa] Same inspector path as [z]; no PK/FK concept in the Trino or Presto Delta connector docs.
  For Trino, `trino/metadata.py:211` hardcodes `"nullable": True`, so even if `information_schema`
  were read the value would be discarded. Whether Trino's `information_schema.columns.is_nullable`
  reflects the Delta `NOT NULL` invariant is **unverified** — no primary source checked.
- [ab] `unitycatalog/metadata.py:636` → `get_table_constraints` `:675-701` → `:648`.
  Cost note: `table_constraints` is **not returned by the LIST endpoint**
  (<https://docs.databricks.com/api/workspace/tables/get>), so the connector pre-queries
  `system.information_schema.table_constraints` (`unitycatalog/queries.py:219-225`) and calls
  `client.tables.get(full_name)` only for tables that appear there
  (`unitycatalog/metadata.py:499-502`). That machinery already exists.
- [ac] `ColumnInfo.nullable` is in the same response; `get_columns` `:810-843` never sets
  `Column.constraint`.
- [ad] `glue/metadata.py:323-331` reads `Parameters.table_type` but compares only to `"ICEBERG"`.
  Glue `Table.Parameters` is a free-form string map:
  <https://docs.aws.amazon.com/glue/latest/webapi/API_Table.html>.
- [ae] `athena/metadata.py:144-167` reads the same Glue `Parameters` map and compares only to
  `ICEBERG_TABLE_TYPE` (`:81`, `:157`).
- [af] `trino/queries.py:65-71` + `trino/metadata.py:362-378`; the value is fetched then compared
  only to `"iceberg"` at `:371`.
- [ag] `presto/queries.py:21-27` + `presto/metadata.py:145-161`; same, compared at `:154`.
- [ah] `TableInfo.data_source_format` is in the `tables/list` response
  (<https://docs.databricks.com/api/workspace/tables/get>), and
  `system.information_schema.tables.DATA_SOURCE_FORMAT` carries the same
  (<https://docs.databricks.com/aws/en/sql/language-manual/information-schema/tables>).
  `grep -rn data_source_format unitycatalog/` → no hits.
- [ai] Glue's `Table.VersionId` is the *Data Catalog* table-version id, not a Delta table version
  (<https://docs.aws.amazon.com/glue/latest/webapi/API_Table.html>), and nothing in the Glue Table
  structure carries the Delta protocol. `glue/models.py` does not model `VersionId` either.
- [aj] Athena explicitly does not surface Delta versioning: "Athena does not use the versioning
  listed in the Delta Lake documentation" and "**No time travel support** — There is no support for
  queries that use Delta Lake's time travel capabilities"
  (<https://docs.aws.amazon.com/athena/latest/ug/delta-lake-tables.html>).
- [ak] `$properties` "provides access to Delta Lake table configuration, **table features** and
  table properties" (<https://trino.io/docs/current/connector/delta-lake.html>) — that is where
  `delta.minReaderVersion` / `delta.minWriterVersion` / feature names live.
- [am] `$history` "provides a log of the metadata changes performed on the Delta Lake table" with a
  `version` column (<https://trino.io/docs/current/connector/delta-lake.html>). Current version =
  `SELECT max(version) FROM "<table>$history"` — one extra query per table.
- [an] Presto supports `@v4` / `@t2021-11-18 09:45` suffixes on a table reference
  (<https://github.com/prestodb/presto/blob/master/presto-docs/src/main/sphinx/connector/deltalake.rst>),
  which is a *read* syntax. No documented way to read the current version back out.
- [al] `TableInfo` has `updated_at` / `updated_by` but no Delta version field
  (<https://docs.databricks.com/api/workspace/tables/get>). `delta_runtime_properties_kvpairs` is
  documented only as an object — its keys are not enumerated, so whether it carries a version is
  **unverified**. `DESCRIBE HISTORY` would be an extra query per table (not verified against a
  primary source here).

---

## 2. Per-connector detail

### 2.1 Glue

**What is already on the request** (`glue/metadata.py:368-392`):

| field | source | line |
|---|---|---|
| `columns` | `StorageDescriptor.Columns` + `PartitionKeys`, merged | `:528-533`, `:373` |
| `description` | `Table.Description` | `:371` |
| column `description` | `Column.Comment` | `:434` |
| `locationPath` | `StorageDescriptor.Location` | `:390` |
| `fileFormat` | SerDe library → `FileFormat` enum | `:389`, `:536-544` |
| `extension` | `Table.Parameters` → custom properties | `:391`, `:404-415` |
| `tableConstraints` | hardcoded `None` | `:351` |
| `tablePartition` | never set | — |
| `schemaDefinition` | views only | `:367` |

**The Delta-specific difference, and it is severe.** A Delta table registered by Spark (or by the
Athena DDL variant that uses `spark.sql.sources.provider`) carries a **placeholder Hive schema**
in Glue. AWS's own page says so and shows it:

> Note that this same schema (with a single of column named `col` of type `array<string>`) is
> inserted when you use Apache Spark (Athena for Apache Spark) or most other engines to create your
> table.
>
> ```
> CREATE EXTERNAL TABLE
>    [db_name.]table_name(col array<string>)
>    LOCATION 's3://amzn-s3-demo-bucket/{your-folder}/'
>    TBLPROPERTIES ('spark.sql.sources.provider' = 'delta')
> ```

and the matching `aws glue create-table` example on the same page has exactly one column `col` of
type `array<string>`, `"PartitionKeys": []`, and a `SerdeInfo` with **no `SerializationLibrary`**
(<https://docs.aws.amazon.com/athena/latest/ug/delta-lake-tables-syncing-metadata.html>).

Consequences for the current code, all mechanical:
- `_iter_columns` `:528-533` yields one column named `col`, typed `ARRAY<STRING>` — OM persists a
  one-column table that has nothing to do with the real Delta schema.
- `PartitionKeys` is `[]`, so no partition columns are seen even for a partitioned Delta table.
- `get_format` `:537-539` returns `None` because `SerdeInfo.SerializationLibrary` is absent.
- `Table.Parameters` *does* still carry `spark.sql.sources.provider=delta`, and `models.py:31`
  (`extra="allow"`) keeps it, so detection and the properties extension both still work.

The **Athena-registered** variant is different: Athena syncs the real schema into Glue at create
time —

> Athena synchronizes table metadata, including schema, partition columns, and table properties, to
> AWS Glue if you use Athena to create your Delta Lake table. As time passes, this metadata can lose
> its synchronization with the underlying table metadata in the transaction log.
> (<https://docs.aws.amazon.com/athena/latest/ug/delta-lake-tables-syncing-metadata.html>)

so `StorageDescriptor.Columns` and `PartitionKeys` are real, but **may be stale**. The remedies AWS
names are all out-of-band (Glue crawler, drop+recreate, manual update) — none of them is something
the connector can do.

**What the Glue API exposes beyond what is read.** Per
<https://docs.aws.amazon.com/glue/latest/webapi/API_Table.html>, the structure has
`Name, CatalogId, CreatedBy, CreateTime, DatabaseName, Description, FederatedTable,
IsMaterializedView, IsMultiDialectView, IsRegisteredWithLakeFormation, LastAccessTime,
LastAnalyzedTime, Owner, Parameters, PartitionKeys, Retention, Status, StorageDescriptor,
TableType, TargetTable, UpdateTime, VersionId, ViewDefinition, ViewExpandedText, ViewOriginalText`.
`glue/models.py:53-61` models only 7 of these. Unmodelled and potentially useful: `Owner`,
`UpdateTime`, `IsRegisteredWithLakeFormation`. **No Delta protocol or Delta version field exists
anywhere in the structure** — `VersionId` is the catalog's own versioning, not the table's.

No extra API call is needed for any of this: the paginated `get_tables` response already carries
`Parameters`, `PartitionKeys` and the full `StorageDescriptor`. (`glue/metadata.py:479` shows the
connector already knows how to make a per-table `get_table` call — it does so for Iceberg — but
Delta needs nothing that the list response lacks.)

### 2.2 Athena

Athena reads the same Glue catalog, so everything in 2.1 about schema fidelity applies. The Athena
connector is wired differently, though: it goes through pyathena's SQLAlchemy dialect
(`athena/metadata.py:68-74`) with a direct Glue client used only for type detection and Iceberg
column filtering.

**What is on the request** — the generic `common_db_source.py:597-624` path:
`columns` (`athena/utils.py:138-245`), `description` (`athena/metadata.py:326-340`), column
comments (`athena/utils.py:150/207/237`), `locationPath` (`:207-211`), `tablePartition`
(`:169-205`), `schemaDefinition` (SQLAlchemy-reflected `CreateTable`, only when `includeDDL` —
`common_db_source.py:470-471` + `utils/sqlalchemy_utils.py:134-175`), `extension` (**Iceberg only**,
`athena/metadata.py:368-369`), `tableConstraints` (always empty).

**The one clean "fetched and dropped".** `get_table_options` (`athena/utils.py:260-275`) returns

```python
"awsathena_tblproperties": _HashableDict(metadata.table_properties),
```

and `get_table_description` (`athena/metadata.py:330-333`) calls it for **every** table but takes
only `awsathena_location` out of it. The Delta TBLPROPERTIES — including the `table_type`/
`spark.sql.sources.provider` marker — are therefore in memory already and thrown away, at zero
extra query cost.

**What Athena additionally exposes.** DDL support is explicitly enumerated:

> **Limited DDL support** – The following DDL statements are supported: `CREATE EXTERNAL TABLE`,
> `SHOW COLUMNS`, `SHOW TBLPROPERTIES`, `SHOW PARTITIONS`, `SHOW CREATE TABLE`, and `DESCRIBE`.
> (<https://docs.aws.amazon.com/athena/latest/ug/delta-lake-tables.html>)

So `SHOW TBLPROPERTIES` and `SHOW PARTITIONS` *are* reachable as extra queries per table — but the
same values already arrive for free through `get_table_options`/`PartitionKeys`, so there is no
reason to pay for them.

`information_schema` is **not** in that supported list, so treat `information_schema.columns` for a
Delta table as **unverified** (Athena exposes `information_schema` generally; whether it resolves
for a Delta table is not stated on that page).

Also from the same page: no time travel, read-only, and Athena's own Delta version compatibility is
expressed as reader-version ranges, not as something queryable. **The Delta table version and
protocol are not obtainable through Athena.**

Two other Athena-only facts that matter:
- `table_type` alone is not enough here either — the Athena DDL that adds the S3 SerDe `path`
  parameter uses `'spark.sql.sources.provider' = 'delta'` and explicitly **not** `'table_type' =
  'delta'` (syncing-metadata page), reconfirming the two-key rule already in the matrix doc.
- **`Parameters` is only populated with `table_type='DELTA'` on the simple DDL form**, per
  <https://docs.aws.amazon.com/athena/latest/ug/delta-lake-tables-getting-started.html>:
  "For Delta Lake tables, `CREATE TABLE` statements that include more than the `LOCATION` and
  `table_type` property are not allowed."

### 2.3 Trino

The thinnest of the five. `TrinoSource` (`trino/metadata.py:333`) overrides **only**
`set_inspector`, `query_table_names_and_types` and `get_database_names`. Every optional hook —
`get_location_path`, `get_table_partition_details`, `get_table_extensions`, `get_table_ddl` —
falls through to the no-op defaults in `common_db_source.py:491-531`.

On the request today: `columns` + column comments (`SHOW COLUMNS`, `:198-230`), table comment
(`system.metadata.table_comments`, `trino/queries.py:36-46`), and nothing else. `nullable` is
hardcoded `True` at `:211`. `schemaDefinition` is set only for views (`:330` installs
`get_view_definition`; no `get_table_ddl` is registered for Trino, unlike Athena `:73-74`), so a
Delta table gets no DDL.

**What the connector exposes, verified against
<https://trino.io/docs/current/connector/delta-lake.html>:**

- Metadata tables — **exactly three**: `$history`, `$partitions`, `$properties`.
  - `$history`: "provides a log of the metadata changes performed on the Delta Lake table", columns
    `version, timestamp, user_id, user_name, operation, operation_parameters, cluster_id,
    read_version, isolation_level, is_blind_append, operation_metrics`.
  - `$partitions`: "provides a detailed overview of the partitions of the Delta Lake table", with
    `partition, file_count, total_size, data` (min/max/null_count).
  - `$properties`: "provides access to Delta Lake table configuration, table features and table
    properties" as key/value pairs.
  - **`$snapshots` does not exist for `delta_lake`** — that is an Iceberg-connector table. Do not
    copy the Iceberg metatable set across.
- Table properties: `location` ("File system location URI for the table"), `partitioned_by` ("Set
  partition columns"), `checkpoint_interval`, `change_data_feed_enabled`, `column_mapping_mode`
  (ID/NAME/NONE), `deletion_vectors_enabled`. These are what `SHOW CREATE TABLE` renders.
- Comments: `COMMENT` is a supported operation, and the config property
  `delta.metastore.store-table-metadata` "Store table comments and colum definitions in the
  metastore" — i.e. comments are first-class.
- Constraints: the page documents **no** NOT NULL or primary-key support.
- `DESCRIBE` / `SHOW CREATE TABLE`: the page does **not** document their output for Delta —
  **unverified** what exactly `SHOW CREATE TABLE` renders, though `location`/`partitioned_by` being
  table properties implies they appear there.

`SHOW COLUMNS` returns `Column | Type | Extra | Comment`, but Trino's own reference
(<https://trino.io/docs/current/sql/show-columns.html>) gives no description for `Extra` and its
examples leave it blank. **Do not assume `Extra` marks partition keys** — unverified.

Cost model: `$properties`, `$partitions` and `$history` are each one extra query per table. Nothing
Delta-specific is free on the Trino path except the catalog `connector_name`, which
`trino/metadata.py:366-369` already queries once per catalog.

### 2.4 Presto

Structurally identical to Trino and thinner still. `PrestoSource` (`presto/metadata.py:118`)
overrides the same three methods and nothing else; every optional hook is the `common_db_source`
no-op. On the request: `columns` + column comments (`SHOW COLUMNS` via pyhive, `:59-99`) and the
table comment scraped out of `SHOW CREATE TABLE` with a regex (`:104-111`). No location, no
partitions, no properties, no DDL, no constraints.

**Where Presto is plainly thinner than Trino.** The prestodb Delta connector documentation
(<https://github.com/prestodb/presto/blob/master/presto-docs/src/main/sphinx/connector/deltalake.rst>)
documents:
- reading via the "Delta Kernel API provided by Delta Lake project to read the table metadata";
- reuse of the Hive connector modules for metastore/S3/ADLS/Glue connectivity;
- four config properties (`hive.metastore.uri`, `hive.metastore.catalog.name`,
  `delta.parquet-dereference-pushdown-enabled`, `delta.case-sensitive-partitions-enabled`);
- `$path$`-schema path queries and `@v4` / `@t<timestamp>` time-travel suffixes;
- a type-mapping table.

It documents **no** metadata/system tables (no `$history`, `$properties`, `$partitions`), **no**
table properties, and has **no** limitations section. So the Trino playbook does not port: the
`$properties`/`$history`/`$partitions` reads that would give Trino location, partition spec,
properties and version have **no documented Presto equivalent**.

`presto/metadata.py:145-161` already runs the catalog-connector query and already holds
`connector_name`; that value being `"delta"` is the only Delta-relevant fact the connector can get
without new documented surface. Anything beyond it (e.g. `external_location` from
`SHOW CREATE TABLE`, which `presto/queries.py:19` already issues for the comment regex) is
**unverified** for the Delta connector.

### 2.5 Unity Catalog

The richest of the five, and the one with the most free-but-unread fields.

Listing path: `client.tables.list(catalog_name, schema_name, max_results=0)`
(`unitycatalog/metadata.py:491-496`) — i.e. `GET /api/2.1/unity-catalog/tables`. A per-table
`client.tables.get(full_name)` is issued **only** for tables that
`system.information_schema.table_constraints` (`unitycatalog/queries.py:219-225`) says have
constraints (`:499-502`). In incremental mode every changed table gets a `tables.get` (`:538`).

On the request today (`:643-662`): `columns` (+ column comments, + nested-field comments),
`description`, `tableConstraints`, `schemaDefinition` (`SHOW CREATE TABLE`, `includeDDL`-gated,
`:601-613`), `owners`, `tags`, `locationPath`. **No `extension=` at all**, and **no
`tablePartition`**.

**Unread fields already in the same response** — per
<https://docs.databricks.com/api/workspace/tables/get>, `TableInfo` carries
`name, catalog_name, schema_name, table_type, data_source_format, storage_location, view_definition,
view_dependencies, sql_path, owner, comment, storage_credential_name, table_constraints, row_filter,
pipeline_id, enable_predictive_optimization, metastore_id, full_name, created_at, created_by,
updated_at, updated_by, table_id, delta_runtime_properties_kvpairs, deleted_at,
effective_predictive_optimization_flag, access_point, browse_only, securable_kind_manifest, columns,
properties`; and each `columns[]` entry carries
`name, type_text, type_name, position, type_precision, type_scale, type_interval_type, type_json,
comment, nullable, partition_index, mask`.

Of those, **four are free wins** (zero extra API calls, already in the list response, verified
absent from the code by grep):
1. `data_source_format` — the Delta marker itself.
2. `columns[].partition_index` — "Position (numbered from 1) of the column in the partition, NULL if
   not a partitioning column" — enough to build a full `TablePartition` spec in column order.
3. `properties` (+ `delta_runtime_properties_kvpairs`) — the Delta TBLPROPERTIES.
4. `columns[].nullable` — enough for a `NOT_NULL` column constraint.

Only `view_dependencies` and `table_constraints` are documented as *not* set by the LIST endpoint,
and the connector already handles the latter.

**`system.information_schema` alternative.** The same facts are queryable in SQL, which matters
because the connector already has a `sql_connection` and already reads
`system.information_schema.tables` (`unitycatalog/queries.py:168-179`) and
`.table_constraints` (`:219-225`):
- `tables`: `TABLE_CATALOG, TABLE_SCHEMA, TABLE_NAME, TABLE_TYPE, IS_INSERTABLE_INTO,
  COMMIT_ACTION, TABLE_OWNER, COMMENT, CREATED, CREATED_BY, LAST_ALTERED, LAST_ALTERED_BY,
  DATA_SOURCE_FORMAT, STORAGE_PATH, STORAGE_SUB_DIRECTORY` (the last "Discontinued. Always NULL.")
  — <https://docs.databricks.com/aws/en/sql/language-manual/information-schema/tables>.
  The existing `UNITY_CATALOG_EXTERNAL_TABLES` query at `:168-179` already selects from this view
  and could add `data_source_format` for free.
- `columns`: includes `PARTITION_INDEX`, `COMMENT`, `IS_NULLABLE`, `FULL_DATA_TYPE`
  — <https://docs.databricks.com/aws/en/sql/language-manual/information-schema/columns>.
- `table_constraints`: already used.

**Version.** `TableInfo` has `updated_at`/`updated_by` but **no Delta version field**.
`delta_runtime_properties_kvpairs` is documented only as an untyped object, so whether it carries
`delta.minReaderVersion` etc. is **unverified**. A Delta table version would need
`DESCRIBE HISTORY` — an extra SQL query per table, and not verified against a primary source here.

---

## 3. Implications for #5993 section 6

### 3.1 Must fix inside 2.1 scope — otherwise the feature is wrong

1. **`common_db_source.py:629-633` will clobber `DeltaLake` with `Partitioned`.** Any partitioned
   Delta table on the Athena path is retyped `Partitioned` after `yield_table` builds the request.
   The same code already does this to `Iceberg`, so it is a pre-existing bug, but shipping
   `DeltaLake` without fixing it means "detection works, except on partitioned tables", which is
   most real Delta tables. Add `TableType.DeltaLake` (and `Iceberg`) to the exclusion tuple at
   `:629-632`. Cost: one line. Glue/Trino/Presto/UC are unaffected (Glue and UC have their own
   `yield_table`; Trino/Presto never report partitions).

2. **Document the Glue/Athena schema-fidelity limit in the decision record.** For a
   Spark-registered Delta table, Glue holds a single placeholder column `col array<string>`
   (AWS primary source, quoted in 2.1). OpenMetadata will type the table `DeltaLake` correctly and
   still show a garbage one-column schema. This is **unfixable without reading `_delta_log`** and
   must be stated as an accepted limitation of the no-`_delta_log` scope, not left for a user to
   discover. Same for staleness on the Athena-registered path.

### 3.2 Gaps worth closing in 2.1 — ranked cheapest first

| # | Connector | Gap | Cost | Why |
|---|---|---|---|---|
| 1 | unitycatalog | `columns[].partition_index` → `tablePartition` | free (same response), ~15 lines | Highest-value/lowest-cost item in the whole set. Currently the *only* one of the five connectors with a partition spec available for free and not using it. |
| 2 | unitycatalog | `properties` + `delta_runtime_properties_kvpairs` → `extension` | free (same response); wire `CustomPropertyExtensionMixin` in, copying `glue/metadata.py:404-415` | Carries every Delta TBLPROPERTY including column-mapping mode and CDF flags. Flag-gated on `includeCustomProperties`, so it is opt-in and cannot regress anyone. |
| 3 | athena | drop the Iceberg-only guard at `athena/metadata.py:368-369` so `awsathena_tblproperties` reaches `extension` | free — the value is already fetched at `athena/utils.py:274` and discarded at `:330-333` | Pure "fetched and dropped". Also flag-gated. Note this needs `get_table_options` results to be threaded out of `get_table_description`, which is a small refactor, not a new query. |
| 4 | unitycatalog | `columns[].nullable` → `Column.constraint = NOT_NULL` | free | Delta's only real constraint kind besides PK/FK; UC already ingests PK/FK. |
| 5 | trino | `location` + `partitioned_by` via one `$properties` read per table | 1 extra query/table | Brings Trino to parity with Glue/Athena/UC on the two fields users notice most. Gate it behind a config flag or behind `connector_name == 'delta_lake'` so non-Delta catalogs pay nothing. |

### 3.3 Declare out of scope for 2.1

- **Delta protocol / reader-writer version, and the Delta table version number, on glue, athena and
  presto.** Not exposed by those catalogs at all (Glue has no protocol field; Athena states no time
  travel and does not surface Delta versioning; Presto documents no metadata tables). Attempting it
  means reading `_delta_log`, which is out of scope by construction.
- **Delta version on trino** (`max($history.version)`) — technically available but one extra query
  per table for a value the OM `Table` schema has nowhere to put except a custom property. Defer
  until there is a real consumer.
- **Constraints on glue, athena, trino, presto.** The Glue `Table` structure has no constraint
  member; the Trino/Presto Delta connector docs document none. Nothing to close.
- **A `delta` member on the `fileFormat` enum.** `table.json`'s `fileFormat` enum is
  `csv, csv.gz, tsv, avro, parquet, pq, pqt, parq, parquet.snappy, json, json.gz, json.zip, jsonl,
  jsonl.gz, jsonl.zip, MF4` — file-level formats, not table formats. `tableType = DeltaLake` already
  carries the signal; adding `delta` there would create two competing markers. Recommend **no**.
- **Presto beyond the `connector_name` check.** Everything else would rest on undocumented
  behaviour. Keep Presto at detection-only and say so.
- **`TableType.Partitioned` vs `DeltaLake` as a modelling question.** The enum is single-valued, so a
  partitioned Delta table can only be one of them. 3.1(1) resolves it in favour of `DeltaLake`
  (partitioning is already expressed structurally via `tablePartition`); flag this for the
  maintainer as a deliberate choice, not an accident.

---

## 4. Explicitly unverified

1. **pyathena's `_get_table` internals.** `pyathena` is not installed in this checkout
   (`find / -path "*pyathena/sqlalchemy*"` → nothing), so which AWS API backs
   `athena/utils.py:142` / `:267` (`self._get_table`) is not verified from source. The observable
   fields it returns (`columns`, `partition_keys`, `parameters`, `location`, `table_properties`) are
   Glue-catalog fields either way, so the conclusions above do not depend on it — but "one extra API
   call or not" for `awsathena_tblproperties` rests on the call already being made for
   `awsathena_location`, which **is** verified at `athena/metadata.py:330-333`.
2. **`databricks-sdk` `TableInfo` shape.** The SDK is not installed here
   (`ingestion/setup.py:63` pins `databricks-sdk~=0.20.0`); the field list is taken from the
   Databricks REST reference, not from the Python model. If the 0.20.x model omits
   `partition_index` or `properties`, item 3.2(1)/(2) would need the `information_schema` route
   instead — both are documented as columns of `system.information_schema.columns`/`.tables`.
3. **Trino `SHOW COLUMNS` `Extra` column.** Undocumented in Trino's own reference; do not rely on it
   for partition keys.
4. **Trino `information_schema.columns.is_nullable` for `delta_lake`.** Not checked against a
   primary source; the Delta `NOT NULL` invariant may or may not surface there.
5. **Trino `SHOW CREATE TABLE` / `DESCRIBE` output for a Delta table.** Not documented on the
   connector page.
6. **Presto `SHOW CREATE TABLE` carrying `external_location` for a Delta table.** Plausible given
   the Hive-module reuse; not stated by any primary source.
7. **Databricks `delta_runtime_properties_kvpairs` key set**, and whether `DESCRIBE HISTORY` is the
   supported way to read a UC Delta table's version.
8. **Athena `information_schema` behaviour for a Delta table.** `information_schema` is not in the
   supported-DDL list quoted above; whether it resolves is untested.
9. **Everything above is doc- and code-sourced, not live-verified.** No Glue/Athena/Trino/Presto/UC
   instance with a real Delta table was queried, so all "already ingested ‡" claims about the
   *content* of Glue's `StorageDescriptor.Columns` for a Delta table rest on the AWS documentation
   quotes, not on an observed catalog.
