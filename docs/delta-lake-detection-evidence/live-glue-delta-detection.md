# Glue Delta Lake detection: real AWS (2026-10-07) + emulator (2026-09-25)

Two runs, clearly separated.

- **Part 1 (below), EMULATED, 2026-09-25** — a **moto** Glue emulator. Proves how OpenMetadata reads
  and types a `Parameters` map it is handed.
- **Part 2, [REAL AWS, 2026-10-07](#real-aws-run-2026-10-07--what-aws-actually-writes)** — a real
  account, a real Delta table on real S3, a table written by **real Athena DDL**, and a real
  `metadata ingest` against live `glue.ap-south-1.amazonaws.com`. This supersedes part 1 for the read
  side and closes the Athena producer. It also **corrects three doc-sourced claims** that part 1 and
  the decision record had assumed.

Together these close item 1 of "Before this can be accepted" in
[delta-lake-detection-decision.md](../delta-lake-detection-decision.md) for Glue, except the crawler
producer (blocked at the account level) and Spark `saveAsTable` (skipped by decision).

## Part 1 — EMULATED run (2026-09-25)

> **What this part proves, and what it does not.** The emulator holds a `Parameters` map and returns it
> verbatim through `get_tables`/`get_table`, exactly as boto3 sees the real Glue API. So this run
> proves **how OpenMetadata reads and types the `Parameters` it is given** — the detection branch,
> its case-insensitivity, and Iceberg precedence — end to end through a real `metadata ingest` and a
> real API readback. It does **not** prove **what real AWS actually writes into `Parameters`** for
> each producer. Part 2 does that for Athena, on real AWS, and finds the documented case was wrong.

## Result

| Claim | Verdict (emulated) |
|---|---|
| A table with `Parameters.table_type` = `DELTA`/`delta` types as `DeltaLake` | **CONFIRMED (read side)** |
| A table with `Parameters['spark.sql.sources.provider']` = `delta`/`DELTA` types as `DeltaLake` | **CONFIRMED (read side)** |
| Both keys are compared case-insensitively | **CONFIRMED (read side)** |
| A table carrying both `table_type=ICEBERG` and `spark.sql.sources.provider=delta` stays `Iceberg` | **CONFIRMED (read side)** |
| A plain external table stays `External`; an Iceberg table stays `Iceberg` | **CONFIRMED (read side)** |
| What AWS writes for each producer | **superseded — measured for Athena in part 2; crawler blocked, Spark skipped** |

## Why an emulator, and which one

The decision record (section 8) left open whether Glue is tested against an emulator or a real AWS
account. moto was chosen because:

- Its Glue implementation supports `create_database`, `create_table`, `get_tables` and `get_table`
  with an arbitrary `Parameters` map, round-tripped byte for byte (shown below). That is the entire
  surface the Glue connector's detection reads.
- LocalStack's Glue Data Catalog is a Pro (paid) feature; moto server is free and needs no licence.
- OpenMetadata's Glue connection can be pointed at it with no code change: `awsConfig.endPointURL`
  flows through `AWSClient.get_client` to `session.client(service_name="glue", endpoint_url=...)`
  (`ingestion/src/metadata/clients/aws_client.py:214-216`). `awsRegion` is validated against the real
  AWS region list (`aws_client.py:105-112`), so a real region (`us-east-1`) is used with dummy creds.

## Stack

```
docker run -d --name dl-glue --network ometa_network -p 5001:5000 motoserver/moto:latest
```

moto reachable as `dl-glue:5000` from the `openmetadata_ingestion` container (both on
`ometa_network`). No other `dl-*` container was touched.

## Tables created (moto), and the round-trip proof

Nine tables were seeded into database `delta_schema` via boto3 pointed at the emulator, each with a
realistic `StorageDescriptor` (Parquet SerDe, real columns). moto returned the `Parameters` verbatim:

```
a_delta_upper        | TableType= EXTERNAL_TABLE | Parameters= {'table_type': 'DELTA'}                                         | cols= ['id','region','amount']
b_delta_lower        | TableType= EXTERNAL_TABLE | Parameters= {'table_type': 'delta'}                                         | cols= ['id','region','amount']
c_provider_lower     | TableType= EXTERNAL_TABLE | Parameters= {'spark.sql.sources.provider': 'delta'}                        | cols= ['id','region','amount']
d_provider_upper     | TableType= EXTERNAL_TABLE | Parameters= {'spark.sql.sources.provider': 'DELTA'}                        | cols= ['id','region','amount']
e_spark_placeholder  | TableType= EXTERNAL_TABLE | Parameters= {'spark.sql.sources.provider': 'delta', 'spark.sql.sources.schema.numParts': '1'} | cols= ['col']
f_plain_external     | TableType= EXTERNAL_TABLE | Parameters= {'EXTERNAL': 'TRUE'}                                            | cols= ['id','sku']
g_iceberg            | TableType= EXTERNAL_TABLE | Parameters= {'table_type': 'ICEBERG'}                                       | cols= ['id','data']
h_iceberg_view       | TableType= VIRTUAL_VIEW   | Parameters= {'table_type': 'ICEBERG'}                                       | cols= ['id']
i_iceberg_and_delta  | TableType= EXTERNAL_TABLE | Parameters= {'table_type': 'ICEBERG', 'spark.sql.sources.provider': 'delta'} | cols= ['id','uniform_col']
```

- `(e)` is the **Spark-registered placeholder shape** AWS documents on the Athena metadata-sync page:
  a single `col array<string>` column and empty `PartitionKeys`. moto has no real `_delta_log`, so the
  placeholder was seeded directly — this reproduces the *catalog shape*, not the S3 side.
- `(h)` is the Iceberg `VIRTUAL_VIEW` shape the existing unit test uses.
- `(i)` carries both markers, to observe precedence.

## The detection change

`ingestion/src/metadata/ingestion/source/database/glue/metadata.py`, in `get_tables_name_and_type`,
after the existing Iceberg check so Iceberg keeps precedence:

```python
elif self._is_delta_table(parameters):
    table_type = TableType.DeltaLake
```

with a new helper that reads both keys case-insensitively. The `spark.sql.sources.provider` key is
dotted, so it is not reachable by attribute access on the pydantic model; it is read through
`parameters.model_dump()`, which surfaces it via the model's `extra="allow"` config
(`glue/models.py:28-33`). View handling and column handling are unchanged.

## Unit tests

`TestGlueDeltaDetection` in `ingestion/tests/unit/topology/database/test_glue.py`, in the style of
`TestGlueIcebergView` — it drives the real `GlueSource.get_tables_name_and_type`, not a
reimplementation of the condition on mocks. It feeds the exact `Parameters` of `(a)`–`(i)` above.

```
$ python -m pytest topology/database/test_glue.py::TestGlueDeltaDetection -v
...
10 passed in 7.71s
```

(Run inside the `openmetadata_ingestion` container, whose `metadata` package already has the
`DeltaLake` enum from the earlier Trino work; the worktree has no generated models. The two
pre-existing `GlueUnitTest::test_database_schema_names*` cases fail only under full-suite run order in
this drifted container — they pass in isolation both with and without this change, and they run
*before* the new class in file order, so the change cannot be their cause.)

## Real ingest + API readback

```
$ docker exec openmetadata_ingestion metadata ingest -c /tmp/glue_delta_ingest.yaml
...
Workflow Success %: 100.0
```

Service `glue_delta_probe`, `databaseName: delta_catalog`, `endPointURL: http://dl-glue:5000`. Read
back through `GET /api/v1/tables?service=glue_delta_probe&fields=columns`:

| table | Parameters seeded | tableType | cols | fileFormat |
|---|---|---|---|---|
| (a) a_delta_upper | `table_type=DELTA` | `DeltaLake` | 3 | parquet |
| (b) b_delta_lower | `table_type=delta` | `DeltaLake` | 3 | parquet |
| (c) c_provider_lower | `spark.sql.sources.provider=delta` | `DeltaLake` | 3 | parquet |
| (d) d_provider_upper | `spark.sql.sources.provider=DELTA` | `DeltaLake` | 3 | parquet |
| (e) e_spark_placeholder | `spark.sql.sources.provider=delta` + placeholder schema | `DeltaLake` | 1 (`col`) | parquet |
| (f) f_plain_external | `EXTERNAL=TRUE` | `External` | 2 | parquet |
| (g) g_iceberg | `table_type=ICEBERG` | `Iceberg` | 2 | parquet |
| (h) h_iceberg_view | `table_type=ICEBERG`, `VIRTUAL_VIEW` | `Iceberg` | 1 | parquet |
| (i) i_iceberg_and_delta | `table_type=ICEBERG` + `spark.sql.sources.provider=delta` | `Iceberg` | 2 | parquet |

**(e) in particular.** Detection is correct (`DeltaLake`), but the column list is the single `col`
placeholder — exactly the accepted limitation in section 5 of the decision record. The column count is
right for what the catalog stores; it is not the table's real schema, and cannot be without reading
`_delta_log`.

**(i) in particular.** Iceberg wins. The Iceberg branch is checked first, so a UniForm-style table
carrying both markers is typed `Iceberg`, not `DeltaLake`. This is the deliberate precedence.

**fileFormat.** `parquet` for every row here — the connector derives `fileFormat` from
`StorageDescriptor.SerdeInfo.SerializationLibrary` (`glue/metadata.py:get_format`), which the seed set
to a Parquet SerDe. It is **independent of Delta detection**. Section 5 of the decision record notes
that a real crawler-created Delta table would instead get `fileFormat` `csv` from the 2022 AWS sample
SerDe; that is a real-AWS behaviour this emulator cannot reproduce. The connector sets **no special
`fileFormat` for a Delta table** — Delta is not a `FileFormat` enum value, and this change does not add
one.

## The Athena connector — not tested live

Glue and Athena share only the `Parameters` check: the Athena connector builds its own Glue client
and reads the same `get_tables` response (`athena/metadata.py:144-159`). It is **untested live, in
both parts of this file** — part 2 exercises Athena as a *producer*, not the Athena connector.

> An earlier revision of this file claimed Athena "reads the same
> `table_type`/`spark.sql.sources.provider` keys". That is wrong, and part 2 measures why it matters:
> the connector reads only `table_type`, exact-case against `ICEBERG`, so a real Athena-created Delta
> table types as `External` there. See
> [Correction to this file's earlier Athena claim](#correction-to-this-files-earlier-athena-claim).

Standing up a real test of the connector would need:

- a real Athena workgroup and an S3 result bucket (Athena has no local emulator that runs DDL);
- a real Glue Data Catalog behind it (Athena reads table metadata from Glue), so the `Parameters`
  are written by a real producer, not seeded — **part 2 now provides exactly this**;
- a Delta branch in `query_table_names_and_types`, which does not exist today;
- the Athena connector's `get_table_extensions` gap (returns None unless Iceberg,
  `athena/metadata.py:363-368`) extended for `DeltaLake`, per section 4 of the decision record;
- confirmation of Athena's partitioned-table behaviour (section 6), since a partitioned Delta table
  would report `Partitioned`, not `DeltaLake`.

## Restoring the environment (part 1)

The running dev stack was modified in place; the `DeltaLake` enum and patched
`openmetadata-spec` jar from the earlier Trino work were **left as-is** (not re-swapped). To undo just
this run:

```bash
# restore the connector files patched into the ingestion container
docker exec openmetadata_ingestion sh -c \
  'P=/home/airflow/.local/lib/python3.12/site-packages/metadata/ingestion/source/database; \
   cp /tmp/glue_metadata.ORIG.py $P/glue/metadata.py; \
   cp /tmp/glue_models.ORIG.py  $P/glue/models.py 2>/dev/null || true; \
   cp /tmp/glue_utils.ORIG.py   $P/glue/utils.py 2>/dev/null || true; \
   rm -f $P/custom_property_extension_mixin.py'
# remove the emulator
docker rm -f dl-glue
```

The `glue_delta_probe` database service in the local OM instance is a probe artifact and can be
deleted. Note: `custom_property_extension_mixin.py`, `glue/models.py` and `glue/utils.py` were copied
in from the worktree only because the container's installed `metadata` package predates that refactor;
they are not part of this change.

## Real-AWS run (2026-10-07) — what AWS actually writes

Account `654654299202`, caller `arn:aws:iam::654654299202:user/delta-glue-test`, region `ap-south-1`.
No `endPointURL` anywhere: the connector talked to live `glue.ap-south-1.amazonaws.com` with real
SigV4. This section is **real AWS**. Everything above it is the emulator run and stays labelled as
such.

### 1. A real Delta table on real S3 (no Spark)

Written with delta-rs via the `deltalake` Python library (0.19.2) — the same dependency the dedicated
`deltalake` connector uses in `ingestion/src/metadata/ingestion/source/database/deltalake/clients/s3.py`.
Single writer, so `AWS_S3_ALLOW_UNSAFE_RENAME=true`:

```
$ python step1_write_delta.py
create_bucket OK: om-delta-glue-probe-654654299202
write_deltalake OK -> s3://om-delta-glue-probe-654654299202/delta-probe/orders
version: 0
schema: id: int64
region: string
amount: double
rows:
    id region  amount
0   1   apac   10.50
1   2   emea   20.25
2   3   apac   30.00
--- S3 listing ---
    1279  delta-probe/orders/_delta_log/00000000000000000000.json
    1291  delta-probe/orders/part-00001-4d881a4a-8f18-4576-86cb-2dffbf5f6737-c000.snappy.parquet
```

A real `_delta_log`, so Athena and a crawler both have something genuine to read.

### 2. Producer #1 — real Athena DDL (REAL, closes the Athena item)

The DDL is the exact form on
[Get started with Delta Lake tables](https://docs.aws.amazon.com/athena/latest/ug/delta-lake-tables-getting-started.html)
— no column list, no SerDe, and the page states *"For Delta Lake tables, `CREATE TABLE` statements
that include more than the `LOCATION` and `table_type` property are not allowed."*

```sql
CREATE EXTERNAL TABLE
  delta_probe.athena_delta
  LOCATION 's3://om-delta-glue-probe-654654299202/delta-probe/orders/'
  TBLPROPERTIES ('table_type' = 'DELTA')
```

```
QueryExecutionId: 33e284f6-195d-4c57-b793-c140f250245e
State: SUCCEEDED
```

`glue:GetTable` on the resulting table, byte for byte:

```json
{
  "EXTERNAL": "TRUE",
  "delta.lastCommitTimestamp": "1791371800952",
  "delta.lastUpdateVersion": "0",
  "spark.sql.partitionProvider": "catalog",
  "spark.sql.sources.provider": "delta",
  "spark.sql.sources.schema.numParts": "1",
  "spark.sql.sources.schema.part.0": "{\"type\":\"struct\",\"fields\":[{\"name\":\"id\",\"type\":\"long\",\"nullable\":true,\"metadata\":{}},{\"name\":\"region\",\"type\":\"string\",\"nullable\":true,\"metadata\":{}},{\"name\":\"amount\",\"type\":\"double\",\"nullable\":true,\"metadata\":{}}]}",
  "table_type": "delta"
}
```

```
Location    : s3://om-delta-glue-probe-654654299202/delta-probe/orders/
InputFormat : org.apache.hadoop.mapred.SequenceFileInputFormat
OutputFormat: org.apache.hadoop.hive.ql.io.HiveSequenceFileOutputFormat
SerDe       : org.apache.hadoop.hive.serde2.lazy.LazySimpleSerDe
SerDeParams : {"path": "s3://om-delta-glue-probe-654654299202/delta-probe/orders/", "serialization.format": "1"}
Columns     : [('id', 'bigint'), ('region', 'string'), ('amount', 'double')]
PartitionKeys: []
```

Against the doc-sourced expectations this file previously carried:

| Expectation | Real Athena | Verdict |
|---|---|---|
| `table_type` = `DELTA` | `table_type` = `delta` | **WRONG — lowercased by Athena** |
| Athena writes only `table_type` | writes `table_type` **and** `spark.sql.sources.provider` | **WRONG — writes both** |
| Athena-created table has the `col array<string>` placeholder | real columns + full schema in `spark.sql.sources.schema.part.0` | **WRONG — placeholder is Spark-only** |
| `fileFormat` would be `csv` (suspected, crawler-only) | `LazySimpleSerDe`, `serialization.format` `1` → `csv` | **CONFIRMED, and also for Athena** |

The first row is the consequential one. `_is_delta_table` lowercases before comparing, so it matches.
An exact `== "DELTA"` test — the style the Iceberg branch uses one line earlier at
`glue/metadata.py:327` — would have typed every real Athena-created Delta table as `External`. The
case-insensitivity is **load-bearing**, and that is now measured rather than assumed.

Glue itself does not normalise case: in the same database, `a_delta_upper` was seeded `"DELTA"`
through `glue:CreateTable` and `glue:GetTable` returned `"DELTA"` unchanged. The lowercasing happens
in Athena's DDL layer.

### 3. Real ingest against live AWS, and readback

Eight further tables were seeded into the same real database through `glue:CreateTable`, reproducing
the emulator matrix on the real API, all pointing at the same real Delta location. Real Glue returned
every `Parameters` map verbatim, including mixed case:

```
a_delta_upper        TableType=EXTERNAL_TABLE  Parameters={"table_type": "DELTA"}
b_delta_lower        TableType=EXTERNAL_TABLE  Parameters={"table_type": "delta"}
c_provider_lower     TableType=EXTERNAL_TABLE  Parameters={"spark.sql.sources.provider": "delta"}
d_provider_upper     TableType=EXTERNAL_TABLE  Parameters={"spark.sql.sources.provider": "DELTA"}
e_spark_placeholder  TableType=EXTERNAL_TABLE  Parameters={"spark.sql.sources.provider": "delta", "spark.sql.sources.schema.numParts": "1"}
f_plain_external     TableType=EXTERNAL_TABLE  Parameters={"EXTERNAL": "TRUE"}
g_iceberg            TableType=EXTERNAL_TABLE  Parameters={"table_type": "ICEBERG"}
i_iceberg_and_delta  TableType=EXTERNAL_TABLE  Parameters={"spark.sql.sources.provider": "delta", "table_type": "ICEBERG"}
```

```
$ metadata ingest -c glue_real_ingest.yaml
GetDatabases: Passed
GetTables: Passed
Test connection for 'Glue': Successful
...
Workflow Glue Summary:          Processed records: 11  Updated records: 0  Warnings: 0  Errors: 0  Success %: 100.0
Workflow OpenMetadata Summary:  Processed records: 12  Updated records: 0  Warnings: 0  Errors: 0  Success %: 100.0
Workflow Success %: 100.0
```

`GET /api/v1/tables?service=glue_delta_real&fields=columns&limit=50`:

```
table                tableType    cols fileFormat columns
a_delta_upper        DeltaLake    3    parquet    ['id', 'region', 'amount']
athena_delta         DeltaLake    3    csv        ['id', 'region', 'amount']
b_delta_lower        DeltaLake    3    parquet    ['id', 'region', 'amount']
c_provider_lower     DeltaLake    3    parquet    ['id', 'region', 'amount']
d_provider_upper     DeltaLake    3    parquet    ['id', 'region', 'amount']
e_spark_placeholder  DeltaLake    1    parquet    ['col']
f_plain_external     External     3    parquet    ['id', 'region', 'amount']
g_iceberg            Iceberg      3    parquet    ['id', 'region', 'amount']
i_iceberg_and_delta  Iceberg      3    parquet    ['id', 'region', 'amount']
```

`athena_delta` is the row that matters: a table whose `Parameters` were authored by AWS, over a real
`_delta_log`, ingests as `DeltaLake`. The other eight re-confirm the emulator matrix against the real
API — including `i_iceberg_and_delta` still resolving to `Iceberg`.

Only warnings in the run were `Elasticsearch search failed … [elasticsearch]`: the local
`openmetadata_elasticsearch` container was `Exited (137)`. Search indexing only, `Errors: 0`.

Code under test was the branch's `glue/metadata.py` and `glue/models.py` copied over the installed
package in the local env (which predates them), then restored afterwards and verified identical with
`diff -q`.

### 4. Producer #2 — Glue crawler (BLOCKED, account-level)

Every IAM prerequisite was satisfied first:

```
get_role OMDeltaProbeCrawlerRole
  Arn:   arn:aws:iam::654654299202:role/OMDeltaProbeCrawlerRole
  Trust: {"Statement":[{"Action":"sts:AssumeRole","Effect":"Allow","Principal":{"Service":"glue.amazonaws.com"}}],"Version":"2012-10-17"}
  attached managed -> ['AWSGlueServiceRole']
  inline           -> ['S3Prode']          # S3 GetObject/ListBucket on the probe bucket
```

`create_crawler` with `Targets={"DeltaTargets":[{"DeltaTables":[<path>],"CreateNativeDeltaTable":True}]}`
(the native Delta Lake crawler, per
[DeltaTarget](https://docs.aws.amazon.com/glue/latest/webapi/API_DeltaTarget.html)) still fails:

```
BAD role  + DeltaTargets | AccessDeniedException | ...not authorized to perform: iam:PassRole on resource: arn:aws:iam::654654299202:role/DoesNotExist0000
GOOD role + DeltaTargets | AccessDeniedException | Account 654654299202 is denied access.
GOOD role + S3Targets    | AccessDeniedException | Account 654654299202 is denied access.
```

The bad-role attempt still producing a *specific* `iam:PassRole` denial is the diagnostic: it proves
both `glue:CreateCrawler` and `iam:PassRole` are granted for the real role, so the remaining refusal
is not an identity-policy gap. Same error in `us-east-1`. Data Catalog calls succeed throughout the
same session (`get_tables` returned all nine tables), and there is no Glue resource policy
(`GetResourcePolicy → EntityNotFoundException | Policy not found`). Lake Formation settings and
Organizations are unreadable with this key (`lakeformation:GetDataLakeSettings`,
`organizations:DescribeOrganization` both `AccessDeniedException`), so an SCP cannot be ruled out from
inside.

Conclusion: an account-level restriction on Glue's compute surface, needing AWS Support or account
verification — not a policy change. **Still unmeasured for the crawler:** which key it writes
(`table_type`, `spark.sql.sources.provider`, or `classification`), its case, and the SerDe it sets,
which is what drives `fileFormat`.

### 5. Producer #3 — Spark `saveAsTable` (SKIPPED by decision)

Not attempted. It needs a Spark or EMR environment, and the Athena result already demonstrates both
things it would have shown: that a real producer writes `spark.sql.sources.provider=delta`, and that
real producers do not match the documented case. The `col array<string>` placeholder shape remains
Spark-specific and remains emulated (case `(e)`).

### Real vs still-emulated, at a glance

| Claim | Status |
|---|---|
| Real Glue stores/returns an arbitrary `Parameters` map verbatim, no case folding | **REAL** |
| Connector types `table_type=delta`/`DELTA` as `DeltaLake` through the live Glue API | **REAL** |
| Connector types `spark.sql.sources.provider=delta`/`DELTA` as `DeltaLake` | **REAL** |
| Iceberg keeps precedence when both markers are present | **REAL** (seeded map, live API) |
| Plain external stays `External`, Iceberg stays `Iceberg` | **REAL** |
| A real producer (Athena DDL) writes a map this check matches | **REAL** |
| Athena writes `table_type` lowercase; case-insensitivity is load-bearing | **REAL** |
| Athena-created tables carry real columns, not the placeholder | **REAL** |
| `fileFormat` is `csv` for an Athena-created Delta table | **REAL** |
| Iceberg `VIRTUAL_VIEW` shape, case `(h)` | **EMULATED only** |
| Spark-registered `col array<string>` placeholder, case `(e)` | **EMULATED only** (seeded shape) |
| What the Glue crawler writes | **UNMEASURED — account-level block** |
| What Spark `saveAsTable` writes | **UNMEASURED — skipped by decision** |
| A UniForm table really carries both markers | **UNVERIFIED** (see below) |

### Correction to this file's earlier Athena claim

An earlier revision stated that Athena "reads the same `table_type`/`spark.sql.sources.provider` keys,
already fetched at `athena/metadata.py:155-158`". That is wrong. `query_table_names_and_types`
(`athena/metadata.py:144-159`) fetches the `Parameters` map but reads only `table_type`, compared
exact-case against `ICEBERG`; `spark.sql.sources.provider` is never read and `DeltaLake` appears
nowhere in that file. Applying that check by hand to the measured `athena_delta` map gives
`"delta" != "ICEBERG"` → `TableType.External`. So the same real catalog row types as `DeltaLake`
through the Glue connector and `External` through the Athena connector. `get_table_extensions`
(`:363-368`) likewise returns `None` for anything that is not Iceberg.

### Correction to the UniForm rationale

The Iceberg-precedence comment describes case `(i)` as "a UniForm table carrying both markers".
UniForm's real table properties are `delta.universalFormat.enabledFormats` and
`delta.enableIcebergCompatV2`
([AWS](https://aws.amazon.com/blogs/big-data/expand-data-access-through-apache-iceberg-using-delta-lake-uniform-on-aws/),
[Databricks](https://docs.databricks.com/aws/en/delta/uniform)) — neither is a key `_is_delta_table`
matches, and neither is `table_type=ICEBERG`. Neither source publishes `get-table` output for a
UniForm table, so the both-markers shape is unverified; case `(i)` was constructed by hand.
Precedence is still correct, on a ground that **is** verified: `origin/main` already types
`table_type == "ICEBERG"` as `Iceberg` at `glue/metadata.py:327` and `_is_delta_table` is new in this
branch, so Iceberg-first is what prevents existing tables from being retyped.

### Teardown

Resources this run created, and the exact calls that remove them. **Pending** at time of writing —
held open only because the crawler block may be lifted and re-run; nothing here is load-bearing for
the evidence above.

```python
glue.delete_table(DatabaseName="delta_probe", Name=<each of the 9 tables>)
glue.delete_database(Name="delta_probe")                      # ap-south-1 and us-east-1
s3.delete_objects(Bucket="om-delta-glue-probe-654654299202", Delete={...})   # delta-probe/ + athena-results/
s3.delete_bucket(Bucket="om-delta-glue-probe-654654299202")
```

Created by the account owner for this run and removable with it: role
`OMDeltaProbeCrawlerRole` (+ its inline `S3Prode` and attached `AWSGlueServiceRole`), the inline user
policy granting `glue:*Crawler` and `iam:PassRole`, and the attached `AmazonAthenaFullAccess`.

Local side: the OM database service `glue_delta_real`, and the branch's `glue/metadata.py` /
`glue/models.py` copied over the installed package in the local env — already restored and verified
identical to the backups with `diff -q`.
