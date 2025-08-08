---
title: kinesisConnection
slug: /main-concepts/metadata-standard/schemas/entity/services/connections/messaging/kinesisconnection
---

# KinesisConnection

*Kinesis Connection Config*

## Properties

- **`type`**: Service Type. Refer to *#/definitions/kinesisType*. Default: `Kinesis`.
- **`awsConfig`**: Refer to *../../../../security/credentials/awsCredentials.json*.
- **`topicFilterPattern`**: Regex to only fetch topics that matches the pattern. Refer to *../../../../type/filterPattern.json#/definitions/filterPattern*.
- **`supportsMetadataExtraction`**: Refer to *../connectionBasicType.json#/definitions/supportsMetadataExtraction*.
## Definitions

- **`kinesisType`** *(string)*: Service type. Must be one of: `['Kinesis']`. Default: `Kinesis`.


Documentation file automatically generated at 2025-08-08 15:20:07.536378+00:00.
