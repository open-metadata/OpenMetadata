---
title: createIngestionPipeline
slug: /main-concepts/metadata-standard/schemas/api/services/ingestionpipelines/createingestionpipeline
---

# CreateIngestionPipelineRequest

*Ingestion Pipeline Config is used to set up an Airflow DAG.*

## Properties

- **`name`**: Name that identifies this pipeline instance uniquely. Refer to *../../../type/basic.json#/definitions/entityName*.
- **`displayName`** *(string)*: Display Name that identifies this ingestion pipeline.
- **`description`**: Description of the pipeline. Refer to *../../../type/basic.json#/definitions/markdown*.
- **`pipelineType`**: Refer to *../../../entity/services/ingestionPipelines/ingestionPipeline.json#/definitions/pipelineType*.
- **`sourceConfig`**: Refer to *../../../metadataIngestion/workflow.json#/definitions/sourceConfig*.
- **`airflowConfig`**: Refer to *../../../entity/services/ingestionPipelines/ingestionPipeline.json#/definitions/airflowConfig*.
- **`loggerLevel`**: Set the logging level for the workflow. Refer to *../../../metadataIngestion/workflow.json#/definitions/logLevels*.
- **`raiseOnError`** *(boolean)*: Control if we want to flag the workflow as failed if we encounter any processing errors. Default: `True`.
- **`service`**: Link to the service for which ingestion pipeline is ingesting the metadata. Refer to *../../../type/entityReference.json*.
- **`owners`**: Owner of this Ingestion Pipeline. Refer to *../../../type/entityReferenceList.json*. Default: `None`.
- **`provider`**: Refer to *../../../type/basic.json#/definitions/providerType*.
- **`domains`** *(array)*: Fully qualified names of the domains the Ingestion Pipeline belongs to.
  - **Items** *(string)*
- **`processingEngine`**: The processing engine responsible for executing the ingestion pipeline logic. Refer to *../../../type/entityReference.json*.


Documentation file automatically generated at 2025-08-08 15:20:07.536378+00:00.
