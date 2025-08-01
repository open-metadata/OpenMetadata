---
title: Create User API | OpenMetadata API for User Management
description: Connect Createuser to enable streamlined access, monitoring, or search of enterprise data using secure and scalable integrations.
slug: /main-concepts/metadata-standard/schemas/api/teams/createuser
---

# CreateUserRequest

*Request to create User entity*

## Properties

- **`name`**: Refer to *[../../type/basic.json#/definitions/entityName](#/../type/basic.json#/definitions/entityName)*.
- **`description`**: Used for user biography. Refer to *[../../type/basic.json#/definitions/markdown](#/../type/basic.json#/definitions/markdown)*.
- **`displayName`** *(string)*: Name used for display purposes. Example 'FirstName LastName'.
- **`email`**: Refer to *[../../type/basic.json#/definitions/email](#/../type/basic.json#/definitions/email)*.
- **`timezone`** *(string, format: timezone)*: Timezone of the user.
- **`isBot`** *(boolean)*: When true indicates user is a bot with appropriate privileges. Default: `false`.
- **`botName`** *(string)*: User bot name if we want to associate this bot with an specific bot.
- **`isAdmin`** *(boolean)*: When true indicates user is an administrator for the system with superuser privileges. Default: `false`.
- **`profile`**: Profile of the user. Refer to *[../../type/profile.json](#/../type/profile.json)*. Default: `null`.
- **`teams`** *(array)*: Teams that the user belongs to. Default: `null`.
  - **Items**: Refer to *[../../type/basic.json#/definitions/uuid](#/../type/basic.json#/definitions/uuid)*.
- **`roles`** *(array)*: Roles that the user has been assigned. Default: `null`.
  - **Items**: Refer to *[../../type/basic.json#/definitions/uuid](#/../type/basic.json#/definitions/uuid)*.
- **`personas`**: Persona that the user belongs to. Refer to *[../../type/entityReferenceList.json](#/../type/entityReferenceList.json)*.
- **`defaultPersona`**: Default Persona from User's Personas. Refer to *[../../type/entityReference.json](#/../type/entityReference.json)*.
- **`authenticationMechanism`**: Authentication mechanism specified . Refer to *[../../entity/teams/user.json#/definitions/authenticationMechanism](#/../entity/teams/user.json#/definitions/authenticationMechanism)*. Default: `null`.
- **`createPasswordType`** *(string)*: User Password Method. Must be one of: `["ADMIN_CREATE", "USER_CREATE"]`. Default: `"USER_CREATE"`.
- **`password`** *(string)*: Password for User.
- **`confirmPassword`** *(string)*: Confirm Password for User.
- **`domains`** *(array)*: Domains the User belongs to. Default: `null`.
  - **Items**: Refer to *[../../type/basic.json#/definitions/entityName](#/../type/basic.json#/definitions/entityName)*.


Documentation file automatically generated at 2025-01-15 09:05:41.923720+00:00.
