---
title: createMessagingService
slug: /main-concepts/metadata-standard/schemas/api/services/createmessagingservice
---

# CreateMessagingServiceRequest

*Create Messaging service entity request*

## Properties

- **`name`**: Name that identifies the this entity instance uniquely. Refer to *[../../type/basic.json#/definitions/entityName](#/../type/basic.json#/definitions/entityName)*.
- **`displayName`** *(string)*: Display Name that identifies this messaging service. It could be title or label from the source services.
- **`description`**: Description of messaging service entity. Refer to *[../../type/basic.json#/definitions/markdown](#/../type/basic.json#/definitions/markdown)*.
- **`serviceType`**: Refer to *[../../entity/services/messagingService.json#/definitions/messagingServiceType](#/../entity/services/messagingService.json#/definitions/messagingServiceType)*.
- **`connection`**: Refer to *[../../entity/services/messagingService.json#/definitions/messagingConnection](#/../entity/services/messagingService.json#/definitions/messagingConnection)*.
- **`tags`** *(array)*: Tags for this Messaging Service. Default: `null`.
  - **Items**: Refer to *[../../type/tagLabel.json](#/../type/tagLabel.json)*.
- **`owners`**: Owners of this messaging service. Refer to *[../../type/entityReferenceList.json](#/../type/entityReferenceList.json)*. Default: `null`.
- **`dataProducts`** *(array)*: List of fully qualified names of data products this entity is part of.
  - **Items**: Refer to *[../../type/basic.json#/definitions/fullyQualifiedEntityName](#/../type/basic.json#/definitions/fullyQualifiedEntityName)*.
- **`domain`** *(string)*: Fully qualified name of the domain the Messaging Service belongs to.


Documentation file automatically generated at 2025-01-15 09:05:41.923720+00:00.
