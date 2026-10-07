# Live verification: Hive Delta Lake detection

Run on 2026-09-25 against the Hive metastore (`dl-hms`) and its MariaDB backing store
(`dl-mariadb`) created for the [Trino run](live-trino-delta-detection.md). `dl-trino`, `dl-presto`
and `dl-starrocks` were not touched.

## Result

| Claim (decision record, section 2, hive row) | Verdict |
|---|---|
| A Delta table in a Hive metastore carries `spark.sql.sources.provider` | **CONFIRMED** — present on `delta_sales` |
| Its value is `delta` | **CONFIRMED, but the case matters**: the stored value is `DELTA` |
| Case-insensitive comparison is required, not optional | **CONFIRMED** — a `== "delta"` check would miss this exact row |
| OM decides the table type before per-table properties are read | **CONFIRMED** |
| ...and therefore cannot use this indicator without restructuring | **REFUTED** — `query_table_names_and_types` is the seam; the change is ~20 lines |
| The shared-metastore false positive (Trino, StarRocks) occurs here too | **REFUTED** — the per-table indicator is immune |
| A Spark-registered Delta table has a placeholder schema | **CONFIRMED** — one column, `col array<string>` |

## Step 1: what the metastore actually stores

Queried directly against the metastore database, before touching any connector code.

```
$ docker exec dl-mariadb mysql -uroot -padmin metastore_db -e "SELECT d.NAME, t.TBL_NAME, p.PARAM_KEY, p.PARAM_VALUE, LENGTH(p.PARAM_VALUE) ..."
```

`delta_schema.delta_sales` (`TBL_TYPE = MANAGED_TABLE`):

| PARAM_KEY | PARAM_VALUE | len |
|---|---|---|
| `location` | `s3a://delta-warehouse/delta_schema/delta_sales-27e64296f9d64b509e757c92ecc7b604` | 79 |
| `numFiles` | `-1` | 2 |
| `presto_query_id` | `20260924_131209_00002_dufr2` | 27 |
| **`spark.sql.sources.provider`** | **`DELTA`** | **5** |
| `totalSize` | `-1` | 2 |
| `transient_lastDdlTime` | `1790255530` | 10 |

`hive_schema.hive_orders` (`TBL_TYPE = MANAGED_TABLE`):

| PARAM_KEY | PARAM_VALUE | len |
|---|---|---|
| `COLUMN_STATS_ACCURATE` | `{"COLUMN_STATS":{"id":"true","sku":"true"}}` | 43 |
| `STATS_GENERATED_VIA_STATS_TASK` | `workaround for potential lack of HIVE-12730` | 43 |
| `auto.purge` | `false` | 5 |
| `numFiles` | `1` | 1 |
| `numRows` | `2` | 1 |
| `presto_query_id` | `20260924_131223_00005_dufr2` | 27 |
| `presto_version` | `418` | 3 |
| `rawDataSize` | `30` | 2 |
| `totalSize` | `360` | 3 |
| `transient_lastDdlTime` | `1790255544` | 10 |

**The key is present, and its value is `DELTA` — upper case, five bytes.** Trino 418 wrote it that
way while its own reader compares case-insensitively
(`HiveUtil.isDeltaLakeTable` uses `equalsIgnoreCase`). So the decision record's "case-insensitive"
note is not a defensive nicety: on the only Delta table anyone has actually measured, a
case-sensitive `== "delta"` comparison returns false. Spark writes `delta` lower case, so both
spellings are live in the wild.

`hive_orders` has **nothing** resembling the key — no `provider`, no format marker. There is no
value that could be mistaken for it.

Storage descriptors and stored columns:

| | `delta_sales` | `hive_orders` |
|---|---|---|
| INPUT_FORMAT | `org.apache.hadoop.mapred.SequenceFileInputFormat` | `org.apache.hadoop.hive.ql.io.orc.OrcInputFormat` |
| OUTPUT_FORMAT | `org.apache.hadoop.hive.ql.io.HiveSequenceFileOutputFormat` | `org.apache.hadoop.hive.ql.io.orc.OrcOutputFormat` |
| SerDe | `org.apache.hadoop.hive.serde2.lazy.LazySimpleSerDe` | `org.apache.hadoop.hive.ql.io.orc.OrcSerde` |
| COLUMNS_V2 | `col` `array<string>` (one row) | `id` `int`, `sku` `string` |

The Delta table's input format and SerDe are placeholders, and its schema in the metastore is the
single `col array<string>` column — the same degenerate schema AWS documents for Spark-registered
Delta tables in Glue, reproduced here by Trino in a plain Hive metastore. **The real schema lives
only in `_delta_log`.**

## Step 2: where the type is decided today

Two connection modes exist (`hive/connection.py:108-120`): a configured **metastore database**
replaces HiveServer2 entirely — "only one of the two engines is ever live" — otherwise the
**HiveServer2** engine is used.

`HiveSource` (`hive/metadata.py:63`) did **not** override `query_table_names_and_types`, so it
inherited the default at `common_db_source.py:344-354`, which returns
`TableNameAndType(name=table_name)` with no type at all. In metastore mode the names come from
`metastore_dialects/mysql/dialect.py:112-117`
(`SELECT TBL_NAME from TBLS tbl WHERE (TBL_TYPE != 'VIRTUAL_VIEW' OR TBL_TYPE IS NULL)`) — names
only, no parameters. So yes: **the type is fixed at listing time, before any per-table property is
read.**

But that does not require restructuring, because `query_table_names_and_types` *is* the designed
seam — the same one `trino/metadata.py:371` and `presto/metadata.py:154` already use.

- **Metastore-database mode (implemented):** override the seam in `HiveSource` and run one extra
  query per schema joining `TBLS`/`DBS`/`TABLE_PARAMS` on
  `PARAM_KEY = 'spark.sql.sources.provider'`. One query per schema, not per table.
- **HiveServer2 mode (not implemented):** the same parameter is only reachable per table, via
  `SHOW TBLPROPERTIES <t>` or by parsing `DESCRIBE FORMATTED`. Note the connector *already* runs
  `describe formatted {table_name}` for comments (`hive/queries.py`, `HIVE_GET_COMMENTS`), and its
  output contains the Table Parameters block — so the cheapest correct fix would reuse that call
  rather than add a new one. That does require restructuring, because the describe happens well
  after the type is fixed. Left alone deliberately.

## Step 3: the change

> **Implementation note.** This live run exercised an earlier shape of the change, which put a single
> `HIVE_METASTORE_GET_TABLE_PROVIDERS` constant in `hive/queries.py`. **The implementation that
> actually ships in this PR is the per-dialect one** — `table_providers_query` declared on
> `metastore_dialects/mixin.py` and defined in `metastore_dialects/mysql/dialect.py` and
> `metastore_dialects/postgres/dialect.py`. The MySQL variant is byte-identical to the query measured
> below; the Postgres variant is the same query with quoted identifiers and is **not** covered by this
> live run, which used a MySQL-backed metastore. The measured behaviour below is unaffected: the
> metastore row, its value, and the comparison are the same.

The earlier shape: `hive/queries.py` gains `HIVE_METASTORE_GET_TABLE_PROVIDERS`, and
`hive/metadata.py` overrides the seam. Comparison is `(providers.get(name) or "").lower() == DELTA_LAKE_PROVIDER` where
`DELTA_LAKE_PROVIDER = "delta"`. Without a metastore connection the override returns the base
result untouched and never runs the query.

Four unit tests in `TestHiveMetastoreDeltaDetection`, built from the rows measured in step 1 rather
than invented ones: the `DELTA` row is detected, a table with no provider row is untouched, a
`parquet` provider is not Delta, and HiveServer2 mode issues no metastore query at all.

## Step 4: API readback after `metadata ingest`

```
$ docker exec openmetadata_ingestion metadata ingest -c /tmp/hive_delta_ingest.yaml
Workflow Success %: 100.0
```

```
GET /api/v1/tables?service=hive_delta_probe&fields=columns

hive_delta_probe.default.delta_schema.delta_sales   tableType=DeltaLake  cols=1  [('col', 'ARRAY')]
hive_delta_probe.default.hive_schema.hive_orders    tableType=Regular    cols=2  [('id', 'INT'), ('sku', 'STRING')]
```

### The false positive does not occur here — and that is the headline

| Connector | indicator granularity | `delta_sales` | `hive_orders` |
|---|---|---|---|
| trino | per catalog | `DeltaLake`, 3 cols | **`DeltaLake`, 0 cols** (wrong) |
| starrocks | per catalog | `DeltaLake`, 3 cols | **`DeltaLake`, 0 cols** (wrong) |
| presto | per catalog (broken) | `Regular`, 3 cols | `Regular`, 0 cols |
| **hive** | **per table** | `DeltaLake`, 1 col | **`Regular`, 2 cols** (correct) |

Trino and StarRocks mistype the plain Hive table because they infer format from the catalog a table
was read through. The Hive indicator is a property of the table row itself, so a shared metastore
cannot confuse it. **This is an argument for preferring per-table indicators wherever both exist** —
notably Glue, where `spark.sql.sources.provider` is available on the same footing.

The cost is the schema: `delta_sales` reports one `col ARRAY` column, because that is genuinely all
the metastore knows. The entity is correctly typed and usefully located, but its column list is
meaningless. That is the section 5 "accepted limitation" showing up verbatim in a second catalog.
`hive_orders`, by contrast, reports both real columns — the placeholder schema is specific to Delta
tables, not a side effect of the mode.

## Step 5: HiveServer2 mode — NOT DONE

No `dl-hiveserver2` was stood up. The metastore-mode work above is complete and independent of it;
HiveServer2 would only answer whether `DESCRIBE FORMATTED` surfaces the same parameter over thrift,
which matters for a change that is explicitly not being made in this pass. To run it later:

```bash
docker run -d --name dl-hiveserver2 --network deltanet \
  -e SERVICE_NAME=hiveserver2 -e IS_RESUME=true \
  -e HIVE_METASTORE_URI=thrift://metastore:9083 apache/hive:4.0.0
docker exec dl-hiveserver2 beeline -u 'jdbc:hive2://localhost:10000/' \
  -e 'DESCRIBE FORMATTED delta_schema.delta_sales;'
```

## Tests

`test_hive.py` 53 passed. Full affected set — hive, both metastore dialects, starrocks, trino,
presto — **123 passed**.

Two caveats about how that number was reached. The ingestion container ships an older `metadata`
package, and three `test_hive.py` failures plus two dialect-test failures were **container
staleness, not this change**: `hive/utils.py`, `metastore_dialects/mysql/dialect.py` and
`metastore_dialects/postgres/dialect.py` all differed from the worktree. Copying the worktree
versions in (backed up first) took the suite to 123 passed with no other edit. None of those three
files is touched by this change.

## Restoring the environment

```bash
docker exec openmetadata_ingestion sh -c \
  'P=/home/airflow/.local/lib/python3.12/site-packages/metadata/ingestion/source/database/hive; \
   cp /tmp/hive_metadata.ORIG.py $P/metadata.py; \
   cp /tmp/hive_queries.ORIG.py $P/queries.py; \
   cp /tmp/hive_utils.ORIG.py $P/utils.py; \
   cp /tmp/metastore_dialects_mysql_dialect.py.ORIG.py $P/metastore_dialects/mysql/dialect.py; \
   cp /tmp/metastore_dialects_postgres_dialect.py.ORIG.py $P/metastore_dialects/postgres/dialect.py'
```

`dl-mariadb` was joined to `ometa_network` so the ingestion container could reach it
(`docker network disconnect ometa_network dl-mariadb` to undo). No container was created or removed
by this run. The `hive_delta_probe` service in the local OM instance is a probe artifact.

## Not covered

One metastore schema version (Hive 3.0.0 on MariaDB 10.6.16) and one writer (Trino 418). A
Spark-written Delta table would carry `delta` lower case — handled by the case-insensitive
comparison, but not measured here. Databricks-written tables are unmeasured. No partitioned Delta
table. HiveServer2 mode untested. Glue, Athena and Unity Catalog remain doc-sourced.
