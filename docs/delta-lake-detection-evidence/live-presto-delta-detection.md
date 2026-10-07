# Live verification: Presto Delta Lake detection

Run on 2026-09-24 against a real PrestoDB 0.290, reusing the Hive metastore, MinIO and tables from
the [Trino run](live-trino-delta-detection.md). Same method, opposite outcome.

## Result

| Claim (decision record, section 2, presto row) | Verdict |
|---|---|
| `connector_name == 'delta'` identifies a Delta catalog | **REFUTED** — PrestoDB has no `connector_name` column |
| Presto can be shipped as detection-only in 2.1 | **BLOCKED** — there is no catalog-level indicator to detect with |
| Presto shows the same catalog-wide false positive as Trino | **NOT REACHED** — detection never fires, so both tables land as `Regular` |
| The shipped Iceberg rule works on Presto | **REFUTED — pre-existing dead code**, see below |

## The refuting fact

OpenMetadata's `PRESTO_GET_CATALOG_CONNECTOR` (`presto/queries.py:21-27`) is:

```sql
SELECT "connector_name"
FROM "system"."metadata"."catalogs"
WHERE "catalog_name" = :catalog_name
```

That column does not exist in PrestoDB. The table has two columns:

```
$ docker exec dl-presto presto-cli --server localhost:8080 --execute "DESCRIBE system.metadata.catalogs"
"catalog_name","varchar","",""
"connector_id","varchar","",""
```

Running OM's exact query through the same driver the connector uses:

```
EXCEPTION TYPE: DatabaseError
EXCEPTION: (pyhive.exc.DatabaseError) {'message': "line 2:8: Column 'connector_name' cannot be resolved",
           'errorCode': 1, 'errorName': 'SYNTAX_ERROR', 'errorType': 'USER_ERROR', 'retriable': False, ...
```

`query_table_names_and_types` wraps the query in a bare `except Exception` that logs at debug level
and falls through to `TableType.Regular`. So on PrestoDB the branch is never reached — **the shipped
Iceberg detection for Presto is dead code, and the proposed Delta branch inherits that.** This is a
pre-existing defect in `presto/metadata.py`, not something Delta introduces.

## `connector_id` is not a substitute

The obvious repair — read `connector_id` instead — does not work. `connector_id` carries the
**catalog name**, not the connector type. Proven by configuring a second catalog named `lakehouse`
that also uses `connector.name=delta`:

```
$ docker exec dl-presto presto-cli --server localhost:8080 \
    --execute "SELECT catalog_name, connector_id FROM system.metadata.catalogs ORDER BY catalog_name"
"delta","delta"
"lakehouse","lakehouse"     <-- also connector.name=delta, but reports 'lakehouse'
"minio","minio"
"system","system"
```

The first row only looks correct because the catalog happens to be named `delta`. Detection built on
`connector_id` would be detection on a naming convention.

## Stack

PrestoDB 0.290 on the existing `deltanet` network, reusing `dl-hms` and `dl-minio` untouched;
`dl-trino` was not modified. Catalog files, with property names taken from PrestoDB's own docs
(`presto-docs/src/main/sphinx/connector/deltalake.rst` in `prestodb/presto`), not assumed from
Trino:

```properties
# etc/catalog/delta.properties
connector.name=delta
hive.metastore.uri=thrift://metastore:9083
hive.s3.path-style-access=true
hive.s3.endpoint=http://s3:9000
hive.s3.aws-access-key=hiveaccesskey
hive.s3.aws-secret-key=hivesecretkey
```

Two differences from Trino worth recording:

- the connector is `delta`, not `delta_lake`;
- PrestoDB's Hive connector is `hive-hadoop2`, not `hive`, so the negative-case catalog file differs.

A stock `jvm.config` must keep `-Djdk.attach.allowAttachSelf=true`; overwriting `etc/` without it
makes the server exit 1 with `Can not attach to current VM`.

## Presto can read the Delta table

The failure is in detection, not connectivity:

```
SELECT count(*) FROM delta.delta_schema.delta_sales   -> 2
SELECT count(*) FROM minio.hive_schema.hive_orders    -> 2
SELECT count(*) FROM delta.hive_schema.hive_orders    -> Query failed: Could not move to latest
                                                         snapshot on table 'hive_schema.hive_orders'
SHOW SCHEMAS FROM delta -> "$path$", default, delta_schema, hive_schema, information_schema
```

The shared metastore exposes `hive_schema` through the `delta` catalog here exactly as it did on
Trino, and the cross-typed read fails with Presto's equivalent error. The ingredients for the
section 10 false positive are present; only the detection step is missing, so it cannot manifest.

## API readback after `metadata ingest`

With `presto/metadata.py` patched to add `row[0] == "delta" -> TableType.DeltaLake` (mirroring the
committed Trino change) and deployed into the running ingestion container:

```
$ docker exec openmetadata_ingestion metadata ingest -c /tmp/presto_delta_ingest.yaml
Workflow Success %: 100.0
```

```
GET /api/v1/tables?service=presto_delta_probe&fields=columns

presto_delta_probe.delta.delta_schema.delta_sales    tableType=Regular  cols=3
presto_delta_probe.delta.hive_schema.hive_orders     tableType=Regular  cols=0
```

The Delta table reads back as `Regular`, with the patch in place and the `DeltaLake` enum live on
the server (the Trino run's readback still returns `DeltaLake`, so the server was not the limiting
factor).

## Why no unit test was added for the Presto Delta branch

A mocked unit test mirroring `TestTrinoIcebergDetection` would pass — it feeds the branch a
`("delta",)` row that production never produces. That is precisely the "what breaks if this test
passes but the code is wrong?" case CLAUDE.md warns about: it would report green over dead code.
Existing Presto and Trino unit tests still pass (22 passed).

## Recommended change to the 2.1 scope

Three options, in increasing cost:

1. **Drop Presto from the 2.1 list.** Honest and cheap. The decision record's "Presto is
   detection-only" line becomes "Presto has no catalog-level Delta indicator".
2. **Fix `PRESTO_GET_CATALOG_CONNECTOR` first**, as its own bug — the shipped Iceberg rule is
   currently inert on PrestoDB. No replacement column is known; this may reduce to option 1 or 3.
3. **Find a per-table indicator.** Not investigated. Presto's Delta connector reads the metastore,
   so the Glue/Hive `spark.sql.sources.provider` route may apply, but that is a different mechanism
   from the one the decision record proposes and needs its own verification.

Whichever is chosen, the pre-existing Presto Iceberg defect should get its own issue.

## Not covered

Only PrestoDB 0.290 was tested; no other Presto version, and no Presto-on-Glue setup. Glue, Athena
and Unity Catalog remain doc-sourced. No partitioned Delta table was tested.

## Restoring the environment

```bash
docker rm -f dl-presto
docker exec openmetadata_ingestion sh -c \
  'cp /tmp/presto_metadata.ORIG.py \
   /home/airflow/.local/lib/python3.12/site-packages/metadata/ingestion/source/database/presto/metadata.py'
```

`dl-hms`, `dl-minio`, `dl-mariadb`, `dl-trino` and `deltanet` were left as the Trino run created
them. The `presto_delta_probe` service in the local OM instance is a probe artifact.
