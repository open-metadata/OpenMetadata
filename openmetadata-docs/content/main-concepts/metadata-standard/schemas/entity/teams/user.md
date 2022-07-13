---
title: user
slug: /main-concepts/metadata-standard/schemas/entity/teams/user
---

# User

*This schema defines the User entity. A user can be part of 0 or more teams. A special type of user called Bot is used for automation. A user can be an owner of zero or more data assets. A user can also follow zero or more data assets.*

## Properties

- **`id`**: Unique identifier that identifies a user entity instance. Refer to *../../type/basic.json#/definitions/uuid*.
- **`name`**: A unique name of the user, typically the user ID from an identity provider. Example - uid from LDAP. Refer to *../../type/basic.json#/definitions/entityName*.
- **`fullyQualifiedName`**: FullyQualifiedName same as `name`. Refer to *../../type/basic.json#/definitions/fullyQualifiedEntityName*.
- **`description`**: Used for user biography. Refer to *../../type/basic.json#/definitions/markdown*.
- **`displayName`** *(string)*: Name used for display purposes. Example 'FirstName LastName'.
- **`version`**: Metadata version of the entity. Refer to *../../type/entityHistory.json#/definitions/entityVersion*.
- **`updatedAt`**: Last update time corresponding to the new version of the entity in Unix epoch time milliseconds. Refer to *../../type/basic.json#/definitions/timestamp*.
- **`updatedBy`** *(string)*: User who made the update.
- **`email`**: Email address of the user. Refer to *../../type/basic.json#/definitions/email*.
- **`href`**: Link to the resource corresponding to this entity. Refer to *../../type/basic.json#/definitions/href*.
- **`timezone`** *(string)*: Timezone of the user.
- **`isBot`** *(boolean)*: When true indicates a special type of user called Bot.
- **`isAdmin`** *(boolean)*: When true indicates user is an administrator for the system with superuser privileges.
- **`authenticationMechanism`**: Refer to *#/definitions/authenticationMechanism*.
- **`profile`**: Profile of the user. Refer to *../../type/profile.json*.
- **`teams`**: Teams that the user belongs to. Refer to *../../type/entityReference.json#/definitions/entityReferenceList*.
- **`owns`**: List of entities owned by the user. Refer to *../../type/entityReference.json#/definitions/entityReferenceList*.
- **`follows`**: List of entities followed by the user. Refer to *../../type/entityReference.json#/definitions/entityReferenceList*.
- **`changeDescription`**: Change that lead to this version of the entity. Refer to *../../type/entityHistory.json#/definitions/changeDescription*.
- **`deleted`** *(boolean)*: When `true` indicates the entity has been soft deleted. Default: `False`.
- **`roles`**: Roles that the user has been assigned. Refer to *../../type/entityReference.json#/definitions/entityReferenceList*.
- **`inheritedRoles`**: Roles that a user is inheriting either as part of system default role or through membership in teams that have set team default roles. Refer to *../../type/entityReference.json#/definitions/entityReferenceList*.
## Definitions

- **`authenticationMechanism`** *(object)*: User/Bot Authentication Mechanism. Cannot contain additional properties.
  - **`config`**
  - **`authType`**: Must be one of: `['JWT', 'SSO']`.


Documentation file automatically generated at 2022-07-13 15:15:58.612083.
