---
title: redpandaConnection
slug: /main-concepts/metadata-standard/schemas/entity/services/connections/messaging/redpandaconnection
---

# RedpandaConnection

*Redpanda Connection Config*

## Properties

- **`type`**: Service Type. Refer to *#/definitions/RedpandaType*. Default: `Redpanda`.
- **`bootstrapServers`** *(string)*: Redpanda bootstrap servers. add them in comma separated values ex: host1:9092,host2:9092.
- **`schemaRegistryURL`** *(string)*: Confluent Redpanda Schema Registry URL.
- **`consumerConfig`** *(object)*: Confluent Redpanda Consumer Config. Can contain additional properties. Default: `{}`.
- **`schemaRegistryConfig`** *(object)*: Confluent Redpanda Schema Registry Config. Can contain additional properties. Default: `{}`.
- **`supportsMetadataExtraction`**: Refer to *../connectionBasicType.json#/definitions/supportsMetadataExtraction*.
## Definitions

- **`RedpandaType`** *(string)*: Redpanda service type. Must be one of: `['Redpanda']`. Default: `Redpanda`.


Documentation file automatically generated at 2022-09-18 19:21:45.413954.
