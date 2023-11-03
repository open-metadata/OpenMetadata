---
title: kafkaConnection
slug: /main-concepts/metadata-standard/schemas/entity/services/connections/messaging/kafkaconnection
---

# KafkaConnection

*Kafka Connection Config*

## Properties

- **`type`**: Service Type. Refer to *#/definitions/kafkaType*. Default: `Kafka`.
- **`bootstrapServers`** *(string)*: Kafka bootstrap servers. add them in comma separated values ex: host1:9092,host2:9092.
- **`schemaRegistryURL`** *(string)*: Confluent Kafka Schema Registry URL.
- **`saslUsername`** *(string)*: sasl.username consumer config property.
- **`saslPassword`** *(string)*: sasl.password consumer config property.
- **`saslMechanism`**: sasl.mechanism Consumer Config property. Refer to *saslMechanismType.json*. Default: `PLAIN`.
- **`basicAuthUserInfo`** *(string)*: basic.auth.user.info schema registry config property, Client HTTP credentials in the form of username:password.
- **`consumerConfig`** *(object)*: Confluent Kafka Consumer Config. From https://github.com/edenhill/librdkafka/blob/master/CONFIGURATION.md. Can contain additional properties. Default: `{}`.
- **`schemaRegistryConfig`** *(object)*: Confluent Kafka Schema Registry Config. From https://docs.confluent.io/5.5.1/clients/confluent-kafka-python/index.html#confluent_kafka.schema_registry.SchemaRegistryClient. Can contain additional properties. Default: `{}`.
- **`supportsMetadataExtraction`**: Refer to *../connectionBasicType.json#/definitions/supportsMetadataExtraction*.
## Definitions

- **`kafkaType`** *(string)*: Kafka service type. Must be one of: `['Kafka']`. Default: `Kafka`.


Documentation file automatically generated at 2023-07-07 05:50:35.981927.
