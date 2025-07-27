---
title: Create API Endpoint | OpenMetadata API Endpoint
description: Connect Createapiendpoint to enable streamlined access, monitoring, or search of enterprise data using secure and scalable integrations.
slug: /main-concepts/metadata-standard/schemas/api/data/createapiendpoint
---

# CreateAPIEndpointRequest

*Create a APIEndpoint entity request*

## Properties

- **`name`**: Name that identifies this APIEndpoint instance uniquely. We use operationId from OpenAPI specification. Refer to *[../../type/basic.json#/definitions/entityName](#/../type/basic.json#/definitions/entityName)*.
- **`displayName`** *(string)*: Display Name that identifies this APIEndpoint.
- **`description`**: Description of the APIEndpoint instance. What it has and how to use it. Refer to *[../../type/basic.json#/definitions/markdown](#/../type/basic.json#/definitions/markdown)*.
- **`apiCollection`**: Reference to API Collection that contains this API Endpoint. Refer to *[../../type/basic.json#/definitions/fullyQualifiedEntityName](#/../type/basic.json#/definitions/fullyQualifiedEntityName)*.
- **`endpointURL`** *(string, format: uri)*: EndPoint URL for the API Collection. Capture the Root URL of the collection.
- **`requestMethod`**: Request Method for the API Endpoint. Refer to *[../../entity/data/apiEndpoint.json#/definitions/apiRequestMethod](#/../entity/data/apiEndpoint.json#/definitions/apiRequestMethod)*.
- **`requestSchema`**: Request Schema for the API Endpoint. Refer to *[../../type/apiSchema.json](#/../type/apiSchema.json)*.
- **`responseSchema`**: Response Schema for the API Endpoint. Refer to *[../../type/apiSchema.json](#/../type/apiSchema.json)*.
- **`owners`**: Owners of this topic. Refer to *[../../type/entityReferenceList.json](#/../type/entityReferenceList.json)*. Default: `null`.
- **`tags`** *(array)*: Tags for this topic. Default: `null`.
  - **Items**: Refer to *[../../type/tagLabel.json](#/../type/tagLabel.json)*.
- **`extension`**: Entity extension data with custom attributes added to the entity. Refer to *[../../type/basic.json#/definitions/entityExtension](#/../type/basic.json#/definitions/entityExtension)*.
- **`sourceUrl`**: Source URL of topic. Refer to *[../../type/basic.json#/definitions/sourceUrl](#/../type/basic.json#/definitions/sourceUrl)*.
- **`domain`**: Fully qualified name of the domain the API belongs to. Refer to *[../../type/basic.json#/definitions/fullyQualifiedEntityName](#/../type/basic.json#/definitions/fullyQualifiedEntityName)*.
- **`dataProducts`** *(array)*: List of fully qualified names of data products this entity is part of.
  - **Items**: Refer to *[../../type/basic.json#/definitions/fullyQualifiedEntityName](#/../type/basic.json#/definitions/fullyQualifiedEntityName)*.
- **`lifeCycle`**: Life Cycle of the entity. Refer to *[../../type/lifeCycle.json](#/../type/lifeCycle.json)*.
- **`sourceHash`** *(string)*: Source hash of the entity.


Documentation file automatically generated at 2025-01-15 09:05:41.923720+00:00.
