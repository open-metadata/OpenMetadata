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
## Definitions

- **`customMessagingType`** *(string)*: Custom messaging service type. Must be one of: `['CustomMessaging']`. Default: `CustomMessaging`.


Documentation file automatically generated at 2023-07-07 05:50:35.981927.
