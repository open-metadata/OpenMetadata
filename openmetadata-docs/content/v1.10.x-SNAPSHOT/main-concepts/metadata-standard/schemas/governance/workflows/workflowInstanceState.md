---
title: workflowInstanceState
slug: /main-concepts/metadata-standard/schemas/governance/workflows/workflowinstancestate
---

# WorkflowInstanceState

*Defines a workflow instance.*

## Properties

- **`id`**: Unique identifier of this workflow instance state. Refer to *../../type/basic.json#/definitions/uuid*.
- **`workflowInstanceId`**: Workflow Instance ID. Refer to *../../type/basic.json#/definitions/uuid*.
- **`workflowInstanceExecutionId`**: One WorkflowInstance might execute a flow multiple times. This ID groups together the States of one of those flows. Refer to *../../type/basic.json#/definitions/uuid*.
- **`workflowDefinitionId`**: Workflow Definition Reference. Refer to *../../type/basic.json#/definitions/uuid*.
- **`stage`** *(object)*: Cannot contain additional properties.
  - **`name`**: Refer to *../../type/basic.json#/definitions/entityName*.
  - **`displayName`** *(string)*: Display name of the workflow stage node.
  - **`startedAt`**: Timestamp on which the workflow instance stage started. Refer to *../../type/basic.json#/definitions/timestamp*.
  - **`endedAt`**: Timestamp on which the workflow instance stage ended. Refer to *../../type/basic.json#/definitions/timestamp*.
  - **`tasks`** *(array)*: Default: `[]`.
    - **Items**: Refer to *../../type/basic.json#/definitions/uuid*.
  - **`variables`** *(object)*
- **`timestamp`**: Timestamp on which the workflow instance state was created. Refer to *../../type/basic.json#/definitions/timestamp*.
- **`status`**: Refer to *workflowInstance.json#/definitions/workflowStatus*.
- **`exception`** *(string)*


Documentation file automatically generated at 2025-08-08 15:20:07.536378+00:00.
