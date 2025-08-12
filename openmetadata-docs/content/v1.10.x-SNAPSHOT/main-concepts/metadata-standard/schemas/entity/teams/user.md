---
title: user
slug: /main-concepts/metadata-standard/schemas/entity/teams/user
---

# User

*A `User` represents a user of OpenMetadata. A user can be part of 0 or more teams. A special type of user called Bot is used for automation. A user can be an owner of zero or more data assets. A user can also follow zero or more data assets.*

## Properties

- **`id`**: Unique identifier that identifies a user entity instance. Refer to *../../type/basic.json#/definitions/uuid*.
- **`name`**: A unique name of the user, typically the user ID from an identity provider. Example - uid from LDAP. Refer to *../../type/basic.json#/definitions/entityName*.
- **`fullyQualifiedName`**: FullyQualifiedName same as `name`. Refer to *../../type/basic.json#/definitions/fullyQualifiedEntityName*.
- **`description`**: Used for user biography. Refer to *../../type/basic.json#/definitions/markdown*.
- **`externalId`** *(string)*: External identifier from identity provider (used for SCIM).
- **`scimUserName`** *(string)*: Raw user name from SCIM.
- **`displayName`** *(string)*: Name used for display purposes. Example 'FirstName LastName'.
- **`version`**: Metadata version of the entity. Refer to *../../type/entityHistory.json#/definitions/entityVersion*.
- **`updatedAt`**: Last update time corresponding to the new version of the entity in Unix epoch time milliseconds. Refer to *../../type/basic.json#/definitions/timestamp*.
- **`updatedBy`** *(string)*: User who made the update.
- **`email`**: Email address of the user. Refer to *../../type/basic.json#/definitions/email*.
- **`href`**: Link to the resource corresponding to this entity. Refer to *../../type/basic.json#/definitions/href*.
- **`timezone`** *(string)*: Timezone of the user.
- **`isBot`** *(boolean)*: When true indicates a special type of user called Bot. Default: `False`.
- **`isAdmin`** *(boolean)*: When true indicates user is an administrator for the system with superuser privileges. Default: `False`.
- **`authenticationMechanism`**: Refer to *#/definitions/authenticationMechanism*.
- **`profile`**: Profile of the user. Refer to *../../type/profile.json*.
- **`teams`**: Teams that the user belongs to. Refer to *../../type/entityReferenceList.json*.
- **`defaultPersona`**: Default Persona for the user from list of personas. Refer to *../../type/entityReference.json*.
- **`personas`**: Personas that the user assigned to. Refer to *../../type/entityReferenceList.json*.
- **`owns`**: List of entities owned by the user. Refer to *../../type/entityReferenceList.json*.
- **`follows`**: List of entities followed by the user. Refer to *../../type/entityReferenceList.json*.
- **`changeDescription`**: Change that lead to this version of the entity. Refer to *../../type/entityHistory.json#/definitions/changeDescription*.
- **`incrementalChangeDescription`**: Change that lead to this version of the entity. Refer to *../../type/entityHistory.json#/definitions/changeDescription*.
- **`deleted`** *(boolean)*: When `true` indicates the entity has been soft deleted. Default: `False`.
- **`roles`**: Roles that the user has been assigned. Refer to *../../type/entityReferenceList.json*.
- **`inheritedRoles`**: Roles that a user is inheriting through membership in teams that have set team default roles. Refer to *../../type/entityReferenceList.json*.
- **`isEmailVerified`** *(boolean)*: If the User has verified the mail.
- **`domains`**: Domain the User belongs to. This is inherited by the team the user belongs to. Refer to *../../type/entityReferenceList.json*.
- **`lastLoginTime`**: Last time the user logged in. Refer to *../../type/basic.json#/definitions/timestamp*.
- **`lastActivityTime`**: Last time the user was active in the system. Refer to *../../type/basic.json#/definitions/timestamp*.
- **`personaPreferences`** *(array)*: User's personal preferences for each persona. Users can customize certain UI elements per persona while inheriting base persona configuration. Default: `[]`.
  - **Items**: Refer to *../../type/personaPreferences.json*.
## Definitions

- **`authenticationMechanism`** *(object)*: User/Bot Authentication Mechanism. Cannot contain additional properties.
  - **`config`**
  - **`authType`**: Must be one of: `['JWT', 'SSO', 'BASIC']`.


Documentation file automatically generated at 2025-08-12 05:39:47.683420+00:00.
