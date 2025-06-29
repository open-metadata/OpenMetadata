---
title: ML Model Service | OpenMetadata ML Model Service
slug: /main-concepts/metadata-standard/schemas/entity/services/mlmodelservice
---

# MlModelService

*MlModel Service Entity, such as MlFlow.*

## Properties

- **`id`**: Unique identifier of this pipeline service instance. Refer to *[../../type/basic.json#/definitions/uuid](#/../type/basic.json#/definitions/uuid)*.
- **`name`**: Name that identifies this pipeline service. Refer to *[../../type/basic.json#/definitions/entityName](#/../type/basic.json#/definitions/entityName)*.
- **`fullyQualifiedName`**: FullyQualifiedName same as `name`. Refer to *[../../type/basic.json#/definitions/fullyQualifiedEntityName](#/../type/basic.json#/definitions/fullyQualifiedEntityName)*.
- **`serviceType`**: Type of pipeline service such as Airflow or Prefect... Refer to *[#/definitions/mlModelServiceType](#definitions/mlModelServiceType)*.
- **`description`** *(string)*: Description of a pipeline service instance.
- **`displayName`** *(string)*: Display Name that identifies this pipeline service. It could be title or label from the source services.
- **`version`**: Metadata version of the entity. Refer to *[../../type/entityHistory.json#/definitions/entityVersion](#/../type/entityHistory.json#/definitions/entityVersion)*.
- **`updatedAt`**: Last update time corresponding to the new version of the entity in Unix epoch time milliseconds. Refer to *[../../type/basic.json#/definitions/timestamp](#/../type/basic.json#/definitions/timestamp)*.
- **`updatedBy`** *(string)*: User who made the update.
- **`pipelines`**: References to pipelines deployed for this pipeline service to extract metadata. Refer to *[../../type/entityReferenceList.json](#/../type/entityReferenceList.json)*.
- **`connection`**: Refer to *[#/definitions/mlModelConnection](#definitions/mlModelConnection)*.
- **`testConnectionResult`**: Last test connection results for this service. Refer to *[connections/testConnectionResult.json](#nnections/testConnectionResult.json)*.
- **`tags`** *(array)*: Tags for this MlModel Service. Default: `[]`.
  - **Items**: Refer to *[../../type/tagLabel.json](#/../type/tagLabel.json)*.
- **`owners`**: Owners of this pipeline service. Refer to *[../../type/entityReferenceList.json](#/../type/entityReferenceList.json)*.
- **`href`**: Link to the resource corresponding to this pipeline service. Refer to *[../../type/basic.json#/definitions/href](#/../type/basic.json#/definitions/href)*.
- **`changeDescription`**: Change that lead to this version of the entity. Refer to *[../../type/entityHistory.json#/definitions/changeDescription](#/../type/entityHistory.json#/definitions/changeDescription)*.
- **`deleted`** *(boolean)*: When `true` indicates the entity has been soft deleted. Default: `false`.
- **`dataProducts`**: List of data products this entity is part of. Refer to *[../../type/entityReferenceList.json](#/../type/entityReferenceList.json)*.
- **`domain`**: Domain the MLModel service belongs to. Refer to *[../../type/entityReference.json](#/../type/entityReference.json)*.
## Definitions

- **`mlModelServiceType`** *(string)*: Type of MlModel service. Must be one of: `["Mlflow", "Sklearn", "CustomMlModel", "SageMaker", "VertexAI"]`.
- **`mlModelConnection`** *(object)*: MlModel Connection. Cannot contain additional properties.
  - **`config`**
    - **One of**
      - : Refer to *[./connections/mlmodel/mlflowConnection.json](#connections/mlmodel/mlflowConnection.json)*.
      - : Refer to *[./connections/mlmodel/sklearnConnection.json](#connections/mlmodel/sklearnConnection.json)*.
      - : Refer to *[./connections/mlmodel/customMlModelConnection.json](#connections/mlmodel/customMlModelConnection.json)*.
      - : Refer to *[./connections/mlmodel/sageMakerConnection.json](#connections/mlmodel/sageMakerConnection.json)*.
      - : Refer to *[./connections/mlmodel/vertexaiConnection.json](#connections/mlmodel/vertexaiConnection.json)*.


Documentation file automatically generated at 2025-01-15 09:05:41.923720+00:00.
