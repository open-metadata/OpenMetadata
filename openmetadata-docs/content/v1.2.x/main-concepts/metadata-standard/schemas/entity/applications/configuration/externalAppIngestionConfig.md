---
title: externalAppIngestionConfig
slug: /main-concepts/metadata-standard/schemas/entity/applications/configuration/externalappingestionconfig
---

# ExternalAppIngestionConfig

*This schema defines External App Ingestion Config used for app working with Ingestion.*

## Properties

- **`name`**: Name of the ingestion Pipeline. Refer to *[../../../type/basic.json#/definitions/entityName](#/../../type/basic.json#/definitions/entityName)*.
- **`displayName`** *(string)*: Display Name that identifies this ingestion pipeline.
- **`description`**: Description of the pipeline. Refer to *[../../../type/basic.json#/definitions/markdown](#/../../type/basic.json#/definitions/markdown)*.
- **`pipelineType`**: Refer to *[../../../entity/services/ingestionPipelines/ingestionPipeline.json#/definitions/pipelineType](#/../../entity/services/ingestionPipelines/ingestionPipeline.json#/definitions/pipelineType)*.
- **`sourceConfig`**: Refer to *[../../../metadataIngestion/workflow.json#/definitions/sourceConfig](#/../../metadataIngestion/workflow.json#/definitions/sourceConfig)*.
- **`airflowConfig`**: Refer to *[../../../entity/services/ingestionPipelines/ingestionPipeline.json#/definitions/airflowConfig](#/../../entity/services/ingestionPipelines/ingestionPipeline.json#/definitions/airflowConfig)*.
- **`loggerLevel`**: Set the logging level for the workflow. Refer to *[../../../metadataIngestion/workflow.json#/definitions/logLevels](#/../../metadataIngestion/workflow.json#/definitions/logLevels)*.
- **`service`**: Refer to *[#/definitions/service](#definitions/service)*.
## Definitions

- <a id="definitions/service"></a>**`service`**: Link to the service for which ingestion pipeline is ingesting the metadata.
  - **`name`** *(string)*: Name of the Service.
  - **`type`** *(string)*: Type of Service.


Documentation file automatically generated at 2023-10-27 11:39:15.608628.
