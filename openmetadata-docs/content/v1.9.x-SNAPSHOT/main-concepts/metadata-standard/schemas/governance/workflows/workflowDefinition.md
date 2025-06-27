---
title: workflowDefinition
slug: /main-concepts/metadata-standard/schemas/governance/workflows/workflowdefinition
---

# WorkflowDefinition

*Defines a workflow, having all the different pieces and attributes.*

## Properties

- **`id`**: Unique identifier of this workflow definition. Refer to *[../../type/basic.json#/definitions/uuid](#/../type/basic.json#/definitions/uuid)*.
- **`name`**: Name that identifies this workflow definition. Refer to *[../../type/basic.json#/definitions/entityName](#/../type/basic.json#/definitions/entityName)*.
- **`displayName`** *(string)*: Display Name that identifies this workflow definition.
- **`fullyQualifiedName`**: FullyQualifiedName same as `name`. Refer to *[../../type/basic.json#/definitions/fullyQualifiedEntityName](#/../type/basic.json#/definitions/fullyQualifiedEntityName)*.
- **`description`**: Description of the workflow definition. Refer to *[../../type/basic.json#/definitions/markdown](#/../type/basic.json#/definitions/markdown)*.
- **`owners`**: Owners of this workflow definition. Refer to *[../../type/entityReferenceList.json](#/../type/entityReferenceList.json)*. Default: `null`.
- **`version`**: Metadata version of the entity. Refer to *[../../type/entityHistory.json#/definitions/entityVersion](#/../type/entityHistory.json#/definitions/entityVersion)*.
- **`updatedAt`**: Last update time corresponding to the new version of the entity in Unix epoch time milliseconds. Refer to *[../../type/basic.json#/definitions/timestamp](#/../type/basic.json#/definitions/timestamp)*.
- **`updatedBy`** *(string)*: User who made the update.
- **`href`**: Link to the resource corresponding to this entity. Refer to *[../../type/basic.json#/definitions/href](#/../type/basic.json#/definitions/href)*.
- **`changeDescription`**: Change that lead to this version of the entity. Refer to *[../../type/entityHistory.json#/definitions/changeDescription](#/../type/entityHistory.json#/definitions/changeDescription)*.
- **`deleted`** *(boolean)*: When `true` indicates the entity has been soft deleted. Default: `false`.
- **`type`**: Refer to *[#/definitions/type](#definitions/type)*.
- **`trigger`**: Workflow Trigger.
- **`nodes`**: List of nodes used on the workflow.
- **`edges`** *(array)*: List of edges that connect the workflow elements and guide its flow.
  - **Items**: Refer to *[./elements/edge.json](#elements/edge.json)*.
## Definitions

- **`type`** *(string)*: Must be one of: `["eventBasedEntityWorkflow", "periodicBatchEntityWorkflow"]`.


Documentation file automatically generated at 2025-01-15 09:05:41.923720+00:00.
