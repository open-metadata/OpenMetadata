# Live verification: Trino Delta Lake detection

Run on 2026-09-24 against a real Trino 418 with a real Delta table, ingested by a real
`metadata ingest` and read back through the OpenMetadata REST API. This closes item 1 of
"Remaining before this can be accepted" in
[delta-lake-detection-decision.md](../delta-lake-detection-decision.md) **for Trino only**.

## Result

| Claim | Verdict |
|---|---|
| `system.metadata.catalogs.connector_name` is `delta_lake` for a Delta catalog | **CONFIRMED** |
| A Delta table ingests and reads back as `tableType: DeltaLake` | **CONFIRMED** |
| A Hive-catalog table does not become `DeltaLake` | **CONFIRMED** |
| The catalog-wide rule over-matches as well as under-matches | **NEW FINDING — see below** |

## Stack

Trino 418, Hive Metastore 3.0.0, MinIO and MariaDB on a `deltanet` docker network; Trino also
joined to `ometa_network` so the running `openmetadata_ingestion` container could reach it. Trino
and metastore images were built from the repo's own harness
(`ingestion/tests/integration/trino/{trino,hive}`), with one catalog file added:

```properties
# etc/catalog/delta.properties
connector.name=delta_lake
hive.metastore.uri=${ENV:HIVE_METASTORE_URI}
hive.s3.path-style-access=true
hive.s3.endpoint=${ENV:S3_ENDPOINT}
hive.s3.aws-access-key=hiveaccesskey
hive.s3.aws-secret-key=hivesecretkey
delta.enable-non-concurrent-writes=true
```

The repo's existing `minio.properties` (`connector.name=hive`) provided the negative case. Both
catalogs share one metastore.

## The detection fact

```
$ docker exec dl-trino trino --server localhost:8080 \
    --execute "SELECT catalog_name, connector_name FROM system.metadata.catalogs ORDER BY catalog_name"

 catalog_name | connector_name
--------------+----------------
 delta        | delta_lake
 jmx          | jmx
 memory       | memory
 minio        | hive
 system       | system
 tpcds        | tpcds
 tpch         | tpch
```

`delta_lake` is the exact string, confirming the decision record's Trino row against a running
engine rather than documentation.

## Tables created

```sql
CREATE SCHEMA delta.delta_schema WITH (location = 's3a://delta-warehouse/delta_schema');
CREATE TABLE delta.delta_schema.delta_sales (id integer, region varchar, amount double);
INSERT INTO delta.delta_schema.delta_sales VALUES (1,'emea',10.5),(2,'apac',20.25);

CREATE SCHEMA minio.hive_schema WITH (location = 's3a://hive-warehouse/hive_schema');
CREATE TABLE minio.hive_schema.hive_orders (id integer, sku varchar);
INSERT INTO minio.hive_schema.hive_orders VALUES (1,'sku-a'),(2,'sku-b');
```

The Delta table is genuinely Delta — it has a transaction log, which the connector never reads:

```
$ aws --endpoint-url http://s3:9000 s3 ls s3://delta-warehouse/ --recursive
delta_schema/delta_sales-27e64296.../_delta_log/00000000000000000000.json
delta_schema/delta_sales-27e64296.../_delta_log/00000000000000000001.json
```

## Server-side prerequisite, and proof it was the blocker

Before the schema change, the running server rejected the value. Identical payloads, only
`tableType` differing:

```
POST /api/v1/tables  {"tableType":"Iceberg",   ...}  -> 201
POST /api/v1/tables  {"tableType":"DeltaLake", ...}  -> 400 {"code":400,"message":"Invalid request format"}
```

After adding `DeltaLake` to `tableType` in `table.json`, rebuilding `openmetadata-spec` and
replacing `/opt/openmetadata/libs/openmetadata-spec-2.0.0-SNAPSHOT.jar` in the running container:

```
POST /api/v1/tables  {"tableType":"DeltaLake", ...}  -> 201
```

This is why #5994 must land the schema change before any connector change is testable end to end:
a connector emitting `DeltaLake` against an unpatched server fails at the sink, not at detection.

## API readback after `metadata ingest`

```
$ docker exec openmetadata_ingestion metadata ingest -c /tmp/trino_delta_ingest.yaml
...
Workflow Success %: 100.0
```

```
GET /api/v1/tables?service=trino_delta_probe&fields=columns

trino_delta_probe.delta.delta_schema.delta_sales    tableType=DeltaLake  cols=3
trino_delta_probe.delta.hive_schema.hive_orders     tableType=DeltaLake  cols=0   <-- false positive
trino_delta_probe.minio.delta_schema.delta_sales    tableType=Regular    cols=0   <-- false negative
trino_delta_probe.minio.hive_schema.hive_orders     tableType=Regular    cols=2
```

Full readback of the real Delta table:

```json
{
  "id": "c887fcd8-48d7-42ba-aec8-57fb491cb8f3",
  "name": "delta_sales",
  "fullyQualifiedName": "trino_delta_probe.delta.delta_schema.delta_sales",
  "tableType": "DeltaLake",
  "serviceType": "Trino"
}
columns: [('id', 'INT'), ('region', 'VARCHAR'), ('amount', 'DOUBLE')]
```

and of the Hive-catalog table:

```json
{
  "name": "hive_orders",
  "fullyQualifiedName": "trino_delta_probe.minio.hive_schema.hive_orders",
  "tableType": "Regular"
}
columns: [('id', 'INT'), ('sku', 'VARCHAR')]
```

## NEW FINDING: the catalog-wide rule over-matches, not only under-matches

The decision record already notes that a Delta table reached through a `hive` catalog goes
undetected. Row 3 above confirms that (`minio.delta_schema.delta_sales` → `Regular`).

Row 2 is the part that was not predicted: **a non-Delta table visible through a `delta_lake`
catalog is typed `DeltaLake`.** Because both catalogs share one Hive metastore, every schema is
visible through both, and `query_table_names_and_types` types every table in the catalog from the
catalog's connector name alone. Trino itself refuses to read those cross-typed tables:

```
UNSUPPORTED_TABLE_TYPE  hive_schema.hive_orders is not a Delta Lake table
UNSUPPORTED_TABLE_TYPE  Cannot query Delta Lake table 'delta_schema.delta_sales'
```

The column fetch fails, ingestion logs a warning, and the entity is still created — with
`tableType: DeltaLake` and **zero columns**. The same defect already applies to the shipped Iceberg
rule; Delta inherits it rather than introducing it.

This matters for the shared-metastore deployments that are the common Trino lakehouse setup. Two
possible responses, neither taken here:

1. Accept it and document it — a table that Trino cannot read through the catalog is arguably
   mis-registered by the operator.
2. Treat a zero-column result as a signal to drop the table rather than emit an entity with a
   format type it failed to read.

Decision needed before #5994 closes.

## Not covered by this run

Glue, Athena, Presto and Unity Catalog indicators remain doc-sourced only. The StarRocks
`RELKIND_MAP` casing question is untouched. Nothing here tests a partitioned Delta table, which
section 7 of the decision record says would lose the type on this exact connector.

## Restoring the environment

The running dev stack was modified in place. To undo:

```bash
docker cp /tmp/openmetadata-spec-ORIGINAL.jar \
  openmetadata_server:/opt/openmetadata/libs/openmetadata-spec-2.0.0-SNAPSHOT.jar
docker restart openmetadata_server
docker exec openmetadata_ingestion sh -c \
  'P=/home/airflow/.local/lib/python3.12/site-packages/metadata; \
   cp /tmp/trino_metadata.ORIG.py $P/ingestion/source/database/trino/metadata.py; \
   cp /tmp/table.ORIG.py $P/generated/schema/entity/data/table.py'
docker rm -f dl-trino dl-hms dl-minio dl-mariadb && docker network rm deltanet
```

The `enumprobe_svc` and `trino_delta_probe` database services in the local OM instance are probe
artifacts and can be deleted.
