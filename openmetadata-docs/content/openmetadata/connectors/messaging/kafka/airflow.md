---
title: Run Kafka Connector using Airflow SDK
slug: /openmetadata/connectors/messaging/kafka/airflow
---

<ConnectorIntro connector="Kafka" goal="Airflow"/>

<Requirements />

<MetadataIngestionServiceDev service="messaging" connector="Kafka" goal="Airflow"/>

<h4>Source Configuration - Service Connection</h4>

- **bootstrapServers**: Kafka bootstrap servers. Add them in comma separated values ex: host1:9092,host2:9092.
- **schemaRegistryURL**: Confluent Kafka Schema Registry URL. URI format.
- **consumerConfig**: Confluent Kafka Consumer Config.
- **schemaRegistryConfig**:Confluent Kafka Schema Registry Config.

<MetadataIngestionConfig service="messaging" connector="Kafka" goal="Airflow" />
