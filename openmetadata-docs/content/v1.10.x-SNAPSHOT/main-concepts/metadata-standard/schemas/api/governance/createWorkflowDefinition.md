---
title: createWorkflowDefinition
slug: /main-concepts/metadata-standard/schemas/api/governance/createworkflowdefinition
---

# CreateWorkflowDefinitionRequest

*Create Workflow Definition entity request*

## Properties

- **`name`**: Name that identifies this Workflow Definition. Refer to *../../type/basic.json#/definitions/entityName*.
- **`displayName`** *(string)*: Display Name that identifies this Workflow Definition.
- **`description`**: Description of the Workflow Definition. What it has and how to use it. Refer to *../../type/basic.json#/definitions/markdown*.
- **`owners`**: Owners of this API Collection. Refer to *../../type/entityReferenceList.json*. Default: `None`.
- **`type`**: Refer to *../../governance/workflows/workflowDefinition.json#/definitions/type*.
- **`trigger`**
- **`nodes`** *(array)*: List of processes used on the workflow.
  - **Items**
- **`edges`** *(array)*: List of edges that connect the workflow elements and guide its flow.
  - **Items**: Refer to *../../governance/workflows/elements/edge.json*.


Documentation file automatically generated at 2025-08-12 05:39:47.683420+00:00.
