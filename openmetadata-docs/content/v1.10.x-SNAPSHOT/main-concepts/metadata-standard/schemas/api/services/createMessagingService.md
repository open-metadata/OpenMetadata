---
title: createMessagingService
slug: /main-concepts/metadata-standard/schemas/api/services/createmessagingservice
---

# CreateMessagingServiceRequest

*Create Messaging service entity request*

## Properties

- **`name`**: Name that identifies the this entity instance uniquely. Refer to *../../type/basic.json#/definitions/entityName*.
- **`displayName`** *(string)*: Display Name that identifies this messaging service. It could be title or label from the source services.
- **`description`**: Description of messaging service entity. Refer to *../../type/basic.json#/definitions/markdown*.
- **`serviceType`**: Refer to *../../entity/services/messagingService.json#/definitions/messagingServiceType*.
- **`connection`**: Refer to *../../entity/services/messagingService.json#/definitions/messagingConnection*.
- **`tags`** *(array)*: Tags for this Messaging Service. Default: `None`.
  - **Items**: Refer to *../../type/tagLabel.json*.
- **`owners`**: Owners of this messaging service. Refer to *../../type/entityReferenceList.json*. Default: `None`.
- **`dataProducts`** *(array)*: List of fully qualified names of data products this entity is part of.
  - **Items**: Refer to *../../type/basic.json#/definitions/fullyQualifiedEntityName*.
- **`domains`** *(array)*: Fully qualified names of the domains the Messaging Service belongs to.
  - **Items** *(string)*
- **`ingestionRunner`**: The ingestion agent responsible for executing the ingestion pipeline. Refer to *../../type/entityReference.json*.


Documentation file automatically generated at 2025-08-12 05:39:47.683420+00:00.
