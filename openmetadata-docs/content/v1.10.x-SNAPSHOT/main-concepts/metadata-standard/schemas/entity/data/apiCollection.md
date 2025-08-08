---
title: apiCollection
slug: /main-concepts/metadata-standard/schemas/entity/data/apicollection
---

# APICollection

*This schema defines the APICollection entity. API Collection allows user to group multiple APIs together. In OpenAPI specification its marked as a Tag.*

## Properties

- **`id`**: Unique identifier that identifies a API Collection instance. Refer to *../../type/basic.json#/definitions/uuid*.
- **`name`**: Name that identifies this API Collection. Refer to *../../type/basic.json#/definitions/entityName*.
- **`displayName`** *(string)*: Display Name that identifies this API Collection. It could be title or label from the source services.
- **`fullyQualifiedName`**: A unique name that identifies a API Collection in the format 'ServiceName.ApiCollectionName'. Refer to *../../type/basic.json#/definitions/fullyQualifiedEntityName*.
- **`description`**: Description of the API Collection, what it is, and how to use it. Refer to *../../type/basic.json#/definitions/markdown*.
- **`version`**: Metadata version of the entity. Refer to *../../type/entityHistory.json#/definitions/entityVersion*.
- **`updatedAt`**: Last update time corresponding to the new version of the entity in Unix epoch time milliseconds. Refer to *../../type/basic.json#/definitions/timestamp*.
- **`updatedBy`** *(string)*: User who made the update.
- **`endpointURL`** *(string)*: EndPoint URL for the API Collection. Capture the Root URL of the collection.
- **`apiEndpoints`**: All the APIs included in this API Collection. Refer to *../../type/entityReferenceList.json*. Default: `None`.
- **`href`**: Link to the resource corresponding to this entity. Refer to *../../type/basic.json#/definitions/href*.
- **`owners`**: Owners of this API Collection. Refer to *../../type/entityReferenceList.json*. Default: `None`.
- **`tags`** *(array)*: Tags for this API Collection. Default: `[]`.
  - **Items**: Refer to *../../type/tagLabel.json*.
- **`service`**: Link to service where this API Collection is hosted in. Refer to *../../type/entityReference.json*.
- **`serviceType`**: Service type where this API Collection is hosted in. Refer to *../services/apiService.json#/definitions/apiServiceType*.
- **`changeDescription`**: Change that lead to this version of the entity. Refer to *../../type/entityHistory.json#/definitions/changeDescription*.
- **`incrementalChangeDescription`**: Change that lead to this version of the entity. Refer to *../../type/entityHistory.json#/definitions/changeDescription*.
- **`deleted`** *(boolean)*: When `true` indicates the entity has been soft deleted. Default: `False`.
- **`extension`**: Entity extension data with custom attributes added to the entity. Refer to *../../type/basic.json#/definitions/entityExtension*.
- **`domains`**: Domains the API Collection belongs to. When not set, the API Collection inherits the domain from the API service it belongs to. Refer to *../../type/entityReferenceList.json*.
- **`dataProducts`**: List of data products this entity is part of. Refer to *../../type/entityReferenceList.json*.
- **`votes`**: Votes on the entity. Refer to *../../type/votes.json*.
- **`lifeCycle`**: Life Cycle properties of the entity. Refer to *../../type/lifeCycle.json*.
- **`certification`**: Refer to *../../type/assetCertification.json*.
- **`sourceHash`** *(string)*: Source hash of the entity.


Documentation file automatically generated at 2025-08-08 15:20:07.536378+00:00.
