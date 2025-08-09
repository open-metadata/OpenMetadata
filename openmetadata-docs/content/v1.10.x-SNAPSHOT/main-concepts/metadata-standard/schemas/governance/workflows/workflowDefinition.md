---
title: workflowDefinition
slug: /main-concepts/metadata-standard/schemas/governance/workflows/workflowdefinition
---

# WorkflowDefinition

*Defines a workflow, having all the different pieces and attributes.*

## Properties

- **`id`**: Unique identifier of this workflow definition. Refer to *../../type/basic.json#/definitions/uuid*.
- **`name`**: Name that identifies this workflow definition. Refer to *../../type/basic.json#/definitions/entityName*.
- **`displayName`** *(string)*: Display Name that identifies this workflow definition.
- **`fullyQualifiedName`**: FullyQualifiedName same as `name`. Refer to *../../type/basic.json#/definitions/fullyQualifiedEntityName*.
- **`description`**: Description of the workflow definition. Refer to *../../type/basic.json#/definitions/markdown*.
- **`owners`**: Owners of this workflow definition. Refer to *../../type/entityReferenceList.json*. Default: `None`.
- **`version`**: Metadata version of the entity. Refer to *../../type/entityHistory.json#/definitions/entityVersion*.
- **`updatedAt`**: Last update time corresponding to the new version of the entity in Unix epoch time milliseconds. Refer to *../../type/basic.json#/definitions/timestamp*.
- **`updatedBy`** *(string)*: User who made the update.
- **`href`**: Link to the resource corresponding to this entity. Refer to *../../type/basic.json#/definitions/href*.
- **`changeDescription`**: Change that lead to this version of the entity. Refer to *../../type/entityHistory.json#/definitions/changeDescription*.
- **`incrementalChangeDescription`**: Change that lead to this version of the entity. Refer to *../../type/entityHistory.json#/definitions/changeDescription*.
- **`deleted`** *(boolean)*: When `true` indicates the entity has been soft deleted. Default: `False`.
- **`deployed`** *(boolean)*: When `true` indicates the workflow is deployed.
- **`config`**: Refer to *#/definitions/workflowConfiguration*.
- **`trigger`**: Workflow Trigger.
  - **`type`**: Refer to *#/definitions/type*.
- **`nodes`** *(array)*: List of nodes used on the workflow.
  - **Items** *(object)*
- **`edges`** *(array)*: List of edges that connect the workflow elements and guide its flow.
  - **Items**: Refer to *./elements/edge.json*.
## Definitions

- **`type`** *(string)*: Must be one of: `['eventBasedEntity', 'noOp', 'periodicBatchEntity']`.
- **`workflowConfiguration`** *(object)*: Cannot contain additional properties.
  - **`storeStageStatus`** *(boolean)*: If True, all the stage status will be stored in the database. Default: `False`.


Documentation file automatically generated at 2025-08-08 15:20:07.536378+00:00.
