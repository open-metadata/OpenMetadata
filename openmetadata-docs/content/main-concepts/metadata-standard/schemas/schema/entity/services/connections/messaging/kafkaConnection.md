---
title: kafkaConnection
slug: /main-concepts/metadata-standard/schemas/schema/entity/services/connections/messaging
---

# KafkaConnection

*Kafka Connection Config*

## Properties

- **`type`**: Service Type. Refer to *#/definitions/kafkaType*. Default: `Kafka`.
- **`bootstrapServers`** *(string)*: Kafka bootstrap servers. add them in comma separated values ex: host1:9092,host2:9092.
- **`schemaRegistryURL`** *(string)*: Confluent Kafka Schema Registry URL.
- **`consumerConfig`** *(object)*: Confluent Kafka Consumer Config. Can contain additional properties. Default: `{}`.
- **`schemaRegistryConfig`** *(object)*: Confluent Kafka Schema Registry Config. Can contain additional properties. Default: `{}`.
- **`supportsMetadataExtraction`**: Refer to *../connectionBasicType.json#/definitions/supportsMetadataExtraction*.
## Definitions

- **`kafkaType`** *(string)*: Kafka service type. Must be one of: `['Kafka']`. Default: `Kafka`.


Documentation file automatically generated at 2022-07-13 10:27:46.766157.
