---
title: userApprovalTask
slug: /main-concepts/metadata-standard/schemas/governance/workflows/elements/nodes/usertask/userapprovaltask
---

# UserApprovalTaskDefinition

*Defines a Task for a given User to approve.*

## Properties

- **`type`** *(string)*: Default: `userTask`.
- **`subType`** *(string)*: Default: `userApprovalTask`.
- **`name`**: Name that identifies this Node. Refer to *../../../../../type/basic.json#/definitions/entityName*.
- **`displayName`** *(string)*: Display Name that identifies this Node.
- **`description`**: Description of the Node. Refer to *../../../../../type/basic.json#/definitions/markdown*.
- **`config`** *(object)*: Cannot contain additional properties.
  - **`assignees`** *(object)*: People/Teams assigned to the Task.
    - **`addReviewers`** *(boolean)*: Add the Reviewers to the assignees List. Default: `False`.
- **`input`** *(array)*: Default: `['relatedEntity']`.
  - **Items** *(string)*
- **`inputNamespaceMap`** *(object)*: Cannot contain additional properties.
  - **`relatedEntity`** *(string)*: Default: `global`.
- **`output`** *(array)*: Default: `['updatedBy']`.
  - **Items** *(string)*
- **`branches`** *(array)*: Default: `['true', 'false']`.
  - **Items** *(string)*


Documentation file automatically generated at 2025-08-08 15:20:07.536378+00:00.
