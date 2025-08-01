---
title: Kafka Connection | OpenMetadata Kafka Messaging Connection
description: Kafka messaging connection schema for ingesting metadata from real-time event streaming services.
slug: /main-concepts/metadata-standard/schemas/entity/services/connections/messaging/kafkaconnection
---

# KafkaConnection

*Kafka Connection Config*

## Properties

- **`type`**: Service Type. Refer to *[#/definitions/kafkaType](#definitions/kafkaType)*. Default: `"Kafka"`.
- **`bootstrapServers`** *(string)*: Kafka bootstrap servers. add them in comma separated values ex: host1:9092,host2:9092.
- **`schemaRegistryURL`** *(string, format: uri)*: Confluent Kafka Schema Registry URL.
- **`saslUsername`** *(string)*: sasl.username consumer config property.
- **`saslPassword`** *(string, format: password)*: sasl.password consumer config property.
- **`securityProtocol`** *(string)*: security.protocol consumer config property. Must be one of: `["PLAINTEXT", "SASL_PLAINTEXT", "SASL_SSL", "SSL"]`. Default: `"PLAINTEXT"`.
- **`saslMechanism`**: sasl.mechanism Consumer Config property. Refer to *[saslMechanismType.json](#slMechanismType.json)*. Default: `"PLAIN"`.
- **`basicAuthUserInfo`** *(string, format: password)*: basic.auth.user.info schema registry config property, Client HTTP credentials in the form of username:password.
- **`consumerConfig`** *(object)*: Confluent Kafka Consumer Config. From https://github.com/edenhill/librdkafka/blob/master/CONFIGURATION.md. Can contain additional properties. Default: `{}`.
- **`schemaRegistryConfig`** *(object)*: Confluent Kafka Schema Registry Config. From https://docs.confluent.io/5.5.1/clients/confluent-kafka-python/index.html#confluent_kafka.schema_registry.SchemaRegistryClient. Can contain additional properties. Default: `{}`.
- **`schemaRegistryTopicSuffixName`** *(string)*: Schema Registry Topic Suffix Name. The suffix to be appended to the topic name to get topic schema from registry. Default: `"-value"`.
- **`schemaRegistrySSL`**: Schema Registry SSL Config. Configuration for enabling SSL for the Schema Registry connection. Refer to *[../../../../security/ssl/verifySSLConfig.json#/definitions/sslConfig](#/../../../security/ssl/verifySSLConfig.json#/definitions/sslConfig)*.
- **`supportsMetadataExtraction`**: Refer to *[../connectionBasicType.json#/definitions/supportsMetadataExtraction](#/connectionBasicType.json#/definitions/supportsMetadataExtraction)*.
## Definitions

- **`kafkaType`** *(string)*: Kafka service type. Must be one of: `["Kafka"]`. Default: `"Kafka"`.


Documentation file automatically generated at 2025-01-15 09:05:41.923720+00:00.
