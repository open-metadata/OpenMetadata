# ClickHouse Kafka engine lineage requires unique messaging service resolution and omits raw DDL

- **Status:** Accepted
- **Revisions:** v1 2026-11-13 (initial)
- **Deciders:** Ingestion maintainers (#37172)
- **Guard:** `TestMultiClusterDisambiguation` and `TestSecretAndSecurityProtection` in `ingestion/tests/unit/topology/database/test_clickhouse_kafka_lineage.py`
- **Related:** ADR:2026-10-19-unity-catalog-lineage-resolves-only-upstreams-across-services, #37172

## Context
ClickHouse streaming pipelines consume Kafka topics via `ENGINE = Kafka` tables before materialized
views move rows into MergeTree tables. `system.query_log` and view definitions capture only the
`Kafka Table -> Materialized View -> Target Table` hops, leaving `Topic -> ClickHouse Kafka Table`
unlinked. Two constraints shape how `system.tables` can bridge that hop:
1. Multiple ingested `MessagingService` clusters commonly share topic names (`events`, `orders`),
   and ClickHouse Named Collections (`ENGINE = Kafka(prod_kafka)`) omit `kafka_broker_list` from
   table DDL altogether.
2. ClickHouse `ENGINE = Kafka` `SETTINGS` can store `kafka_sasl_password` in plaintext inside
   `system.tables.engine_full` and `system.tables.create_table_query`.

## Decision
- Add optional `messagingServiceNames` to `databaseServiceQueryLineagePipeline.json`, and also
  accept `MessagingService` names supplied in `crossDatabaseServiceNames` (ignoring entries there
  that resolve only as `DatabaseService`s so SQL cross-database config does not disable Kafka
  broker auto-discovery).
- When `messagingServiceNames` (or a `MessagingService` in `crossDatabaseServiceNames`) is set,
  scope topic lookups strictly to those services, narrowing further by `kafka_broker_list` endpoint
  intersection when brokers appear in DDL and match.
- When no messaging service is configured explicitly, resolve candidate `MessagingService`s solely
  by normalized `bootstrapServers` intersection (`host:port` preferred, then hostname). If a Named
  Collection hides `kafka_broker_list` and no messaging service is configured, log a warning and
  emit zero edges.
- If a topic matches in more than one candidate `MessagingService`, or if a service or topic
  lookup fails with a non-404 API error where surviving candidates would guess a cluster, emit zero
  edges and log a warning rather than guessing. On multi-topic tables with `overrideViewLineage`
  enabled, suppress `override_lineage=True` deletion whenever any configured topic lookup encounters
  an API error so healthy sibling edges are never wiped on transient failures.
- Emit edges with `Source.ExternalTableLineage` and `LineageDetails.sqlQuery = None`, and never log
  `engine_full` or `create_table_query`, so plaintext SASL credentials in ClickHouse DDL never
  reach OpenMetadata lineage payloads or logs.

## Consequences
- Single-cluster and uniquely-brokered multi-cluster setups get `Topic -> ClickHouse Table`
  (including field-to-column lineage excluding ClickHouse Kafka virtual columns) with zero extra
  configuration.
- Deployments using ClickHouse Named Collections or split-horizon broker DNS must set
  `messagingServiceNames` (or `crossDatabaseServiceNames`) to identify the upstream Kafka service.
- `LineageDetails.sqlQuery` is intentionally empty on `ExternalTableLineage` edges produced from
  ClickHouse `ENGINE = Kafka` tables.
