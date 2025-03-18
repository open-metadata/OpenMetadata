---
title: workflowInstance
slug: /main-concepts/metadata-standard/schemas/governance/workflows/workflowinstance
---

# WorkflowInstance

*Defines a workflow instance.*

## Properties

- **`id`**: Unique identifier of this workflow instance state. Refer to *[../../type/basic.json#/definitions/uuid](#/../type/basic.json#/definitions/uuid)*.
- **`workflowDefinitionId`**: Workflow Definition Id. Refer to *[../../type/basic.json#/definitions/uuid](#/../type/basic.json#/definitions/uuid)*.
- **`startedAt`**: Timestamp on which the workflow instance started. Refer to *[../../type/basic.json#/definitions/timestamp](#/../type/basic.json#/definitions/timestamp)*.
- **`endedAt`**: Timestamp on which the workflow instance ended. Refer to *[../../type/basic.json#/definitions/timestamp](#/../type/basic.json#/definitions/timestamp)*.
- **`variables`** *(object)*
- **`timestamp`**: Timestamp on which the workflow instance state was created. Refer to *[../../type/basic.json#/definitions/timestamp](#/../type/basic.json#/definitions/timestamp)*.
- **`exception`** *(boolean)*: If the Workflow Instance has errors, 'True'. Else, 'False'.


Documentation file automatically generated at 2025-01-15 09:05:41.923720+00:00.
