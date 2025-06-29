---
title: Pipeline Service | OpenMetadata Pipeline Service
slug: /main-concepts/metadata-standard/schemas/entity/services/pipelineservice
---

# Pipeline Service

*This schema defines the Pipeline Service entity, such as Airflow and Prefect.*

## Properties

- **`id`**: Unique identifier of this pipeline service instance. Refer to *[../../type/basic.json#/definitions/uuid](#/../type/basic.json#/definitions/uuid)*.
- **`name`**: Name that identifies this pipeline service. Refer to *[../../type/basic.json#/definitions/entityName](#/../type/basic.json#/definitions/entityName)*.
- **`fullyQualifiedName`**: FullyQualifiedName same as `name`. Refer to *[../../type/basic.json#/definitions/fullyQualifiedEntityName](#/../type/basic.json#/definitions/fullyQualifiedEntityName)*.
- **`serviceType`**: Type of pipeline service such as Airflow or Prefect... Refer to *[#/definitions/pipelineServiceType](#definitions/pipelineServiceType)*.
- **`description`** *(string)*: Description of a pipeline service instance.
- **`displayName`** *(string)*: Display Name that identifies this pipeline service. It could be title or label from the source services.
- **`version`**: Metadata version of the entity. Refer to *[../../type/entityHistory.json#/definitions/entityVersion](#/../type/entityHistory.json#/definitions/entityVersion)*.
- **`updatedAt`**: Last update time corresponding to the new version of the entity in Unix epoch time milliseconds. Refer to *[../../type/basic.json#/definitions/timestamp](#/../type/basic.json#/definitions/timestamp)*.
- **`updatedBy`** *(string)*: User who made the update.
- **`testConnectionResult`**: Last test connection results for this service. Refer to *[connections/testConnectionResult.json](#nnections/testConnectionResult.json)*.
- **`tags`** *(array)*: Tags for this Pipeline Service. Default: `[]`.
  - **Items**: Refer to *[../../type/tagLabel.json](#/../type/tagLabel.json)*.
- **`pipelines`**: References to pipelines deployed for this pipeline service to extract metadata. Refer to *[../../type/entityReferenceList.json](#/../type/entityReferenceList.json)*.
- **`connection`**: Refer to *[#/definitions/pipelineConnection](#definitions/pipelineConnection)*.
- **`owners`**: Owners of this pipeline service. Refer to *[../../type/entityReferenceList.json](#/../type/entityReferenceList.json)*.
- **`href`**: Link to the resource corresponding to this pipeline service. Refer to *[../../type/basic.json#/definitions/href](#/../type/basic.json#/definitions/href)*.
- **`changeDescription`**: Change that lead to this version of the entity. Refer to *[../../type/entityHistory.json#/definitions/changeDescription](#/../type/entityHistory.json#/definitions/changeDescription)*.
- **`deleted`** *(boolean)*: When `true` indicates the entity has been soft deleted. Default: `false`.
- **`dataProducts`**: List of data products this entity is part of. Refer to *[../../type/entityReferenceList.json](#/../type/entityReferenceList.json)*.
- **`domain`**: Domain the Pipeline service belongs to. Refer to *[../../type/entityReference.json](#/../type/entityReference.json)*.
## Definitions

- **`pipelineServiceType`** *(string)*: Type of pipeline service - Airflow or Prefect. Must be one of: `["Airflow", "GluePipeline", "Airbyte", "Fivetran", "Flink", "Dagster", "Nifi", "DomoPipeline", "CustomPipeline", "DatabricksPipeline", "Spline", "Spark", "OpenLineage", "KafkaConnect", "DBTCloud", "Matillion", "Stitch", "DataFactory"]`.
- **`pipelineConnection`** *(object)*: Pipeline Connection. Cannot contain additional properties.
  - **`config`**
    - **One of**
      - : Refer to *[./connections/pipeline/airflowConnection.json](#connections/pipeline/airflowConnection.json)*.
      - : Refer to *[./connections/pipeline/gluePipelineConnection.json](#connections/pipeline/gluePipelineConnection.json)*.
      - : Refer to *[./connections/pipeline/airbyteConnection.json](#connections/pipeline/airbyteConnection.json)*.
      - : Refer to *[./connections/pipeline/fivetranConnection.json](#connections/pipeline/fivetranConnection.json)*.
      - : Refer to *[./connections/pipeline/flinkConnection.json](#connections/pipeline/flinkConnection.json)*.
      - : Refer to *[./connections/pipeline/dagsterConnection.json](#connections/pipeline/dagsterConnection.json)*.
      - : Refer to *[./connections/pipeline/nifiConnection.json](#connections/pipeline/nifiConnection.json)*.
      - : Refer to *[./connections/pipeline/domoPipelineConnection.json](#connections/pipeline/domoPipelineConnection.json)*.
      - : Refer to *[./connections/pipeline/customPipelineConnection.json](#connections/pipeline/customPipelineConnection.json)*.
      - : Refer to *[./connections/pipeline/databricksPipelineConnection.json](#connections/pipeline/databricksPipelineConnection.json)*.
      - : Refer to *[./connections/pipeline/splineConnection.json](#connections/pipeline/splineConnection.json)*.
      - : Refer to *[./connections/pipeline/sparkConnection.json](#connections/pipeline/sparkConnection.json)*.
      - : Refer to *[./connections/pipeline/openLineageConnection.json](#connections/pipeline/openLineageConnection.json)*.
      - : Refer to *[./connections/pipeline/kafkaConnectConnection.json](#connections/pipeline/kafkaConnectConnection.json)*.
      - : Refer to *[./connections/pipeline/dbtCloudConnection.json](#connections/pipeline/dbtCloudConnection.json)*.
      - : Refer to *[./connections/pipeline/matillionConnection.json](#connections/pipeline/matillionConnection.json)*.
      - : Refer to *[./connections/pipeline/datafactoryConnection.json](#connections/pipeline/datafactoryConnection.json)*.
      - : Refer to *[./connections/pipeline/stitchConnection.json](#connections/pipeline/stitchConnection.json)*.


Documentation file automatically generated at 2025-01-15 09:05:41.923720+00:00.
