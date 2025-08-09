---
title: createAndRunIngestionPipelineTask
slug: /main-concepts/metadata-standard/schemas/governance/workflows/elements/nodes/automatedtask/createandruningestionpipelinetask
---

# CreateAndRunIngestionPipelineTask

*Creates and Runs an Ingestion Pipeline*

## Properties

- **`type`** *(string)*: Default: `automatedTask`.
- **`subType`** *(string)*: Default: `createAndRunIngestionPipelineTask`.
- **`name`**: Name that identifies this Node. Refer to *../../../../../type/basic.json#/definitions/entityName*.
- **`displayName`** *(string)*: Display Name that identifies this Node.
- **`description`**: Description of the Node. Refer to *../../../../../type/basic.json#/definitions/markdown*.
- **`config`**: Refer to *#/definitions/config*.
- **`input`** *(array)*: Default: `['relatedEntity']`.
  - **Items** *(string)*
- **`inputNamespaceMap`** *(object)*: Cannot contain additional properties.
  - **`relatedEntity`** *(string)*: Default: `global`.
- **`branches`** *(array)*: Default: `['success', 'failure']`.
  - **Items** *(string)*
## Definitions

- **`config`** *(object)*: Cannot contain additional properties.
  - **`pipelineType`**: Define which ingestion pipeline type should be created. Refer to *../../../../../entity/services/ingestionPipelines/ingestionPipeline.json#/definitions/pipelineType*.
  - **`shouldRun`** *(boolean)*: If True, it will be created and run. Otherwise it will just be created. Default: `True`.
  - **`waitForCompletion`** *(boolean)*: Set if this step should wait until the Ingestion Pipeline finishes running. Default: `True`.
  - **`timeoutSeconds`** *(integer)*: Set the amount of seconds to wait before defining the Ingestion Pipeline has timed out. Default: `3600`.


Documentation file automatically generated at 2025-08-08 15:20:07.536378+00:00.
