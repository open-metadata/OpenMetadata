---
title: createUser
slug: /main-concepts/metadata-standard/schemas/api/teams/createuser
---

# CreateUserRequest

*Request to create User entity*

## Properties

- **`name`**: Refer to *../../entity/teams/user.json#/definitions/entityName*.
- **`description`**: Used for user biography. Refer to *../../type/basic.json#/definitions/markdown*.
- **`displayName`** *(string)*: Name used for display purposes. Example 'FirstName LastName'.
- **`email`**: Refer to *../../type/basic.json#/definitions/email*.
- **`timezone`** *(string)*: Timezone of the user.
- **`isBot`** *(boolean)*: When true indicates user is a bot with appropriate privileges.
- **`botName`** *(string)*: User bot name if we want to associate this bot with an specific bot.
- **`isAdmin`** *(boolean)*: When true indicates user is an administrator for the system with superuser privileges. Default: `False`.
- **`profile`**: Refer to *../../type/profile.json*. Default: `None`.
- **`teams`** *(array)*: Teams that the user belongs to. Default: `None`.
  - **Items**: Refer to *../../type/basic.json#/definitions/uuid*.
- **`roles`** *(array)*: Roles that the user has been assigned. Default: `None`.
  - **Items**: Refer to *../../type/basic.json#/definitions/uuid*.
- **`authenticationMechanism`**: Authentication mechanism specified . Refer to *../../entity/teams/user.json#/definitions/authenticationMechanism*. Default: `None`.
- **`createPasswordType`** *(string)*: User Password Method. Must be one of: `['ADMIN_CREATE', 'USER_CREATE']`. Default: `USER_CREATE`.
- **`password`** *(string)*: Password for User.
- **`confirmPassword`** *(string)*: Confirm Password for User.


Documentation file automatically generated at 2023-07-07 05:50:35.981927.
