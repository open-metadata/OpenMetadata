---
title: workflow | OpenMetadata Ingestion Workflow
slug: /main-concepts/metadata-standard/schemas/metadataingestion/workflow
---

# MetadataWorkflow

*OpenMetadata Ingestion Framework definition.*

## Properties

- **`id`**: Unique identifier that identifies this pipeline. Refer to *[../type/basic.json#/definitions/uuid](#/type/basic.json#/definitions/uuid)*.
- **`name`**: Name that identifies this pipeline instance uniquely. Refer to *[../type/basic.json#/definitions/entityName](#/type/basic.json#/definitions/entityName)*.
- **`openMetadataWorkflowConfig`** *(object)*: OpenMetadata Ingestion Workflow Config. Cannot contain additional properties.
  - **`source`**: Refer to *[#/definitions/source](#definitions/source)*.
  - **`processor`**: Refer to *[#/definitions/processor](#definitions/processor)*.
  - **`sink`**: Refer to *[#/definitions/sink](#definitions/sink)*.
  - **`stage`**: Refer to *[#/definitions/stage](#definitions/stage)*.
  - **`bulkSink`**: Refer to *[#/definitions/bulkSink](#definitions/bulkSink)*.
  - **`workflowConfig`**: Refer to *[#/definitions/workflowConfig](#definitions/workflowConfig)*.
  - **`ingestionPipelineFQN`** *(string)*: Fully qualified name of ingestion pipeline, used to identify the current ingestion pipeline.
  - **`pipelineRunId`**: Unique identifier of pipeline run, used to identify the current pipeline run. Refer to *[../type/basic.json#/definitions/uuid](#/type/basic.json#/definitions/uuid)*.
## Definitions

- **`sourceConfig`** *(object)*: Additional connection configuration. Cannot contain additional properties.
  - **`config`**
    - **One of**
      - : Refer to *[databaseServiceMetadataPipeline.json](#tabaseServiceMetadataPipeline.json)*.
      - : Refer to *[databaseServiceQueryUsagePipeline.json](#tabaseServiceQueryUsagePipeline.json)*.
      - : Refer to *[databaseServiceQueryLineagePipeline.json](#tabaseServiceQueryLineagePipeline.json)*.
      - : Refer to *[dashboardServiceMetadataPipeline.json](#shboardServiceMetadataPipeline.json)*.
      - : Refer to *[messagingServiceMetadataPipeline.json](#ssagingServiceMetadataPipeline.json)*.
      - : Refer to *[databaseServiceProfilerPipeline.json](#tabaseServiceProfilerPipeline.json)*.
      - : Refer to *[databaseServiceAutoClassificationPipeline.json](#tabaseServiceAutoClassificationPipeline.json)*.
      - : Refer to *[pipelineServiceMetadataPipeline.json](#pelineServiceMetadataPipeline.json)*.
      - : Refer to *[mlmodelServiceMetadataPipeline.json](#modelServiceMetadataPipeline.json)*.
      - : Refer to *[storageServiceMetadataPipeline.json](#orageServiceMetadataPipeline.json)*.
      - : Refer to *[searchServiceMetadataPipeline.json](#archServiceMetadataPipeline.json)*.
      - : Refer to *[testSuitePipeline.json](#stSuitePipeline.json)*.
      - : Refer to *[metadataToElasticSearchPipeline.json](#tadataToElasticSearchPipeline.json)*.
      - : Refer to *[dataInsightPipeline.json](#taInsightPipeline.json)*.
      - : Refer to *[dbtPipeline.json](#tPipeline.json)*.
      - : Refer to *[applicationPipeline.json](#plicationPipeline.json)*.
      - : Refer to *[apiServiceMetadataPipeline.json](#iServiceMetadataPipeline.json)*.
- **`source`** *(object)*: Configuration for Source component in OpenMetadata Ingestion Framework. Cannot contain additional properties.
  - **`type`** *(string, required)*: Type of the source connector ex: mysql, snowflake, tableau etc..
  - **`serviceName`** *(string)*: Type of the source connector ex: mysql, snowflake, tableau etc..
  - **`serviceConnection`**: Connection configuration for the source. ex: mysql , tableau connection. Refer to *[../entity/services/connections/serviceConnection.json#/definitions/serviceConnection](#/entity/services/connections/serviceConnection.json#/definitions/serviceConnection)*.
  - **`sourceConfig`**: Refer to *[#/definitions/sourceConfig](#definitions/sourceConfig)*.
- **`processor`** *(object)*: Configuration for Processor Component in the OpenMetadata Ingestion Framework. Cannot contain additional properties.
  - **`type`** *(string, required)*: Type of processor component ex: pii-processor.
  - **`config`**: Refer to *[../type/basic.json#/definitions/componentConfig](#/type/basic.json#/definitions/componentConfig)*.
- **`stage`** *(object)*: Configuration for Stage Component in the OpenMetadata Ingestion Framework. Cannot contain additional properties.
  - **`type`** *(string, required)*: Type of stage component ex: table-usage.
  - **`config`**: Refer to *[../type/basic.json#/definitions/componentConfig](#/type/basic.json#/definitions/componentConfig)*.
- **`sink`** *(object)*: Configuration for Sink Component in the OpenMetadata Ingestion Framework. Cannot contain additional properties.
  - **`type`** *(string, required)*: Type of sink component ex: metadata.
  - **`config`**: Refer to *[../type/basic.json#/definitions/componentConfig](#/type/basic.json#/definitions/componentConfig)*.
- **`bulkSink`** *(object)*: Configuration for BulkSink Component in the OpenMetadata Ingestion Framework. Cannot contain additional properties.
  - **`type`** *(string, required)*: Type of BulkSink component ex: metadata-usage.
  - **`config`**: Refer to *[../type/basic.json#/definitions/componentConfig](#/type/basic.json#/definitions/componentConfig)*.
- **`logLevels`** *(string)*: Supported logging levels. Must be one of: `["DEBUG", "INFO", "WARN", "ERROR"]`. Default: `"INFO"`.
- **`workflowConfig`** *(object)*: Configuration for the entire Ingestion Workflow. Cannot contain additional properties.
  - **`loggerLevel`**: Refer to *[#/definitions/logLevels](#definitions/logLevels)*. Default: `"INFO"`.
  - **`successThreshold`** *(integer)*: The percentage of successfully processed records that must be achieved for the pipeline to be considered successful. Otherwise, the pipeline will be marked as failed. Minimum: `0`. Maximum: `100`. Default: `90`.
  - **`openMetadataServerConfig`**: Refer to *[../entity/services/connections/metadata/openMetadataConnection.json](#/entity/services/connections/metadata/openMetadataConnection.json)*.
  - **`config`**: Refer to *[../type/basic.json#/definitions/componentConfig](#/type/basic.json#/definitions/componentConfig)*.


Documentation file automatically generated at 2025-01-15 09:05:41.923720+00:00.
