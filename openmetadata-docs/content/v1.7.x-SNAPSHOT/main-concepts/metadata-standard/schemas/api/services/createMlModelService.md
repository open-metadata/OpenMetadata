---
title: createMlModelService
slug: /main-concepts/metadata-standard/schemas/api/services/createmlmodelservice
---

# CreateMlModelServiceRequest

*Create MlModel service entity request*

## Properties

- **`name`**: Name that identifies the this entity instance uniquely. Refer to *[../../type/basic.json#/definitions/entityName](#/../type/basic.json#/definitions/entityName)*.
- **`displayName`** *(string)*: Display Name that identifies this mlModel service.
- **`description`**: Description of mlModel service entity. Refer to *[../../type/basic.json#/definitions/markdown](#/../type/basic.json#/definitions/markdown)*.
- **`serviceType`**: Refer to *[../../entity/services/mlmodelService.json#/definitions/mlModelServiceType](#/../entity/services/mlmodelService.json#/definitions/mlModelServiceType)*.
- **`connection`**: Refer to *[../../entity/services/mlmodelService.json#/definitions/mlModelConnection](#/../entity/services/mlmodelService.json#/definitions/mlModelConnection)*.
- **`tags`** *(array)*: Tags for this MlModel Service. Default: `null`.
  - **Items**: Refer to *[../../type/tagLabel.json](#/../type/tagLabel.json)*.
- **`owners`**: Owners of this mlModel service. Refer to *[../../type/entityReferenceList.json](#/../type/entityReferenceList.json)*. Default: `null`.
- **`dataProducts`** *(array)*: List of fully qualified names of data products this entity is part of.
  - **Items**: Refer to *[../../type/basic.json#/definitions/fullyQualifiedEntityName](#/../type/basic.json#/definitions/fullyQualifiedEntityName)*.
- **`domain`** *(string)*: Fully qualified name of the domain the MLModel Service belongs to.


Documentation file automatically generated at 2025-01-15 09:05:41.923720+00:00.
