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
- **`owner`**: Owner of this mlModel service. Refer to *[../../type/entityReference.json](#/../type/entityReference.json)*.
- **`domain`** *(string)*: Fully qualified name of the domain the MLModel Service belongs to.


Documentation file automatically generated at 2023-10-27 11:39:15.608628.
