---
title: Create Pipeline API | OpenMetadataPipeline API
description: Create a pipeline entity to represent data workflows, including tasks, sources, and lineage connections across platforms.
slug: /main-concepts/metadata-standard/schemas/api/data/createpipeline
---

# CreatePipelineRequest

*Create Pipeline entity request*

## Properties

- **`name`**: Name that identifies this pipeline instance uniquely. Refer to *[../../type/basic.json#/definitions/entityName](#/../type/basic.json#/definitions/entityName)*.
- **`displayName`** *(string)*: Display Name that identifies this Pipeline. It could be title or label from the source services.
- **`description`**: Description of the pipeline instance. What it has and how to use it. Refer to *[../../type/basic.json#/definitions/markdown](#/../type/basic.json#/definitions/markdown)*.
- **`dataProducts`** *(array)*: List of fully qualified names of data products this entity is part of.
  - **Items**: Refer to *[../../type/basic.json#/definitions/fullyQualifiedEntityName](#/../type/basic.json#/definitions/fullyQualifiedEntityName)*.
- **`sourceUrl`**: Pipeline URL suffix to visit/manage. This URL points to respective pipeline service UI. Refer to *[../../type/basic.json#/definitions/sourceUrl](#/../type/basic.json#/definitions/sourceUrl)*.
- **`concurrency`** *(integer)*: Concurrency of the Pipeline.
- **`pipelineLocation`** *(string)*: Pipeline Code Location.
- **`startDate`**: Start date of the workflow. Refer to *[../../type/basic.json#/definitions/dateTime](#/../type/basic.json#/definitions/dateTime)*.
- **`tasks`** *(array)*: All the tasks that are part of pipeline. Default: `null`.
  - **Items**: Refer to *[../../entity/data/pipeline.json#/definitions/task](#/../entity/data/pipeline.json#/definitions/task)*.
- **`tags`** *(array)*: Tags for this Pipeline. Default: `null`.
  - **Items**: Refer to *[../../type/tagLabel.json](#/../type/tagLabel.json)*.
- **`owners`**: Owners of this pipeline. Refer to *[../../type/entityReferenceList.json](#/../type/entityReferenceList.json)*. Default: `null`.
- **`service`**: Link to the pipeline service fqn where this pipeline is hosted in. Refer to *[../../type/basic.json#/definitions/fullyQualifiedEntityName](#/../type/basic.json#/definitions/fullyQualifiedEntityName)*.
- **`extension`**: Entity extension data with custom attributes added to the entity. Refer to *[../../type/basic.json#/definitions/entityExtension](#/../type/basic.json#/definitions/entityExtension)*.
- **`scheduleInterval`** *(string)*: Scheduler Interval for the pipeline in cron format. Default: `null`.
- **`domain`** *(string)*: Fully qualified name of the domain the Pipeline belongs to.
- **`lifeCycle`**: Life Cycle of the entity. Refer to *[../../type/lifeCycle.json](#/../type/lifeCycle.json)*.
- **`sourceHash`** *(string)*: Source hash of the entity.


Documentation file automatically generated at 2025-01-15 09:05:41.923720+00:00.
