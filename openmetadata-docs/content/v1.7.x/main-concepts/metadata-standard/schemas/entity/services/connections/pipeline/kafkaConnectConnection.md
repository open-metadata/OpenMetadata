---
title: Kafkaconnectconnection | Official Documentation
description: Set up Kafka Connect connections using this schema to ingest metadata from source and sink connectors.
slug: /main-concepts/metadata-standard/schemas/entity/services/connections/pipeline/kafkaconnectconnection
---

# KafkaConnectConnection

*KafkaConnect Connection Config*

## Properties

- **`type`**: Service Type. Refer to *[#/definitions/KafkaConnectType](#definitions/KafkaConnectType)*. Default: `"KafkaConnect"`.
- **`hostPort`** *(string, format: uri)*: KafkaConnect Service Management/UI URI.
- **`KafkaConnectConfig`**: We support username/password or No Authentication. Refer to *[#/definitions/basicAuthentication](#definitions/basicAuthentication)*.
- **`verifySSL`** *(boolean)*: Boolean marking if we need to verify the SSL certs for KafkaConnect REST API. True by default. Default: `true`.
- **`messagingServiceName`** *(string)*: Name of the Kafka Messaging Service associated with this KafkaConnect Pipeline Service. e.g. local_kafka.
## Definitions

- **`KafkaConnectType`** *(string)*: Service type. Must be one of: `["KafkaConnect"]`. Default: `"KafkaConnect"`.
- **`basicAuthentication`** *(object)*: username/password auth. Cannot contain additional properties.
  - **`username`** *(string)*: KafkaConnect user to authenticate to the API.
  - **`password`** *(string, format: password)*: KafkaConnect password to authenticate to the API.


Documentation file automatically generated at 2025-01-15 09:05:41.923720+00:00.
