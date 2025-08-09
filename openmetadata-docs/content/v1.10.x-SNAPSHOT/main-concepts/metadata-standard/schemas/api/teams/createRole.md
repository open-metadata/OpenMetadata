---
title: createRole
slug: /main-concepts/metadata-standard/schemas/api/teams/createrole
---

# CreateRoleRequest

*Request for creating a Role entity*

## Properties

- **`name`**: Refer to *../../type/basic.json#/definitions/entityName*.
- **`displayName`** *(string)*: Optional name used for display purposes. Example 'Data Consumer'.
- **`description`**: Optional description of the role. Refer to *../../type/basic.json#/definitions/markdown*.
- **`policies`** *(array)*: Policies that is attached to this role. At least one policy is required.
  - **Items**: Refer to *../../type/basic.json#/definitions/entityName*.
- **`domains`** *(array)*: Fully qualified names of the domains the Role belongs to.
  - **Items** *(string)*


Documentation file automatically generated at 2025-08-08 15:20:07.536378+00:00.
