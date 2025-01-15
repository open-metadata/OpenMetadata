---
title: userApprovalTask
slug: /main-concepts/metadata-standard/schemas/governance/workflows/elements/nodes/usertask/userapprovaltask
---

# UserApprovalTaskDefinition

*Defines a Task for a given User to approve.*

## Properties

- **`type`** *(string)*: Default: `"userTask"`.
- **`subType`** *(string)*: Default: `"userApprovalTask"`.
- **`name`**: Name that identifies this Node. Refer to *[../../../../../type/basic.json#/definitions/entityName](#/../../../../type/basic.json#/definitions/entityName)*.
- **`displayName`** *(string)*: Display Name that identifies this Node.
- **`description`**: Description of the Node. Refer to *[../../../../../type/basic.json#/definitions/markdown](#/../../../../type/basic.json#/definitions/markdown)*.
- **`config`** *(object)*: Cannot contain additional properties.
  - **`assignees`** *(object, required)*: People/Teams assigned to the Task.
    - **`addReviewers`** *(boolean)*: Add the Reviewers to the assignees List. Default: `false`.
- **`input`** *(array)*: Length must be equal to 1. Default: `["relatedEntity"]`.
  - **Items** *(string)*
- **`output`** *(array)*: Length must be equal to 2. Default: `["result", "resolvedBy"]`.
  - **Items** *(string)*


Documentation file automatically generated at 2025-01-15 09:05:41.923720+00:00.
