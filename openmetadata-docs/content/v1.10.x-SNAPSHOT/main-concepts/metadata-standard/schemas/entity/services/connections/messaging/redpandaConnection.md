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
- **`saslUsername`** *(string)*: sasl.username consumer config property.
- **`saslPassword`** *(string)*: sasl.password consumer config property.
- **`schemaRegistryTopicSuffixName`** *(string)*: Schema Registry Topic Suffix Name. The suffix to be appended to the topic name to get topic schema from registry. Default: `-value`.
- **`securityProtocol`** *(string)*: security.protocol consumer config property. Must be one of: `['PLAINTEXT', 'SASL_PLAINTEXT', 'SASL_SSL', 'SSL']`. Default: `PLAINTEXT`.
- **`saslMechanism`**: sasl.mechanism Consumer Config property. Refer to *saslMechanismType.json*. Default: `PLAIN`.
- **`basicAuthUserInfo`** *(string)*: basic.auth.user.info schema registry config property, Client HTTP credentials in the form of username:password.
- **`consumerConfig`** *(object)*: Confluent Redpanda Consumer Config. Can contain additional properties. Default: `{}`.
- **`schemaRegistryConfig`** *(object)*: Confluent Redpanda Schema Registry Config. Can contain additional properties. Default: `{}`.
- **`topicFilterPattern`**: Regex to only fetch topics that matches the pattern. Refer to *../../../../type/filterPattern.json#/definitions/filterPattern*.
- **`supportsMetadataExtraction`**: Refer to *../connectionBasicType.json#/definitions/supportsMetadataExtraction*.
## Definitions

- **`RedpandaType`** *(string)*: Redpanda service type. Must be one of: `['Redpanda']`. Default: `Redpanda`.


Documentation file automatically generated at 2025-08-12 05:39:47.683420+00:00.
