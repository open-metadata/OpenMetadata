# OpenLineage kafka:// datasets resolve to a topic only through an unambiguous bootstrapServers match

- **Status:** Accepted
- **Revisions:** v1 2026-10-21 (initial)
- **Deciders:** ulixius9
- **Guard:** `OpenLineageTopicResolverTest`, `OpenLineageLineageResolutionIT#kafkaDataset_resolvesToTheTopicOfTheServiceListingItsBroker`
- **Related:** #35475, #19482 (pull connector broker matching)

## Context
Spark and other OpenLineage producers name a Kafka dataset `kafka://<broker host>:<port>` plus the
topic. The HTTP endpoint (`/api/v1/openlineage/lineage`) only matched tables and containers, so
topic edges were lost, and a dotted topic name (`dbserver1.inventory.customers`) could suffix-match
an unrelated table. The event's port also often differs from the one registered in OpenMetadata
(TLS 9093 vs plaintext 9092), and several clusters can sit behind one gateway host, so a naive
host-only match draws permanent edges to another cluster's same-named topic.

## Decision
A `kafka://` dataset never goes through table matching. It resolves to `<service>.<topic>` where
the candidate services are:

1. every messaging service whose `bootstrapServers` lists the exact `host:port`; or, only when none
   does,
2. the single service whose `bootstrapServers` lists that host on any port. Several services on
   the host leave the dataset unresolved.

The topic must exist in exactly one candidate service; otherwise the dataset is reported
unresolved. Topics are never created. Hosts compare case-insensitively and listener schemes
(`SASL_SSL://`) are ignored.

## Consequences
Lineage never guesses between clusters, at the cost of dropping edges an operator could only fix by
registering the broker address the producer reports. One host serving two clusters of which only
one is registered still resolves an event from the unregistered one to the registered cluster's
same-named topic; registering both removes it. The pull-based Python connector still matches the
raw `host:port` string exactly and keeps the last service listing a broker; it should adopt this
rule so both transports produce the same lineage.
