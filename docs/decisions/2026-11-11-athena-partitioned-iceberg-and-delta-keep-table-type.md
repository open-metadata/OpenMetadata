# Athena partitioned Iceberg and Delta tables retain their storage table type

- **Status:** Accepted
- **Revisions:** v1 2026-11-11 (initial)
- **Deciders:** Pere Miquel Brull
- **Guard:** `TestAthenaPartitionedTableType` in `ingestion/tests/unit/topology/database/test_athena.py`
- **Related:** ADR:2026-10-12-athena-partitioned-iceberg-keeps-table-type; [OpenMetadata#37576](https://github.com/open-metadata/OpenMetadata/pull/37576)

## Context

The earlier Athena decision preserved Iceberg's storage type when partition columns were present.
Delta tables still lost their detected `DeltaLake` type because the common database source replaced
it with `Partitioned`. Partition details already have a separate representation.

## Decision

For Athena, Iceberg and Delta tables retain `tableType: Iceberg` and `tableType: DeltaLake`,
respectively, whether or not they are partitioned. Partition columns remain in `tablePartition`.
Athena preserves these types through its existing partition-type hook; ordinary partitioned tables
continue to use `tableType: Partitioned`. Other connectors' partition handling is unchanged.

## Consequences

Existing partitioned Athena Delta entities change from `Partitioned` to `DeltaLake` on re-ingestion,
with the same entity identity and partition metadata. Partitioned Iceberg entities continue to use
`Iceberg`. Consumers filtering for partitioned tables must inspect `tablePartition` when they also
need Iceberg or Delta tables; filtering only for `tableType: Partitioned` does not include them.
