---
title: Create API Service | `brandName` API Service Creation
description: Register an API service with endpoints, status codes, and associated metadata for API lifecycle management.
slug: /main-concepts/metadata-standard/schemas/api/services/createapiservice
---

# CreateApiServiceRequest

*Create API Service entity request*

## Properties

- **`name`**: Name that identifies the this entity instance uniquely. Refer to *[../../type/basic.json#/definitions/entityName](#/../type/basic.json#/definitions/entityName)*.
- **`displayName`** *(string)*: Display Name that identifies this API service. It could be title or label from the source services.
- **`description`**: Description of API service entity. Refer to *[../../type/basic.json#/definitions/markdown](#/../type/basic.json#/definitions/markdown)*.
- **`serviceType`**: Refer to *[../../entity/services/apiService.json#/definitions/apiServiceType](#/../entity/services/apiService.json#/definitions/apiServiceType)*.
- **`connection`**: Refer to *[../../entity/services/apiService.json#/definitions/apiConnection](#/../entity/services/apiService.json#/definitions/apiConnection)*.
- **`tags`** *(array)*: Tags for this API Service. Default: `null`.
  - **Items**: Refer to *[../../type/tagLabel.json](#/../type/tagLabel.json)*.
- **`owners`**: Owners of this API service. Refer to *[../../type/entityReferenceList.json](#/../type/entityReferenceList.json)*. Default: `null`.
- **`dataProducts`** *(array)*: List of fully qualified names of data products this entity is part of.
  - **Items**: Refer to *[../../type/basic.json#/definitions/fullyQualifiedEntityName](#/../type/basic.json#/definitions/fullyQualifiedEntityName)*.
- **`domain`** *(string)*: Fully qualified name of the domain the API Service belongs to.


Documentation file automatically generated at 2025-01-15 09:05:41.923720+00:00.
