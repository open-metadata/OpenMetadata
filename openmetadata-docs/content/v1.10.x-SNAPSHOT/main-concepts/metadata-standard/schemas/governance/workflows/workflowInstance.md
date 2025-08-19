---
title: workflowInstance
slug: /main-concepts/metadata-standard/schemas/governance/workflows/workflowinstance
---

# WorkflowInstance

*Defines a workflow instance.*

## Properties

- **`id`**: Unique identifier of this workflow instance state. Refer to *../../type/basic.json#/definitions/uuid*.
- **`workflowDefinitionId`**: Workflow Definition Id. Refer to *../../type/basic.json#/definitions/uuid*.
- **`startedAt`**: Timestamp on which the workflow instance started. Refer to *../../type/basic.json#/definitions/timestamp*.
- **`endedAt`**: Timestamp on which the workflow instance ended. Refer to *../../type/basic.json#/definitions/timestamp*.
- **`variables`** *(object)*
- **`timestamp`**: Timestamp on which the workflow instance state was created. Refer to *../../type/basic.json#/definitions/timestamp*.
- **`status`**: Refer to *#/definitions/workflowStatus*.
- **`exception`** *(string)*
## Definitions

- **`workflowStatus`** *(string)*: Must be one of: `['RUNNING', 'FINISHED', 'FAILURE', 'EXCEPTION']`.


Documentation file automatically generated at 2025-08-12 05:39:47.683420+00:00.
