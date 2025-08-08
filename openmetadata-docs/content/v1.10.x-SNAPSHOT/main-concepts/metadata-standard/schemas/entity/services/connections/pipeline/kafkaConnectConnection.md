---
title: kafkaConnectConnection
slug: /main-concepts/metadata-standard/schemas/entity/services/connections/pipeline/kafkaconnectconnection
---

# KafkaConnectConnection

*KafkaConnect Connection Config*

## Properties

- **`type`**: Service Type. Refer to *#/definitions/KafkaConnectType*. Default: `KafkaConnect`.
- **`hostPort`** *(string)*: KafkaConnect Service Management/UI URI.
- **`KafkaConnectConfig`**: We support username/password or No Authentication. Refer to *#/definitions/basicAuthentication*.
- **`verifySSL`** *(boolean)*: Boolean marking if we need to verify the SSL certs for KafkaConnect REST API. True by default. Default: `True`.
- **`messagingServiceName`** *(string)*: Name of the Kafka Messaging Service associated with this KafkaConnect Pipeline Service. e.g. local_kafka.
- **`pipelineFilterPattern`**: Regex exclude pipelines. Refer to *../../../../type/filterPattern.json#/definitions/filterPattern*.
- **`supportsMetadataExtraction`**: Refer to *../connectionBasicType.json#/definitions/supportsMetadataExtraction*.
## Definitions

- **`KafkaConnectType`** *(string)*: Service type. Must be one of: `['KafkaConnect']`. Default: `KafkaConnect`.
- **`basicAuthentication`** *(object)*: username/password auth. Cannot contain additional properties.
  - **`username`** *(string)*: KafkaConnect user to authenticate to the API.
  - **`password`** *(string)*: KafkaConnect password to authenticate to the API.


Documentation file automatically generated at 2025-08-08 15:20:07.536378+00:00.
