---
title: createPipeline
slug: /main-concepts/metadata-standard/schemas/api/data/createpipeline
---

# CreatePipelineRequest

*Create Pipeline entity request*

## Properties

- **`name`**: Name that identifies this pipeline instance uniquely. Refer to *../../type/basic.json#/definitions/entityName*.
- **`displayName`** *(string)*: Display Name that identifies this Pipeline. It could be title or label from the source services.
- **`description`**: Description of the pipeline instance. What it has and how to use it. Refer to *../../type/basic.json#/definitions/markdown*.
- **`dataProducts`** *(array)*: List of fully qualified names of data products this entity is part of.
  - **Items**: Refer to *../../type/basic.json#/definitions/fullyQualifiedEntityName*.
- **`sourceUrl`**: Pipeline URL suffix to visit/manage. This URL points to respective pipeline service UI. Refer to *../../type/basic.json#/definitions/sourceUrl*.
- **`concurrency`** *(integer)*: Concurrency of the Pipeline.
- **`pipelineLocation`** *(string)*: Pipeline Code Location.
- **`startDate`**: Start date of the workflow. Refer to *../../type/basic.json#/definitions/dateTime*.
- **`tasks`** *(array)*: All the tasks that are part of pipeline. Default: `None`.
  - **Items**: Refer to *../../entity/data/pipeline.json#/definitions/task*.
- **`state`**: State of the pipeline. Refer to *../../entity/data/pipeline.json#/definitions/pipelineState*. Default: `None`.
- **`tags`** *(array)*: Tags for this Pipeline. Default: `None`.
  - **Items**: Refer to *../../type/tagLabel.json*.
- **`owners`**: Owners of this pipeline. Refer to *../../type/entityReferenceList.json*. Default: `None`.
- **`service`**: Link to the pipeline service fqn where this pipeline is hosted in. Refer to *../../type/basic.json#/definitions/fullyQualifiedEntityName*.
- **`extension`**: Entity extension data with custom attributes added to the entity. Refer to *../../type/basic.json#/definitions/entityExtension*.
- **`scheduleInterval`** *(string)*: Scheduler Interval for the pipeline in cron format. Default: `None`.
- **`domains`** *(array)*: Fully qualified names of the domains the Pipeline belongs to.
  - **Items** *(string)*
- **`lifeCycle`**: Life Cycle of the entity. Refer to *../../type/lifeCycle.json*.
- **`sourceHash`** *(string)*: Source hash of the entity.


Documentation file automatically generated at 2025-08-08 15:20:07.536378+00:00.
