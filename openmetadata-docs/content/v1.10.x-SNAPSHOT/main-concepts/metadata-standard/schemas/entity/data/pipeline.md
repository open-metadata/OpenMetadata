---
title: pipeline
slug: /main-concepts/metadata-standard/schemas/entity/data/pipeline
---

# Pipeline

*This schema defines the Pipeline entity. A pipeline enables the flow of data from source to destination through a series of processing steps. ETL is a type of pipeline where the series of steps Extract, Transform and Load the data.*

## Properties

- **`id`**: Unique identifier that identifies a pipeline instance. Refer to *../../type/basic.json#/definitions/uuid*.
- **`name`**: Name that identifies this pipeline instance uniquely. Refer to *../../type/basic.json#/definitions/entityName*.
- **`displayName`** *(string)*: Display Name that identifies this Pipeline. It could be title or label from the source services.
- **`fullyQualifiedName`**: A unique name that identifies a pipeline in the format 'ServiceName.PipelineName'. Refer to *../../type/basic.json#/definitions/fullyQualifiedEntityName*.
- **`description`**: Description of this Pipeline. Refer to *../../type/basic.json#/definitions/markdown*.
- **`dataProducts`**: List of data products this entity is part of. Refer to *../../type/entityReferenceList.json*.
- **`version`**: Metadata version of the entity. Refer to *../../type/entityHistory.json#/definitions/entityVersion*.
- **`updatedAt`**: Last update time corresponding to the new version of the entity in Unix epoch time milliseconds. Refer to *../../type/basic.json#/definitions/timestamp*.
- **`updatedBy`** *(string)*: User who made the update.
- **`sourceUrl`**: Pipeline  URL to visit/manage. This URL points to respective pipeline service UI. Refer to *../../type/basic.json#/definitions/sourceUrl*.
- **`concurrency`** *(integer)*: Concurrency of the Pipeline.
- **`pipelineLocation`** *(string)*: Pipeline Code Location.
- **`startDate`**: Start date of the workflow. Refer to *../../type/basic.json#/definitions/dateTime*.
- **`tasks`** *(array)*: All the tasks that are part of pipeline. Default: `None`.
  - **Items**: Refer to *#/definitions/task*.
- **`pipelineStatus`**: Latest Pipeline Status. Refer to *#/definitions/pipelineStatus*. Default: `None`.
- **`state`**: State of the Pipeline. Refer to *#/definitions/pipelineState*. Default: `None`.
- **`followers`**: Followers of this Pipeline. Refer to *../../type/entityReferenceList.json*.
- **`tags`** *(array)*: Tags for this Pipeline. Default: `None`.
  - **Items**: Refer to *../../type/tagLabel.json*.
- **`href`**: Link to the resource corresponding to this entity. Refer to *../../type/basic.json#/definitions/href*.
- **`owners`**: Owners of this pipeline. Refer to *../../type/entityReferenceList.json*.
- **`service`**: Link to service where this pipeline is hosted in. Refer to *../../type/entityReference.json*.
- **`serviceType`**: Service type where this pipeline is hosted in. Refer to *../services/pipelineService.json#/definitions/pipelineServiceType*.
- **`usageSummary`**: Latest usage information for this pipeline. Refer to *../../type/usageDetails.json*. Default: `None`.
- **`changeDescription`**: Change that lead to this version of the entity. Refer to *../../type/entityHistory.json#/definitions/changeDescription*.
- **`incrementalChangeDescription`**: Change that lead to this version of the entity. Refer to *../../type/entityHistory.json#/definitions/changeDescription*.
- **`deleted`** *(boolean)*: When `true` indicates the entity has been soft deleted. Default: `False`.
- **`extension`**: Entity extension data with custom attributes added to the entity. Refer to *../../type/basic.json#/definitions/entityExtension*.
- **`scheduleInterval`** *(string)*: Scheduler Interval for the pipeline in cron format. Default: `None`.
- **`domains`**: Domains the Pipeline belongs to. When not set, the pipeline inherits the domain from the Pipeline service it belongs to. Refer to *../../type/entityReferenceList.json*.
- **`votes`**: Votes on the entity. Refer to *../../type/votes.json*.
- **`lifeCycle`**: Life Cycle properties of the entity. Refer to *../../type/lifeCycle.json*.
- **`certification`**: Refer to *../../type/assetCertification.json*.
- **`sourceHash`** *(string)*: Source hash of the entity.
## Definitions

- **`statusType`** *(string)*: Enum defining the possible Status. Must be one of: `['Successful', 'Failed', 'Pending', 'Skipped']`.
- **`pipelineState`** *(string)*: Enum defining the possible Pipeline State. Must be one of: `['Active', 'Inactive']`.
- **`taskStatus`** *(object)*: This schema defines a time series of the status of a Pipeline or Task. Cannot contain additional properties.
  - **`name`** *(string)*: Name of the Task.
  - **`executionStatus`**: Status at a specific execution date. Refer to *#/definitions/statusType*.
  - **`startTime`**: Task start time. Refer to *../../type/basic.json#/definitions/timestamp*.
  - **`endTime`**: Task end time. Refer to *../../type/basic.json#/definitions/timestamp*.
  - **`logLink`** *(string)*: Task end time.
- **`task`** *(object)*: Cannot contain additional properties.
  - **`name`** *(string)*: Name that identifies this task instance uniquely.
  - **`displayName`** *(string)*: Display Name that identifies this Task. It could be title or label from the pipeline services.
  - **`fullyQualifiedName`** *(string)*: A unique name that identifies a pipeline in the format 'ServiceName.PipelineName.TaskName'.
  - **`description`**: Description of this Task. Refer to *../../type/basic.json#/definitions/markdown*.
  - **`sourceUrl`**: Task URL to visit/manage. This URL points to respective pipeline service UI. Refer to *../../type/basic.json#/definitions/sourceUrl*.
  - **`downstreamTasks`** *(array)*: All the tasks that are downstream of this task. Default: `None`.
    - **Items** *(string)*
  - **`taskType`** *(string)*: Type of the Task. Usually refers to the class it implements.
  - **`taskSQL`**: SQL used in the task. Can be used to determine the lineage. Refer to *../../type/basic.json#/definitions/sqlQuery*.
  - **`startDate`** *(string)*: start date for the task.
  - **`endDate`** *(string)*: end date for the task.
  - **`tags`** *(array)*: Tags for this task. Default: `[]`.
    - **Items**: Refer to *../../type/tagLabel.json*.
  - **`owners`**: Owners of this task. Refer to *../../type/entityReferenceList.json*.
- **`pipelineStatus`** *(object)*: Series of pipeline executions, its status and task status. Cannot contain additional properties.
  - **`timestamp`**: Timestamp where the job was executed. Refer to *../../type/basic.json#/definitions/timestamp*.
  - **`executionStatus`**: Status at a specific execution date. Refer to *#/definitions/statusType*.
  - **`taskStatus`** *(array)*: Series of task executions and its status. Default: `None`.
    - **Items**: Refer to *#/definitions/taskStatus*.


Documentation file automatically generated at 2025-08-08 15:20:07.536378+00:00.
