---
title: pipelineService
slug: /main-concepts/metadata-standard/schemas/entity/services/pipelineservice
---

# Pipeline Service

*This schema defines the Pipeline Service entity, such as Airflow and Prefect.*

## Properties

- **`id`**: Unique identifier of this pipeline service instance. Refer to *../../type/basic.json#/definitions/uuid*.
- **`name`**: Name that identifies this pipeline service. Refer to *../../type/basic.json#/definitions/entityName*.
- **`fullyQualifiedName`**: FullyQualifiedName same as `name`. Refer to *../../type/basic.json#/definitions/fullyQualifiedEntityName*.
- **`serviceType`**: Type of pipeline service such as Airflow or Prefect... Refer to *#/definitions/pipelineServiceType*.
- **`description`** *(string)*: Description of a pipeline service instance.
- **`displayName`** *(string)*: Display Name that identifies this pipeline service. It could be title or label from the source services.
- **`version`**: Metadata version of the entity. Refer to *../../type/entityHistory.json#/definitions/entityVersion*.
- **`updatedAt`**: Last update time corresponding to the new version of the entity in Unix epoch time milliseconds. Refer to *../../type/basic.json#/definitions/timestamp*.
- **`updatedBy`** *(string)*: User who made the update.
- **`testConnectionResult`**: Last test connection results for this service. Refer to *connections/testConnectionResult.json*.
- **`tags`** *(array)*: Tags for this Pipeline Service. Default: `[]`.
  - **Items**: Refer to *../../type/tagLabel.json*.
- **`pipelines`**: References to pipelines deployed for this pipeline service to extract metadata. Refer to *../../type/entityReferenceList.json*.
- **`connection`**: Refer to *#/definitions/pipelineConnection*.
- **`owners`**: Owners of this pipeline service. Refer to *../../type/entityReferenceList.json*.
- **`href`**: Link to the resource corresponding to this pipeline service. Refer to *../../type/basic.json#/definitions/href*.
- **`changeDescription`**: Change that lead to this version of the entity. Refer to *../../type/entityHistory.json#/definitions/changeDescription*.
- **`incrementalChangeDescription`**: Change that lead to this version of the entity. Refer to *../../type/entityHistory.json#/definitions/changeDescription*.
- **`deleted`** *(boolean)*: When `true` indicates the entity has been soft deleted. Default: `False`.
- **`dataProducts`**: List of data products this entity is part of. Refer to *../../type/entityReferenceList.json*.
- **`followers`**: Followers of this entity. Refer to *../../type/entityReferenceList.json*.
- **`domains`**: Domains the Pipeline service belongs to. Refer to *../../type/entityReferenceList.json*.
- **`ingestionRunner`**: The ingestion agent responsible for executing the ingestion pipeline. Refer to *../../type/entityReference.json*.
## Definitions

- **`pipelineServiceType`** *(string)*: Type of pipeline service - Airflow or Prefect. Must be one of: `['Airflow', 'GluePipeline', 'Airbyte', 'Fivetran', 'Flink', 'Dagster', 'Nifi', 'DomoPipeline', 'CustomPipeline', 'DatabricksPipeline', 'Spline', 'Spark', 'OpenLineage', 'KafkaConnect', 'DBTCloud', 'Matillion', 'Stitch', 'DataFactory', 'Wherescape', 'SSIS']`.
- **`pipelineConnection`** *(object)*: Pipeline Connection. Cannot contain additional properties.
  - **`config`**


Documentation file automatically generated at 2025-08-08 15:20:07.536378+00:00.
