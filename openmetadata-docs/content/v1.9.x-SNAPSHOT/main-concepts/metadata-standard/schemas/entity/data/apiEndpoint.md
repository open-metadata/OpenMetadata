---
title: API Endpoint | OpenMetadata API Endpoint
slug: /main-concepts/metadata-standard/schemas/entity/data/apiendpoint
---

# APIEndpoint

*This schema defines the APIEndpoint entity. An APIEndpoint is a specific endpoint of an API that is part of an API Collection.*

## Properties

- **`id`**: Unique identifier that identifies a API Endpoint instance. Refer to *[../../type/basic.json#/definitions/uuid](#/../type/basic.json#/definitions/uuid)*.
- **`name`**: Name that identifies this API Endpoint. Refer to *[../../type/basic.json#/definitions/entityName](#/../type/basic.json#/definitions/entityName)*.
- **`displayName`** *(string)*: Display Name that identifies this API Endpoint.
- **`fullyQualifiedName`**: A unique name that identifies a API Collection in the format 'ServiceName.ApiCollectionName.APIEndpoint'. Refer to *[../../type/basic.json#/definitions/fullyQualifiedEntityName](#/../type/basic.json#/definitions/fullyQualifiedEntityName)*.
- **`description`**: Description of the API Endpoint, what it is, and how to use it. Refer to *[../../type/basic.json#/definitions/markdown](#/../type/basic.json#/definitions/markdown)*.
- **`version`**: Metadata version of the entity. Refer to *[../../type/entityHistory.json#/definitions/entityVersion](#/../type/entityHistory.json#/definitions/entityVersion)*.
- **`updatedAt`**: Last update time corresponding to the new version of the entity in Unix epoch time milliseconds. Refer to *[../../type/basic.json#/definitions/timestamp](#/../type/basic.json#/definitions/timestamp)*.
- **`updatedBy`** *(string)*: User who made the update.
- **`endpointURL`** *(string, format: uri)*: EndPoint URL for the API Collection. Capture the Root URL of the collection.
- **`requestMethod`**: Request Method for the API Endpoint. Refer to *[#/definitions/apiRequestMethod](#definitions/apiRequestMethod)*.
- **`requestSchema`**: Request Schema for the API Endpoint. Refer to *[../../type/apiSchema.json](#/../type/apiSchema.json)*.
- **`responseSchema`**: Response Schema for the API Endpoint. Refer to *[../../type/apiSchema.json](#/../type/apiSchema.json)*.
- **`apiCollection`**: Reference to API Collection that contains this API Endpoint. Refer to *[../../type/entityReference.json](#/../type/entityReference.json)*.
- **`href`**: Link to the resource corresponding to this entity. Refer to *[../../type/basic.json#/definitions/href](#/../type/basic.json#/definitions/href)*.
- **`owners`**: Owners of this API Collection. Refer to *[../../type/entityReferenceList.json](#/../type/entityReferenceList.json)*.
- **`followers`**: Followers of this API Collection. Refer to *[../../type/entityReferenceList.json](#/../type/entityReferenceList.json)*.
- **`tags`** *(array)*: Tags for this API Collection. Default: `[]`.
  - **Items**: Refer to *[../../type/tagLabel.json](#/../type/tagLabel.json)*.
- **`service`**: Link to service where this API Collection is hosted in. Refer to *[../../type/entityReference.json](#/../type/entityReference.json)*.
- **`serviceType`**: Service type where this API Collection is hosted in. Refer to *[../services/apiService.json#/definitions/apiServiceType](#/services/apiService.json#/definitions/apiServiceType)*.
- **`changeDescription`**: Change that lead to this version of the entity. Refer to *[../../type/entityHistory.json#/definitions/changeDescription](#/../type/entityHistory.json#/definitions/changeDescription)*.
- **`deleted`** *(boolean)*: When `true` indicates the entity has been soft deleted. Default: `false`.
- **`extension`**: Entity extension data with custom attributes added to the entity. Refer to *[../../type/basic.json#/definitions/entityExtension](#/../type/basic.json#/definitions/entityExtension)*.
- **`domain`**: Domain the API Collection belongs to. When not set, the API Collection inherits the domain from the API service it belongs to. Refer to *[../../type/entityReference.json](#/../type/entityReference.json)*.
- **`dataProducts`**: List of data products this entity is part of. Refer to *[../../type/entityReferenceList.json](#/../type/entityReferenceList.json)*.
- **`votes`**: Votes on the entity. Refer to *[../../type/votes.json](#/../type/votes.json)*.
- **`lifeCycle`**: Life Cycle properties of the entity. Refer to *[../../type/lifeCycle.json](#/../type/lifeCycle.json)*.
- **`certification`**: Refer to *[../../type/assetCertification.json](#/../type/assetCertification.json)*.
- **`sourceHash`** *(string)*: Source hash of the entity.
## Definitions

- **`apiRequestMethod`** *(string)*: This schema defines the Request Method type for APIs . Must be one of: `["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "CONNECT", "OPTIONS", "TRACE"]`. Default: `"GET"`.


Documentation file automatically generated at 2025-01-15 09:05:41.923720+00:00.
