---
title: createAPIEndpoint
slug: /main-concepts/metadata-standard/schemas/api/data/createapiendpoint
---

# CreateAPIEndpointRequest

*Create a APIEndpoint entity request*

## Properties

- **`name`**: Name that identifies this APIEndpoint instance uniquely. We use operationId from OpenAPI specification. Refer to *../../type/basic.json#/definitions/entityName*.
- **`displayName`** *(string)*: Display Name that identifies this APIEndpoint.
- **`description`**: Description of the APIEndpoint instance. What it has and how to use it. Refer to *../../type/basic.json#/definitions/markdown*.
- **`apiCollection`**: Reference to API Collection that contains this API Endpoint. Refer to *../../type/basic.json#/definitions/fullyQualifiedEntityName*.
- **`endpointURL`** *(string)*: EndPoint URL for the API Collection. Capture the Root URL of the collection.
- **`requestMethod`**: Request Method for the API Endpoint. Refer to *../../entity/data/apiEndpoint.json#/definitions/apiRequestMethod*.
- **`requestSchema`**: Request Schema for the API Endpoint. Refer to *../../type/apiSchema.json*.
- **`responseSchema`**: Response Schema for the API Endpoint. Refer to *../../type/apiSchema.json*.
- **`owners`**: Owners of this topic. Refer to *../../type/entityReferenceList.json*. Default: `None`.
- **`tags`** *(array)*: Tags for this topic. Default: `None`.
  - **Items**: Refer to *../../type/tagLabel.json*.
- **`extension`**: Entity extension data with custom attributes added to the entity. Refer to *../../type/basic.json#/definitions/entityExtension*.
- **`sourceUrl`**: Source URL of topic. Refer to *../../type/basic.json#/definitions/sourceUrl*.
- **`domains`** *(array)*: Fully qualified names of the domains the API belongs to.
  - **Items**: Refer to *../../type/basic.json#/definitions/fullyQualifiedEntityName*.
- **`dataProducts`** *(array)*: List of fully qualified names of data products this entity is part of.
  - **Items**: Refer to *../../type/basic.json#/definitions/fullyQualifiedEntityName*.
- **`lifeCycle`**: Life Cycle of the entity. Refer to *../../type/lifeCycle.json*.
- **`sourceHash`** *(string)*: Source hash of the entity.


Documentation file automatically generated at 2025-08-08 15:20:07.536378+00:00.
