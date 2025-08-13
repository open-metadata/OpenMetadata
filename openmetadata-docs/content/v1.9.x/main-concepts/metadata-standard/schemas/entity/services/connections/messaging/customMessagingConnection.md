---
title: Custommessagingconnection | Official Documentation
description: Schema for custom messaging connection setups, allowing ingestion from proprietary or unsupported brokers.
slug: /main-concepts/metadata-standard/schemas/entity/services/connections/messaging/custommessagingconnection
---

# CustomMessagingConnection

*Custom Messaging Service Connection to build a source that is not supported by OpenMetadata yet.*

## Properties

- **`type`**: Custom messaging service type. Refer to *[#/definitions/customMessagingType](#definitions/customMessagingType)*. Default: `"CustomMessaging"`.
- **`sourcePythonClass`** *(string)*: Source Python Class Name to instantiated by the ingestion workflow.
- **`connectionOptions`**: Refer to *[../connectionBasicType.json#/definitions/connectionOptions](#/connectionBasicType.json#/definitions/connectionOptions)*.
## Definitions

- **`customMessagingType`** *(string)*: Custom messaging service type. Must be one of: `["CustomMessaging"]`. Default: `"CustomMessaging"`.


Documentation file automatically generated at 2025-01-15 09:05:41.923720+00:00.
