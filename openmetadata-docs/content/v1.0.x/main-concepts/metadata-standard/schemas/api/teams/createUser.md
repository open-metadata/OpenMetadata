---
title: createUser
slug: /main-concepts/metadata-standard/schemas/api/teams/createuser
---

# CreateUserRequest

*Request to create User entity*

## Properties

- **`name`**: Refer to *../../type/basic.json#/definitions/entityName*.
- **`description`**: Used for user biography. Refer to *../../type/basic.json#/definitions/markdown*.
- **`displayName`** *(string)*: Name used for display purposes. Example 'FirstName LastName'.
- **`email`**: Refer to *../../type/basic.json#/definitions/email*.
- **`timezone`** *(string)*: Timezone of the user.
- **`isBot`** *(boolean)*: When true indicates user is a bot with appropriate privileges.
- **`isAdmin`** *(boolean)*: When true indicates user is an administrator for the system with superuser privileges. Default: `False`.
- **`profile`**: Refer to *../../type/profile.json*. Default: `None`.
- **`teams`** *(array)*: Teams that the user belongs to. Default: `None`.
  - **Items**: Refer to *../../type/basic.json#/definitions/uuid*.
- **`roles`** *(array)*: Roles that the user has been assigned. Default: `None`.
  - **Items**: Refer to *../../type/basic.json#/definitions/uuid*.


Documentation file automatically generated at 2022-07-14 10:51:34.749986.
