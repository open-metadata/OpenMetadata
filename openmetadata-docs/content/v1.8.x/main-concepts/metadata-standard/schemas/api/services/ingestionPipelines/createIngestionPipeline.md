---
title: createIngestionPipeline
slug: /main-concepts/metadata-standard/schemas/api/services/ingestionpipelines/createingestionpipeline
---

# CreateIngestionPipelineRequest

*Ingestion Pipeline Config is used to set up an Airflow DAG.*

## Properties

- **`name`**: Name that identifies this pipeline instance uniquely. Refer to *[../../../type/basic.json#/definitions/entityName](#/../../type/basic.json#/definitions/entityName)*.
- **`displayName`** *(string)*: Display Name that identifies this ingestion pipeline.
- **`description`**: Description of the pipeline. Refer to *[../../../type/basic.json#/definitions/markdown](#/../../type/basic.json#/definitions/markdown)*.
- **`pipelineType`**: Refer to *[../../../entity/services/ingestionPipelines/ingestionPipeline.json#/definitions/pipelineType](#/../../entity/services/ingestionPipelines/ingestionPipeline.json#/definitions/pipelineType)*.
- **`sourceConfig`**: Refer to *[../../../metadataIngestion/workflow.json#/definitions/sourceConfig](#/../../metadataIngestion/workflow.json#/definitions/sourceConfig)*.
- **`airflowConfig`**: Refer to *[../../../entity/services/ingestionPipelines/ingestionPipeline.json#/definitions/airflowConfig](#/../../entity/services/ingestionPipelines/ingestionPipeline.json#/definitions/airflowConfig)*.
- **`loggerLevel`**: Set the logging level for the workflow. Refer to *[../../../metadataIngestion/workflow.json#/definitions/logLevels](#/../../metadataIngestion/workflow.json#/definitions/logLevels)*.
- **`service`**: Link to the service for which ingestion pipeline is ingesting the metadata. Refer to *[../../../type/entityReference.json](#/../../type/entityReference.json)*.
- **`owners`**: Owner of this Ingestion Pipeline. Refer to *[../../../type/entityReferenceList.json](#/../../type/entityReferenceList.json)*. Default: `null`.
- **`domain`** *(string)*: Fully qualified name of the domain the Table belongs to.


Documentation file automatically generated at 2025-01-15 09:05:41.923720+00:00.
