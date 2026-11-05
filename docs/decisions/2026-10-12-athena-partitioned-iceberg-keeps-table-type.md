# Athena partitioned Iceberg tables retain the Iceberg table type

- **Status:** Accepted
- **Revisions:** v1 2026-10-12 (initial)
- **Deciders:** harshsoni2024
- **Guard:** `TestAthenaPartitionedIcebergTableType` in `ingestion/tests/unit/topology/database/test_athena.py`
- **Related:** [collate#5940](https://github.com/open-metadata/openmetadata-collate/issues/5940)

## Context

Athena identifies Iceberg tables from Glue metadata, but the common database source used to replace
the type with `Partitioned` when it found partition columns. Consumers then lost the table's storage
type even though the partition details were present separately.

## Decision

For Athena, an Iceberg table keeps `tableType: Iceberg` whether or not it is partitioned. Partition
columns remain in `tablePartition`. Athena uses a partition-type hook in the common source so this
rule does not change how other connectors type partitioned tables.

## Consequences

Existing partitioned Athena Iceberg entities change from `Partitioned` to `Iceberg` on re-ingestion.
Consumers filtering on table type will see the corrected value. Other connectors retain their
current behavior unless they explicitly opt into the same hook.
