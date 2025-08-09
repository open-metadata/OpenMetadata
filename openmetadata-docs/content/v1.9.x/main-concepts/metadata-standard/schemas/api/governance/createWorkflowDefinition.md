---
title: createWorkflowDefinition | Official Documentation
description: Connect Createworkflowdefinition to enable streamlined access, monitoring, or search of enterprise data using secure and scalable integrations.
slug: /main-concepts/metadata-standard/schemas/api/governance/createworkflowdefinition
---

# CreateWorkflowDefinitionRequest

*Create Workflow Definition entity request*

## Properties

- **`name`**: Name that identifies this Workflow Definition. Refer to *[../../type/basic.json#/definitions/entityName](#/../type/basic.json#/definitions/entityName)*.
- **`displayName`** *(string)*: Display Name that identifies this Workflow Definition.
- **`description`**: Description of the Workflow Definition. What it has and how to use it. Refer to *[../../type/basic.json#/definitions/markdown](#/../type/basic.json#/definitions/markdown)*.
- **`owners`**: Owners of this API Collection. Refer to *[../../type/entityReferenceList.json](#/../type/entityReferenceList.json)*. Default: `null`.
- **`type`**: Refer to *[../../governance/workflows/workflowDefinition.json#definitions/type](#/../governance/workflows/workflowDefinition.json#definitions/type)*.
- **`trigger`**
  - **One of**
    - : Refer to *[../../governance/workflows/elements/triggers/eventBasedEntityTrigger.json](#/../governance/workflows/elements/triggers/eventBasedEntityTrigger.json)*.
    - : Refer to *[../../governance/workflows/elements/triggers/periodicBatchEntityTrigger.json](#/../governance/workflows/elements/triggers/periodicBatchEntityTrigger.json)*.
- **`nodes`** *(array)*: List of processes used on the workflow.
  - **Items**
    - **One of**
      - : Refer to *[../../governance/workflows/elements/nodes/automatedTask/checkEntityAttributesTask.json](#/../governance/workflows/elements/nodes/automatedTask/checkEntityAttributesTask.json)*.
      - : Refer to *[../../governance/workflows/elements/nodes/automatedTask/setGlossaryTermStatusTask.json](#/../governance/workflows/elements/nodes/automatedTask/setGlossaryTermStatusTask.json)*.
      - : Refer to *[../../governance/workflows/elements/nodes/automatedTask/setEntityCertificationTask.json](#/../governance/workflows/elements/nodes/automatedTask/setEntityCertificationTask.json)*.
      - : Refer to *[../../governance/workflows/elements/nodes/endEvent/endEvent.json](#/../governance/workflows/elements/nodes/endEvent/endEvent.json)*.
      - : Refer to *[../../governance/workflows/elements/nodes/startEvent/startEvent.json](#/../governance/workflows/elements/nodes/startEvent/startEvent.json)*.
      - : Refer to *[../../governance/workflows/elements/nodes/userTask/userApprovalTask.json](#/../governance/workflows/elements/nodes/userTask/userApprovalTask.json)*.
- **`edges`** *(array)*: List of edges that connect the workflow elements and guide its flow.
  - **Items**: Refer to *[../../governance/workflows/elements/edge.json](#/../governance/workflows/elements/edge.json)*.


Documentation file automatically generated at 2025-01-15 09:05:41.923720+00:00.
