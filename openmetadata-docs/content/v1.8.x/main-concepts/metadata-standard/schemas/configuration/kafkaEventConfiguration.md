---
title: kafkaEventConfiguration
slug: /main-concepts/metadata-standard/schemas/configuration/kafkaeventconfiguration
---

# KafkaEventConfiguration

*This schema defines the Kafka Event Publisher Configuration.*

## Properties

- **`topics`** *(array)*: Topics of Kafka Producer.
  - **Items** *(string)*
- **`acks`** *(string)*: Acknowledgment. Default: `"all"`.
- **`retries`** *(integer)*: No. of retries. Default: `3`.
- **`lingerMS`** *(integer)*: Artificial Delay in milliseconds. Default: `1`.
- **`bufferMemory`** *(integer)*: Buffer Memory. Default: `33554432`.
- **`keySerializer`** *(string)*: Serializer class for key. Default: `"org.apache.kafka.common.serialization.StringSerializer"`.
- **`valueSerializer`** *(string)*: Serializer class for value. Default: `"org.apache.kafka.common.serialization.StringSerializer"`.
- **`securityProtocol`** *(string)*: Kafka security protocol config. Must be one of: `["PLAINTEXT", "SSL"]`. Default: `"PLAINTEXT"`.
- **`SSLProtocol`** *(string)*: Kafka SSL protocol config. Default: `"TLSv1.2"`.
- **`SSLTrustStoreLocation`** *(string)*: Kafka SSL truststore location.
- **`SSLTrustStorePassword`** *(string)*: Kafka SSL truststore password.
- **`SSLKeystoreLocation`** *(string)*: Kafka SSL keystore location.
- **`SSLKeystorePassword`** *(string)*: Kafka SSL keystore password.
- **`SSLKeyPassword`** *(string)*: Kafka SSL key password.


Documentation file automatically generated at 2025-01-15 09:05:41.923720+00:00.
