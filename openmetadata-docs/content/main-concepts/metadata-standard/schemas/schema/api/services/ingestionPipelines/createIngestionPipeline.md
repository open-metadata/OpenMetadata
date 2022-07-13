---
title: createIngestionPipeline
slug: /main-concepts/metadata-standard/schemas/schema/api/services/ingestionPipelines
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
- **`service`**: Link to the database service where this database is hosted in. Refer to *../../../type/entityReference.json*.
- **`owner`**: Owner of this Pipeline. Refer to *../../../type/entityReference.json*. Default: `None`.


Documentation file automatically generated at 2022-07-13 10:27:46.766157.
