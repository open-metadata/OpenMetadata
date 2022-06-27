---
title: Kafka
slug: /metadata-ui/connectors/messaging/kafka
---

<ConnectorIntro service="messaging" connector="Kafka"/>

<Requirements />

<MetadataIngestionService connector="Kafka"/>

<h4>Connection Options</h4>

- **Bootstrap Servers**: Kafka bootstrap servers. Add them in comma separated values ex: host1:9092,host2:9092.
- **Schema Registry URL**: Confluent Kafka Schema Registry URL. URI format.
- **Consumer Config**: Confluent Kafka Consumer Config.
- **Schema Registry Config**:Confluent Kafka Schema Registry Config.

<IngestionScheduleAndDeploy />

<ConnectorOutro connector="Kafka" />
