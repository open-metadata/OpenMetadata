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
- **`externalId`** *(string)*: External identifier from identity provider (used for SCIM).
- **`scimUserName`** *(string)*: Raw user name from SCIM.
- **`email`**: Refer to *../../type/basic.json#/definitions/email*.
- **`timezone`** *(string)*: Timezone of the user.
- **`isBot`** *(boolean)*: When true indicates user is a bot with appropriate privileges. Default: `False`.
- **`botName`** *(string)*: User bot name if we want to associate this bot with an specific bot.
- **`isAdmin`** *(boolean)*: When true indicates user is an administrator for the system with superuser privileges. Default: `False`.
- **`profile`**: Profile of the user. Refer to *../../type/profile.json*. Default: `None`.
- **`teams`** *(array)*: Teams that the user belongs to. Default: `None`.
  - **Items**: Refer to *../../type/basic.json#/definitions/uuid*.
- **`roles`** *(array)*: Roles that the user has been assigned. Default: `None`.
  - **Items**: Refer to *../../type/basic.json#/definitions/uuid*.
- **`personas`**: Persona that the user belongs to. Refer to *../../type/entityReferenceList.json*.
- **`defaultPersona`**: Default Persona from User's Personas. Refer to *../../type/entityReference.json*.
- **`authenticationMechanism`**: Authentication mechanism specified . Refer to *../../entity/teams/user.json#/definitions/authenticationMechanism*. Default: `None`.
- **`createPasswordType`** *(string)*: User Password Method. Must be one of: `['ADMIN_CREATE', 'USER_CREATE']`. Default: `USER_CREATE`.
- **`password`** *(string)*: Password for User.
- **`confirmPassword`** *(string)*: Confirm Password for User.
- **`domains`** *(array)*: Domains the User belongs to. Default: `None`.
  - **Items**: Refer to *../../type/basic.json#/definitions/entityName*.


Documentation file automatically generated at 2025-08-12 05:39:47.683420+00:00.
