---
title: externalAppIngestionConfig | Official Documentation
description: Schema defining external configuration for application integration with third-party services.
slug: /main-concepts/metadata-standard/schemas/entity/applications/configuration/externalappingestionconfig
---

# ExternalAppIngestionConfig

*This schema defines External App Ingestion Config used for app working with Ingestion.*

## Properties

- **`name`**: Name of the ingestion Pipeline. Refer to *../../../type/basic.json#/definitions/entityName*.
- **`displayName`** *(string)*: Display Name that identifies this ingestion pipeline.
- **`description`**: Description of the pipeline. Refer to *../../../type/basic.json#/definitions/markdown*.
- **`pipelineType`**: Refer to *../../../entity/services/ingestionPipelines/ingestionPipeline.json#/definitions/pipelineType*.
- **`sourceConfig`**: Refer to *../../../metadataIngestion/workflow.json#/definitions/sourceConfig*.
- **`airflowConfig`**: Refer to *../../../entity/services/ingestionPipelines/ingestionPipeline.json#/definitions/airflowConfig*.
- **`loggerLevel`**: Set the logging level for the workflow. Refer to *../../../metadataIngestion/workflow.json#/definitions/logLevels*.
- **`service`**: Refer to *#/definitions/service*.
## Definitions

- **`service`**: Link to the service for which ingestion pipeline is ingesting the metadata.
  - **`name`** *(string)*: Name of the Service.
  - **`type`** *(string)*: Type of Service.


Documentation file automatically generated at 2023-10-27 13:55:46.343512.
