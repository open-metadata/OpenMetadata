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
- **`version`**: Metadata version of the entity. Refer to *../../type/entityHistory.json#/definitions/entityVersion*.
- **`updatedAt`**: Last update time corresponding to the new version of the entity in Unix epoch time milliseconds. Refer to *../../type/basic.json#/definitions/timestamp*.
- **`updatedBy`** *(string)*: User who made the update.
- **`pipelineUrl`** *(string)*: Pipeline  URL to visit/manage. This URL points to respective pipeline service UI.
- **`concurrency`** *(integer)*: Concurrency of the Pipeline.
- **`pipelineLocation`** *(string)*: Pipeline Code Location.
- **`startDate`**: Start date of the workflow. Refer to *../../type/basic.json#/definitions/dateTime*.
- **`tasks`** *(array)*: All the tasks that are part of pipeline. Default: `None`.
  - **Items**: Refer to *#/definitions/task*.
- **`pipelineStatus`** *(array)*: Series of pipeline executions and its status. Default: `None`.
  - **Items**: Refer to *#/definitions/pipelineStatus*.
- **`followers`**: Followers of this Pipeline. Refer to *../../type/entityReference.json#/definitions/entityReferenceList*.
- **`tags`** *(array)*: Tags for this Pipeline. Default: `None`.
  - **Items**: Refer to *../../type/tagLabel.json*.
- **`href`**: Link to the resource corresponding to this entity. Refer to *../../type/basic.json#/definitions/href*.
- **`owner`**: Owner of this pipeline. Refer to *../../type/entityReference.json*.
- **`service`**: Link to service where this pipeline is hosted in. Refer to *../../type/entityReference.json*.
- **`serviceType`**: Service type where this pipeline is hosted in. Refer to *../services/pipelineService.json#/definitions/pipelineServiceType*.
- **`changeDescription`**: Change that lead to this version of the entity. Refer to *../../type/entityHistory.json#/definitions/changeDescription*.
- **`deleted`** *(boolean)*: When `true` indicates the entity has been soft deleted. Default: `False`.
## Definitions

- **`statusType`** *(string)*: Enum defining the possible Status. Must be one of: `['Successful', 'Failed', 'Pending']`.
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
  - **`taskUrl`** *(string)*: Task URL to visit/manage. This URL points to respective pipeline service UI.
  - **`downstreamTasks`** *(array)*: All the tasks that are downstream of this task. Default: `None`.
    - **Items** *(string)*
  - **`taskType`** *(string)*: Type of the Task. Usually refers to the class it implements.
  - **`taskSQL`**: SQL used in the task. Can be used to determine the lineage. Refer to *../../type/basic.json#/definitions/sqlQuery*.
  - **`startDate`** *(string)*: start date for the task.
  - **`endDate`** *(string)*: end date for the task.
  - **`tags`** *(array)*: Tags for this task. Default: `None`.
    - **Items**: Refer to *../../type/tagLabel.json*.
- **`pipelineStatus`** *(object)*: Series of pipeline executions, its status and task status. Cannot contain additional properties.
  - **`executionDate`**: Date where the job was executed. Refer to *../../type/basic.json#/definitions/timestamp*.
  - **`executionStatus`**: Status at a specific execution date. Refer to *#/definitions/statusType*.
  - **`taskStatus`** *(array)*: Series of task executions and its status. Default: `None`.
    - **Items**: Refer to *#/definitions/taskStatus*.


Documentation file automatically generated at 2022-07-13 15:15:58.612083.
