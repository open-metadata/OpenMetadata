# Live verification: StarRocks Delta Lake detection

Run on 2026-09-25 against a real StarRocks 3.2.16-8dea52d, reusing the Hive metastore (`dl-hms`),
MinIO (`dl-minio`) and the tables created for the [Trino run](live-trino-delta-detection.md).
`dl-trino` and `dl-presto` were not touched.

## Result

| Claim | Verdict |
|---|---|
| A Delta table's `ENGINE` is `DeltaLake` (mixed case, from `Table.getEngine()`) | **REFUTED** — the value is `DELTALAKE`, upper case |
| `RELKIND_MAP`'s upper-case keys are miscased (section 3, "SUSPECTED") | **REFUTED — the keys are correct.** Not a bug |
| A Delta table ingests and reads back as `tableType: DeltaLake` | **CONFIRMED** |
| `starrocksConnection.json` cannot reach an external catalog | **PARTLY REFUTED** — reachable today via `connectionArguments`, with caveats |
| StarRocks shows the same catalog-wide false positive as Trino | **CONFIRMED**, and it originates in StarRocks itself |

## The `ENGINE` value, byte for byte

Tables were read through an external `deltalake` catalog pointed at the same metastore:

```sql
CREATE EXTERNAL CATALOG deltalake_probe PROPERTIES(
    "type" = "deltalake",
    "hive.metastore.type" = "hive",
    "hive.metastore.uris" = "thrift://metastore:9083",
    "aws.s3.enable_ssl" = "false",
    "aws.s3.enable_path_style_access" = "true",
    "aws.s3.endpoint" = "http://s3:9000",
    "aws.s3.access_key" = "hiveaccesskey",
    "aws.s3.secret_key" = "hivesecretkey");
```

(Property names taken from the StarRocks Delta Lake catalog documentation; `enable_ssl` set to
`false` for plain-HTTP MinIO.)

```sql
SELECT TABLE_NAME, ENGINE, HEX(ENGINE) AS engine_hex, LENGTH(ENGINE) AS len
FROM deltalake_probe.information_schema.tables WHERE TABLE_SCHEMA = 'delta_schema';

TABLE_NAME    ENGINE     engine_hex           len
delta_sales   DELTALAKE  44454C54414C414B45   9
```

`44454C54414C414B45` decodes to `DELTALAKE` — nine bytes, all upper case, no separator.

## The casing question is settled: the map is NOT miscased

The decision record recorded a SUSPECTED miscasing, inferred from StarRocks'
`Table.getEngine()`, which returns `"Iceberg"`, `"Hive"`, `"DeltaLake"` in mixed case. **That
inference was wrong for this code path.** `information_schema.tables` for an *external* catalog
reports the catalog type upper-cased, and that is the column
`STARROCKS_GET_TABLE_NAMES` (`starrocks/queries.py:33-43`) selects.

Measured across three external catalog types over the same metastore:

| Catalog type | `ENGINE` | hex | Matches existing `RELKIND_MAP` key? |
|---|---|---|---|
| `deltalake` | `DELTALAKE` | `44454C54414C414B45` | new key added by this change |
| `hive` | `HIVE` | `48495645` | yes — `"HIVE"` |
| `iceberg` | `ICEBERG` | `49434542455247` | yes — `"ICEBERG"` |
| internal (`default_catalog`) | `StarRocks` | `53746172526F636B73` | matched by the query's `ENGINE = 'StarRocks'` CASE branch, also correct |

**Plainly: not miscased.** `"ICEBERG"`, `"HIVE"` and the `'StarRocks'` comparison in the query are
all correct as shipped. Section 3's suspicion should be closed as refuted, and no casing fix issue
is needed. Only `"MYSQL"`, `"ELASTICSEARCH"`, `"JDBC"` and `"HUDI"` remain unverified — they were
not exercised, since they need catalogs of those types.

## Can OM reach an external catalog at all?

`starrocksConnection.json` has `databaseName` (a display label only) and `databaseSchema`, and no
catalog concept — the decision record is right about the schema. But the limitation is **not**
fatal, because the connection is MySQL-protocol and StarRocks scopes the catalog per session.

Measured through OM's own driver (`mysql+pymysql`):

```
SHOW DATABASES (default):        ['_statistics_', 'information_schema', 'probe_db', 'sys']
inspector.get_schema_names():    ['_statistics_', 'information_schema', 'probe_db', 'sys']
SHOW CATALOGS:                   default_catalog/Internal, deltalake_probe/Deltalake,
                                 hive_probe/Hive, iceberg_probe/Iceberg
```

So by default the external catalog's schemas are invisible. Three routes tested:

| Route | Result |
|---|---|
| `SET CATALOG deltalake_probe` on the session | works — `SHOW DATABASES` then lists `delta_schema`, `hive_schema` |
| `connect_args={'init_command': 'SET CATALOG deltalake_probe'}` | works — `inspector.get_schema_names()` returns `['default', 'delta_schema', 'hive_schema', 'information_schema']` |
| catalog as the URL database (`…:9030/deltalake_probe`) | fails — `(1049, "Unknown database 'deltalake_probe'")` |

The second route is reachable from the existing schema today, because `connectionArguments` flows
into SQLAlchemy `connect_args`. The ingestion below used exactly that:

```yaml
      databaseName: deltalake_probe
      connectionArguments:
        init_command: "SET CATALOG deltalake_probe"
```

**Caveats that still argue for a schema change later:** one service per external catalog; the
default catalog's tables become invisible in that same service; `databaseName` is a cosmetic label,
so nothing validates that it matches the catalog actually selected; and it is an undocumented
workaround a user is unlikely to discover. A first-class `catalog` field would be the honest fix —
but it is an enhancement, not a prerequisite. **Detection does not need a schema change.**

## API readback after `metadata ingest`

```
$ docker exec openmetadata_ingestion metadata ingest -c /tmp/starrocks_delta_ingest.yaml
Workflow Success %: 100.0
```

```
GET /api/v1/tables?service=starrocks_delta_probe&fields=columns

starrocks_delta_probe.deltalake_probe.delta_schema.delta_sales   tableType=DeltaLake  cols=3
starrocks_delta_probe.deltalake_probe.hive_schema.hive_orders    tableType=DeltaLake  cols=0
```

For comparison, the same two tables through the other connectors:

| Connector | `delta_sales` | `hive_orders` (via the Delta catalog) |
|---|---|---|
| trino | `DeltaLake`, 3 cols | `DeltaLake`, 0 cols |
| presto | `Regular`, 3 cols (detection never fires) | `Regular`, 0 cols |
| starrocks | `DeltaLake`, 3 cols | `DeltaLake`, 0 cols |

## The section 10 false positive reproduces — and it is StarRocks' own answer

`hive_orders` is a plain Hive table, yet read through the `deltalake` catalog StarRocks itself
reports it as Delta:

```sql
SELECT TABLE_NAME, ENGINE FROM deltalake_probe.information_schema.tables WHERE TABLE_SCHEMA = 'hive_schema';
hive_orders   DELTALAKE
```

The converse also holds: through `hive_probe`, the genuine Delta table `delta_sales` reports
`HIVE`; through `iceberg_probe`, both report `ICEBERG`. **`ENGINE` describes the catalog the table
was read through, not the table's own storage format.** The connector is faithfully reporting what
StarRocks says, so this is not a connector defect that a code change can fix — it is the same
catalog-scoped ambiguity found on Trino, one layer lower.

## Change made

One line in `starrocks/metadata.py`:

```python
    "ICEBERG": TableType.Iceberg,
    "DELTALAKE": TableType.DeltaLake,   # added
    "HUDI": TableType.External,
```

No other key was touched, per the instruction to leave the pre-existing casing question alone —
which, as recorded above, turned out not to be a defect at all.

Three unit tests added in `TestStarRocksDeltaLakeMapping`: the mapping itself, that only the
upper-case key resolves, and that the existing `ICEBERG`/`HIVE`/`TABLE` entries are undisturbed.
`test_starrocks.py` 27 passed; with `test_trino_metadata.py` and `test_presto.py`, 49 passed.

## Not covered

StarRocks 3.2.16 only. `MYSQL`, `ELASTICSEARCH`, `JDBC`, `HUDI` engine strings unverified. No
partitioned Delta table. Whether the `init_command` workaround survives connection pooling across a
long ingestion was not stress-tested. Glue, Athena and Unity Catalog remain doc-sourced.

## Restoring the environment

```bash
docker rm -f dl-starrocks
docker exec openmetadata_ingestion sh -c \
  'cp /tmp/starrocks_metadata.ORIG.py \
   /home/airflow/.local/lib/python3.12/site-packages/metadata/ingestion/source/database/starrocks/metadata.py'
```

`dl-hms`, `dl-minio`, `dl-mariadb`, `dl-trino`, `dl-presto` and `deltanet` left as found. The
`starrocks_delta_probe` service in the local OM instance is a probe artifact.
