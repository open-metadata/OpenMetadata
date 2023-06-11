---
title: workflow
slug: /main-concepts/metadata-standard/schemas/metadataingestion/workflow
---

# MetadataWorkflow

*OpenMetadata Ingestion Framework definition.*

## Properties

- **`id`**: Unique identifier that identifies this pipeline. Refer to *../type/basic.json#/definitions/uuid*.
- **`name`**: Name that identifies this pipeline instance uniquely. Refer to *../type/basic.json#/definitions/entityName*.
- **`openMetadataWorkflowConfig`** *(object)*: OpenMetadata Ingestion Workflow Config. Cannot contain additional properties.
  - **`source`**: Refer to *#/definitions/source*.
  - **`processor`**: Refer to *#/definitions/processor*.
  - **`sink`**: Refer to *#/definitions/sink*.
  - **`stage`**: Refer to *#/definitions/stage*.
  - **`bulkSink`**: Refer to *#/definitions/bulkSink*.
  - **`workflowConfig`**: Refer to *#/definitions/workflowConfig*.
## Definitions

- **`sourceConfig`** *(object)*: Additional connection configuration. Cannot contain additional properties.
  - **`config`**
- **`componentConfig`** *(object)*: key/value pairs to pass to sink component. Can contain additional properties.
  - **Additional Properties** *(string)*
- **`source`** *(object)*: Configuration for Source component in OpenMetadata Ingestion Framework. Cannot contain additional properties.
  - **`type`** *(string)*: Type of the source connector ex: mysql, snowflake, tableau etc..
  - **`serviceName`** *(string)*: Type of the source connector ex: mysql, snowflake, tableau etc..
  - **`serviceConnection`**: Connection configuration for the source. ex: mysql , tableau connection. Refer to *../entity/services/connections/serviceConnection.json#/definitions/serviceConnection*.
  - **`sourceConfig`**: Refer to *#/definitions/sourceConfig*.
- **`processor`** *(object)*: Configuration for Processor Component in the OpenMetadata Ingestion Framework. Cannot contain additional properties.
  - **`type`** *(string)*: Type of processor component ex: pii-processor.
  - **`config`**: Refer to *#/definitions/componentConfig*.
- **`stage`** *(object)*: Configuration for Stage Component in the OpenMetadata Ingestion Framework. Cannot contain additional properties.
  - **`type`** *(string)*: Type of stage component ex: table-usage.
  - **`config`**: Refer to *#/definitions/componentConfig*.
- **`sink`** *(object)*: Configuration for Sink Component in the OpenMetadata Ingestion Framework. Cannot contain additional properties.
  - **`type`** *(string)*: Type of sink component ex: metadata.
  - **`config`**: Refer to *#/definitions/componentConfig*.
- **`bulkSink`** *(object)*: Configuration for BulkSink Component in the OpenMetadata Ingestion Framework. Cannot contain additional properties.
  - **`type`** *(string)*: Type of BulkSink component ex: metadata-usage.
  - **`config`**: Refer to *#/definitions/componentConfig*.
- **`logLevels`** *(string)*: Supported logging levels. Must be one of: `['DEBUG', 'INFO', 'WARN', 'ERROR']`. Default: `INFO`.
- **`workflowConfig`** *(object)*: Configuration for the entire Ingestion Workflow. Cannot contain additional properties.
  - **`loggerLevel`**: Refer to *#/definitions/logLevels*. Default: `INFO`.
  - **`openMetadataServerConfig`**: Refer to *../entity/services/connections/metadata/openMetadataConnection.json*.
  - **`config`**: Refer to *#/definitions/componentConfig*.


Documentation file automatically generated at 2022-07-14 10:51:34.749986.
