---
title: createWorkflow
slug: /main-concepts/metadata-standard/schemas/api/automations/createworkflow
---

# CreateWorkflowRequest

*A unit of work that will be triggered as an API call to the OpenMetadata server.*

## Properties

- **`name`**: Name of the workflow. Refer to *[../../type/basic.json#/definitions/entityName](#/../type/basic.json#/definitions/entityName)*.
- **`displayName`** *(string)*: Display Name that identifies this workflow definition.
- **`description`**: Description of the test connection def. Refer to *[../../type/basic.json#/definitions/markdown](#/../type/basic.json#/definitions/markdown)*.
- **`workflowType`**: Type of the workflow. Refer to *[../../entity/automations/workflow.json#/definitions/workflowType](#/../entity/automations/workflow.json#/definitions/workflowType)*.
- **`request`**: Request body for a specific workflow type.
  - **One of**
    - : Refer to *[../../entity/automations/testServiceConnection.json](#/../entity/automations/testServiceConnection.json)*.
- **`status`**: Workflow computation status. Refer to *[../../entity/automations/workflow.json#/definitions/workflowStatus](#/../entity/automations/workflow.json#/definitions/workflowStatus)*. Default: `"Pending"`.
- **`response`**: Response to the request.
  - **One of**
    - : Refer to *[../../entity/services/connections/testConnectionResult.json](#/../entity/services/connections/testConnectionResult.json)*.
- **`owner`**: Owner of this workflow. Refer to *[../../type/entityReference.json](#/../type/entityReference.json)*. Default: `null`.


Documentation file automatically generated at 2023-10-27 11:39:15.608628.
