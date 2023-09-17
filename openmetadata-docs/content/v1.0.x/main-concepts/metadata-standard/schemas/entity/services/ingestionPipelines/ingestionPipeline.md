---
title: ingestionPipeline
slug: /main-concepts/metadata-standard/schemas/entity/services/ingestionpipelines/ingestionpipeline
---

# IngestionPipeline

*Ingestion Pipeline Config is used to setup a DAG and deploy. This entity is used to setup metadata/quality pipelines on Apache Airflow.*

## Properties

- **`id`**: Unique identifier that identifies this pipeline. Refer to *../../../type/basic.json#/definitions/uuid*.
- **`name`**: Name that identifies this pipeline instance uniquely. Refer to *../../../type/basic.json#/definitions/entityName*.
- **`displayName`** *(string)*: Display Name that identifies this Pipeline.
- **`description`**: Description of the Pipeline. Refer to *../../../type/basic.json#/definitions/markdown*.
- **`pipelineType`**: Refer to *#/definitions/pipelineType*.
- **`owner`**: Owner of this Pipeline. Refer to *../../../type/entityReference.json*. Default: `None`.
- **`fullyQualifiedName`**: Name that uniquely identifies a Pipeline. Refer to *../../../type/basic.json#/definitions/fullyQualifiedEntityName*.
- **`sourceConfig`**: Refer to *../../../metadataIngestion/workflow.json#/definitions/sourceConfig*.
- **`openMetadataServerConnection`**: Refer to *../connections/metadata/openMetadataConnection.json*.
- **`airflowConfig`**: Refer to *#/definitions/airflowConfig*.
- **`service`**: Link to the database service where this database is hosted in. Refer to *../../../type/entityReference.json*.
- **`pipelineStatuses`** *(array)*: List of executions and status for the Pipeline. Default: `None`.
  - **Items**: Refer to *#/definitions/pipelineStatus*.
- **`loggerLevel`**: Set the logging level for the workflow. Refer to *../../../metadataIngestion/workflow.json#/definitions/logLevels*.
- **`deployed`** *(boolean)*: Indicates if the workflow has been successfully deployed to Airflow.
- **`enabled`** *(boolean)*: True if the pipeline is ready to be run in the next schedule. False if it is paused. Default: `True`.
- **`href`**: Link to this ingestion pipeline resource. Refer to *../../../type/basic.json#/definitions/href*.
- **`version`**: Metadata version of the entity. Refer to *../../../type/entityHistory.json#/definitions/entityVersion*.
- **`updatedAt`**: Last update time corresponding to the new version of the entity in Unix epoch time milliseconds. Refer to *../../../type/basic.json#/definitions/timestamp*.
- **`updatedBy`** *(string)*: User who made the update.
- **`changeDescription`**: Change that led to this version of the entity. Refer to *../../../type/entityHistory.json#/definitions/changeDescription*.
- **`deleted`** *(boolean)*: When `true` indicates the entity has been soft deleted. Default: `False`.
## Definitions

- **`pipelineType`** *(string)*: Type of Pipeline - metadata, usage. Must be one of: `['metadata', 'usage', 'profiler']`.
- **`pipelineStatus`** *(object)*: This defines runtime status of Pipeline. Cannot contain additional properties.
  - **`runId`** *(string)*: Pipeline unique run ID.
  - **`state`** *(string)*: Pipeline status denotes if its failed or succeeded.
  - **`startDate`** *(string)*: startDate of the pipeline run for this particular execution.
  - **`endDate`** *(string)*: endDate of the pipeline run for this particular execution.
- **`airflowConfig`** *(object)*: Properties to configure the Airflow pipeline that will run the workflow. Cannot contain additional properties.
  - **`pausePipeline`** *(boolean)*: pause the pipeline from running once the deploy is finished successfully. Default: `False`.
  - **`concurrency`** *(integer)*: Concurrency of the Pipeline. Default: `1`.
  - **`startDate`**: Start date of the pipeline. Refer to *../../../type/basic.json#/definitions/dateTime*.
  - **`endDate`**: End Date of the pipeline. Refer to *../../../type/basic.json#/definitions/dateTime*.
  - **`pipelineTimezone`** *(string)*: Timezone in which pipeline going to be scheduled. Default: `UTC`.
  - **`retries`** *(integer)*: Retry pipeline in case of failure. Default: `3`.
  - **`retryDelay`** *(integer)*: Delay between retries in seconds. Default: `300`.
  - **`pipelineCatchup`** *(boolean)*: Run past executions if the start date is in the past. Default: `False`.
  - **`scheduleInterval`** *(string)*: Scheduler Interval for the pipeline in cron format.
  - **`maxActiveRuns`** *(integer)*: Maximum Number of active runs. Default: `1`.
  - **`workflowTimeout`** *(integer)*: Timeout for the workflow in seconds. Default: `None`.
  - **`workflowDefaultView`** *(string)*: Default view in Airflow. Default: `tree`.
  - **`workflowDefaultViewOrientation`** *(string)*: Default view Orientation in Airflow. Default: `LR`.
  - **`email`**: Email to notify workflow status. Refer to *../../../type/basic.json#/definitions/email*.


Documentation file automatically generated at 2022-07-14 10:51:34.749986.
