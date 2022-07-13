---
title: createRole
slug: /main-concepts/metadata-standard/schemas/schema/api/teams
---

# CreateRoleRequest

*Request for creating a Role entity*

## Properties

- **`name`**: Refer to *../../entity/teams/role.json#/definitions/roleName*.
- **`displayName`** *(string)*: Optional name used for display purposes. Example 'Data Consumer'.
- **`description`**: Optional description of the role. Refer to *../../type/basic.json#/definitions/markdown*.
- **`policies`**: Policies that is attached to this role. At least one policy is required. Refer to *../../type/entityReference.json#/definitions/entityReferenceList*.


Documentation file automatically generated at 2022-07-13 10:27:46.766157.
