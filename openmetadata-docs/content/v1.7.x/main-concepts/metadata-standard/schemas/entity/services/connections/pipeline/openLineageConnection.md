---
title: Openlineageconnection | Official Documentation
description: Use this schema to configure OpenLineage connections and retrieve job metadata for pipeline observability.
slug: /main-concepts/metadata-standard/schemas/entity/services/connections/pipeline/openlineageconnection
---

# OpenLineageConnection

*OpenLineage Connection Config*

## Properties

- **`type`**: Service Type. Refer to *[#/definitions/OpenLineageType](#definitions/OpenLineageType)*. Default: `"OpenLineage"`.
- **`brokersUrl`** *(string)*: service type of the messaging source.
- **`topicName`** *(string)*: topic from where Open lineage events will be pulled .
- **`consumerGroupName`** *(string)*: consumer group name .
- **`consumerOffsets`** *(string)*: initial Kafka consumer offset. Must be one of: `["earliest", "latest"]`. Default: `"earliest"`.
- **`poolTimeout`** *(number)*: max allowed wait time. Default: `1.0`.
- **`sessionTimeout`** *(integer)*: max allowed inactivity time. Default: `30`.
- **`securityProtocol`** *(string)*: Kafka security protocol config. Must be one of: `["PLAINTEXT", "SSL", "SASL_SSL"]`. Default: `"PLAINTEXT"`.
- **`sslConfig`**: SSL Configuration details. Refer to *[../../../../security/ssl/verifySSLConfig.json#/definitions/sslConfig](#/../../../security/ssl/verifySSLConfig.json#/definitions/sslConfig)*.
- **`saslConfig`**: SASL Configuration details. Refer to *[../../../../security/sasl/saslClientConfig.json](#/../../../security/sasl/saslClientConfig.json)*.
- **`supportsMetadataExtraction`**: Refer to *[../connectionBasicType.json#/definitions/supportsMetadataExtraction](#/connectionBasicType.json#/definitions/supportsMetadataExtraction)*.
## Definitions

- **`OpenLineageType`** *(string)*: Service type. Must be one of: `["OpenLineage"]`. Default: `"OpenLineage"`.


Documentation file automatically generated at 2025-01-15 09:05:41.923720+00:00.
