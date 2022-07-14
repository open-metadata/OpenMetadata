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
- **`pipelineUrl`** *(string)*: Pipeline URL suffix to visit/manage. This URL points to respective pipeline service UI.
- **`concurrency`** *(integer)*: Concurrency of the Pipeline.
- **`pipelineLocation`** *(string)*: Pipeline Code Location.
- **`startDate`**: Start date of the workflow. Refer to *../../type/basic.json#/definitions/dateTime*.
- **`tasks`** *(array)*: All the tasks that are part of pipeline. Default: `None`.
  - **Items**: Refer to *../../entity/data/pipeline.json#/definitions/task*.
- **`tags`** *(array)*: Tags for this Pipeline. Default: `None`.
  - **Items**: Refer to *../../type/tagLabel.json*.
- **`owner`**: Owner of this pipeline. Refer to *../../type/entityReference.json*.
- **`service`**: Link to the pipeline service where this pipeline is hosted in. Refer to *../../type/entityReference.json*.


Documentation file automatically generated at 2022-07-14 10:51:34.749986.
