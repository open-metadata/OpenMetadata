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
- **`owner`**: Owner of this messaging service. Refer to *../../type/entityReference.json*.
- **`domain`** *(string)*: Fully qualified name of the domain the Messaging Service belongs to.


Documentation file automatically generated at 2023-10-27 13:55:46.343512.
