---
title: workflowInstanceState
slug: /main-concepts/metadata-standard/schemas/governance/workflows/workflowinstancestate
---

# WorkflowInstanceState

*Defines a workflow instance.*

## Properties

- **`id`**: Unique identifier of this workflow instance state. Refer to *[../../type/basic.json#/definitions/uuid](#/../type/basic.json#/definitions/uuid)*.
- **`workflowInstanceId`**: Workflow Instance ID. Refer to *[../../type/basic.json#/definitions/uuid](#/../type/basic.json#/definitions/uuid)*.
- **`workflowInstanceExecutionId`**: One WorkflowInstance might execute a flow multiple times. This ID groups together the States of one of those flows. Refer to *[../../type/basic.json#/definitions/uuid](#/../type/basic.json#/definitions/uuid)*.
- **`workflowDefinitionId`**: Workflow Definition Reference. Refer to *[../../type/basic.json#/definitions/uuid](#/../type/basic.json#/definitions/uuid)*.
- **`stage`** *(object)*: Cannot contain additional properties.
  - **`name`**: Refer to *[../../type/basic.json#/definitions/entityName](#/../type/basic.json#/definitions/entityName)*.
  - **`startedAt`**: Timestamp on which the workflow instance stage started. Refer to *[../../type/basic.json#/definitions/timestamp](#/../type/basic.json#/definitions/timestamp)*.
  - **`endedAt`**: Timestamp on which the workflow instance stage ended. Refer to *[../../type/basic.json#/definitions/timestamp](#/../type/basic.json#/definitions/timestamp)*.
  - **`tasks`** *(array)*: Default: `[]`.
    - **Items**: Refer to *[../../type/basic.json#/definitions/uuid](#/../type/basic.json#/definitions/uuid)*.
  - **`variables`** *(object)*
- **`timestamp`**: Timestamp on which the workflow instance state was created. Refer to *[../../type/basic.json#/definitions/timestamp](#/../type/basic.json#/definitions/timestamp)*.
- **`exception`** *(boolean)*: If the Workflow Instance has errors, 'True'. Else, 'False'.


Documentation file automatically generated at 2025-01-15 09:05:41.923720+00:00.
