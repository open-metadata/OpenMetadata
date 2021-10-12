# Task

This schema defines the Task entity. A task is a unit of computation in a Pipeline.

**id: https://open-metadata.org/schema/entity/data/task.json**

Type: `object`

## Properties
 - **id** `required`
   - Unique identifier that identifies a task instance.
   - $ref: [../../type/basic.json#/definitions/uuid](../types/basic.md#uuid)
 - **name** `required`
   - Name that identifies this task instance uniquely.
   - Type: `string`
   - Length: between 1 and 64
 - **displayName**
   - Display Name that identifies this Task. It could be title or label from the pipeline services.
   - Type: `string`
 - **fullyQualifiedName**
   - A unique name that identifies a pipeline in the format 'ServiceName.PipelineName.TaskName'.
   - Type: `string`
   - Length: between 1 and 64
 - **description**
   - Description of this Task.
   - Type: `string`
 - **taskUrl**
   - Task URL to visit/manage. This URL points to respective pipeline service UI.
   - Type: `string`
   - String format must be a "uri"
 - **downstreamTasks**
   - All the tasks that are downstream of this task.
   - Type: `array`
     - **Items**
     - Type: `string`
     - Length: between 1 and 64
 - **taskType**
   - Type of the Task. Usually refers to the class it implements.
   - Type: `string`
 - **taskSQL**
   - SQL used in the task. Can be used to determine the lineage.
   - Type: `string`
 - **startDate**
   - Start date of the task.
   - $ref: [../../type/basic.json#/definitions/dateTime](../types/basic.md#datetime)
 - **endDate**
   - End date of the task.
   - $ref: [../../type/basic.json#/definitions/dateTime](../types/basic.md#datetime)
 - **tags**
   - Tags for this Pipeline.
   - Type: `array`
     - **Items**
     - $ref: [../../type/tagLabel.json](../types/taglabel.md)
 - **href**
   - Link to the resource corresponding to this entity.
   - $ref: [../../type/basic.json#/definitions/href](../types/basic.md#href)
 - **owner**
   - Owner of this pipeline.
   - $ref: [../../type/entityReference.json](../types/entityreference.md)
 - **service** `required`
   - Link to service where this pipeline is hosted in.
   - $ref: [../../type/entityReference.json](../types/entityreference.md)


_This document was updated on: Tuesday, October 12, 2021_