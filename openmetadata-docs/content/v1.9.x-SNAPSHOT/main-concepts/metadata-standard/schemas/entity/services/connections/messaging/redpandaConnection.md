---
title: Redpanda Connection | OpenMetadata Redpanda
slug: /main-concepts/metadata-standard/schemas/entity/services/connections/messaging/redpandaconnection
---

# RedpandaConnection

*Redpanda Connection Config*

## Properties

- **`type`**: Service Type. Refer to *[#/definitions/RedpandaType](#definitions/RedpandaType)*. Default: `"Redpanda"`.
- **`bootstrapServers`** *(string)*: Redpanda bootstrap servers. add them in comma separated values ex: host1:9092,host2:9092.
- **`schemaRegistryURL`** *(string, format: uri)*: Confluent Redpanda Schema Registry URL.
- **`saslUsername`** *(string)*: sasl.username consumer config property.
- **`saslPassword`** *(string, format: password)*: sasl.password consumer config property.
- **`securityProtocol`** *(string)*: security.protocol consumer config property. Must be one of: `["PLAINTEXT", "SASL_PLAINTEXT", "SASL_SSL", "SSL"]`. Default: `"PLAINTEXT"`.
- **`saslMechanism`**: sasl.mechanism Consumer Config property. Refer to *[saslMechanismType.json](#slMechanismType.json)*. Default: `"PLAIN"`.
- **`basicAuthUserInfo`** *(string, format: password)*: basic.auth.user.info schema registry config property, Client HTTP credentials in the form of username:password.
- **`consumerConfig`** *(object)*: Confluent Redpanda Consumer Config. Can contain additional properties. Default: `{}`.
- **`schemaRegistryConfig`** *(object)*: Confluent Redpanda Schema Registry Config. Can contain additional properties. Default: `{}`.
- **`supportsMetadataExtraction`**: Refer to *[../connectionBasicType.json#/definitions/supportsMetadataExtraction](#/connectionBasicType.json#/definitions/supportsMetadataExtraction)*.
## Definitions

- **`RedpandaType`** *(string)*: Redpanda service type. Must be one of: `["Redpanda"]`. Default: `"Redpanda"`.


Documentation file automatically generated at 2025-01-15 09:05:41.923720+00:00.
