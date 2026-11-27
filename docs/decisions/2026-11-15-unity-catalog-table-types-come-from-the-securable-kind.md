# A Unity Catalog table's type comes from its securable kind, and its storage format still wins

- **Status:** Accepted
- **Revisions:** v1 2026-11-15 (initial)
- **Deciders:** akashverma0786
- **Guard:** `ingestion/tests/unit/topology/database/test_unitycatalog_delta_lake.py`; `test_yield_table_records_partition_columns_in_partition_order` in `ingestion/tests/unit/topology/database/test_unity_catalog.py`
- **Related:** ADR:2026-11-11-athena-partitioned-iceberg-and-delta-keep-table-type

## Context
The source types a table from the SDK's `TableInfo.table_type`, then refines it to Iceberg or
DeltaLake from `securable_kind` and `data_source_format`. databricks-sdk 0.20.0 parses `METRIC_VIEW`
and `FOREIGN` to `None`, and `STREAMING_TABLE` had no mapping, so metric views, foreign tables and
streaming tables all came out Regular. A metric view typed Regular got no definition, and the
profiler failed on it: a metric view rejects `DESCRIBE DETAIL` and any measure read without
`MEASURE()`. Partition keys (`partition_index`) were never read.

## Decision
- `TABLE_METRIC_VIEW*` is View. A metric view is created with `CREATE VIEW ... WITH METRICS` and
  `SHOW VIEWS` lists it; its definition is that statement around the YAML the API returns. A
  federated view (`TABLE_FOREIGN_*_VIEW`) is View too.
- `TABLE_STREAMING_LIVE_TABLE*` is Stream; any other `TABLE_FOREIGN_*` is Foreign.
- A Delta or Iceberg storage format still wins over every type but View and MaterializedView, as it
  did over Regular and External.
- A partitioned table keeps its type. Its partition keys go to `tablePartition`, in
  `partition_index` order, as `COLUMN_VALUE`; Unity Catalog never types a table Partitioned.
- `includeViews` governs View and MaterializedView, metric views included; `includeTables` governs
  every other type.

## Consequences
On the next run, metric views change from Regular to View, and streaming and foreign tables that are
not Delta or Iceberg change from Regular to Stream and Foreign. No DeltaLake or Iceberg table changes
type. The profiler skips metric views by default, as it skips views; a profiler run with
`includeViews: true` still reaches them and fails on them. With `includeViews: false` a metric view
and its Metrics are not ingested, and the lineage run, which reads `includeMetricViews` but not
`includeViews`, warns that the metric view is not in OpenMetadata, as it does for a view the
metadata run filtered out. A service saved with `includeViews: false` or `includeTables: false`,
which this source used to ignore, skips those tables from its next run; with `markDeletedTables` on,
the default, the ones already ingested are soft-deleted, as on every other connector. Consumers
looking for partitioned Unity Catalog tables read `tablePartition`, not `tableType: Partitioned`.
