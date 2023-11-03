---
title: createIngestionPipeline
slug: /main-concepts/metadata-standard/schemas/api/services/ingestionpipelines/createingestionpipeline
---

# CreateIngestionPipelineRequest

*Ingestion Pipeline Config is used to setup a Airflow DAG.*

## Properties

- **`name`**: Name that identifies this pipeline instance uniquely. Refer to *../../../type/basic.json#/definitions/entityName*.
- **`displayName`** *(string)*: Display Name that identifies this ingestion pipeline.
- **`description`**: Description of the pipeline. Refer to *../../../type/basic.json#/definitions/markdown*.
- **`pipelineType`**: Refer to *../../../entity/services/ingestionPipelines/ingestionPipeline.json#/definitions/pipelineType*.
- **`sourceConfig`**: Refer to *../../../metadataIngestion/workflow.json#/definitions/sourceConfig*.
- **`airflowConfig`**: Refer to *../../../entity/services/ingestionPipelines/ingestionPipeline.json#/definitions/airflowConfig*.
- **`loggerLevel`**: Set the logging level for the workflow. Refer to *../../../metadataIngestion/workflow.json#/definitions/logLevels*.
- **`service`**: Link to the service for which ingestion pipeline is ingesting the metadata. Refer to *../../../type/entityReference.json*.
- **`owner`**: Owner of this Pipeline. Refer to *../../../type/entityReference.json*.


Documentation file automatically generated at 2023-07-07 05:50:35.981927.
