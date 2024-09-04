---
title: createWorkflow
slug: /main-concepts/metadata-standard/schemas/api/automations/createworkflow
---

# CreateWorkflowRequest

*A unit of work that will be triggered as an API call to the OpenMetadata server.*

## Properties

- **`name`**: Name of the workflow. Refer to *../../type/basic.json#/definitions/entityName*.
- **`displayName`** *(string)*: Display Name that identifies this workflow definition.
- **`description`**: Description of the test connection def. Refer to *../../type/basic.json#/definitions/markdown*.
- **`workflowType`**: Type of the workflow. Refer to *../../entity/automations/workflow.json#/definitions/workflowType*.
- **`request`**: Request body for a specific workflow type.
- **`status`**: Workflow computation status. Refer to *../../entity/automations/workflow.json#/definitions/workflowStatus*. Default: `Pending`.
- **`response`**: Response to the request.
- **`owner`**: Owner of this workflow. Refer to *../../type/entityReference.json*. Default: `None`.


Documentation file automatically generated at 2023-10-27 13:55:46.343512.
