---
title: customMessagingConnection
slug: /main-concepts/metadata-standard/schemas/entity/services/connections/messaging/custommessagingconnection
---

# CustomMessagingConnection

*Custom Messaging Service Connection to build a source that is not supported by OpenMetadata yet.*

## Properties

- **`type`**: Custom messaging service type. Refer to *#/definitions/customMessagingType*. Default: `CustomMessaging`.
- **`sourcePythonClass`** *(string)*: Source Python Class Name to instantiated by the ingestion workflow.
- **`connectionOptions`**: Refer to *../connectionBasicType.json#/definitions/connectionOptions*.
- **`topicFilterPattern`**: Regex to only fetch topics that matches the pattern. Refer to *../../../../type/filterPattern.json#/definitions/filterPattern*.
- **`supportsMetadataExtraction`**: Refer to *../connectionBasicType.json#/definitions/supportsMetadataExtraction*.
## Definitions

- **`customMessagingType`** *(string)*: Custom messaging service type. Must be one of: `['CustomMessaging']`. Default: `CustomMessaging`.


Documentation file automatically generated at 2025-08-12 05:39:47.683420+00:00.
