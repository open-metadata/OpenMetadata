---
title: createRole
slug: /main-concepts/metadata-standard/schemas/api/teams/createrole
---

# CreateRoleRequest

*Request for creating a Role entity*

## Properties

- **`name`**: Refer to *[../../entity/teams/role.json#/definitions/roleName](#/../entity/teams/role.json#/definitions/roleName)*.
- **`displayName`** *(string)*: Optional name used for display purposes. Example 'Data Consumer'.
- **`description`**: Optional description of the role. Refer to *[../../type/basic.json#/definitions/markdown](#/../type/basic.json#/definitions/markdown)*.
- **`policies`** *(array)*: Policies that is attached to this role. At least one policy is required.
  - **Items**: Refer to *[../../type/basic.json#/definitions/entityName](#/../type/basic.json#/definitions/entityName)*.


Documentation file automatically generated at 2023-10-27 11:39:15.608628.
