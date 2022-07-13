---
title: team
slug: /main-concepts/metadata-standard/schemas/schema/entity/teams
---

# Team

*This schema defines the Team entity. A Team is a group of zero or more users. Teams can own zero or more data assets.*

## Properties

- **`id`**: Refer to *../../type/basic.json#/definitions/uuid*.
- **`name`**: A unique name of the team typically the team ID from an identity provider. Example - group Id from LDAP. Refer to *../../type/basic.json#/definitions/entityName*.
- **`fullyQualifiedName`**: FullyQualifiedName same as `name`. Refer to *../../type/basic.json#/definitions/fullyQualifiedEntityName*.
- **`displayName`** *(string)*: Name used for display purposes. Example 'Data Science team'.
- **`description`**: Description of the team. Refer to *../../type/basic.json#/definitions/markdown*.
- **`version`**: Metadata version of the entity. Refer to *../../type/entityHistory.json#/definitions/entityVersion*.
- **`updatedAt`**: Last update time corresponding to the new version of the entity in Unix epoch time milliseconds. Refer to *../../type/basic.json#/definitions/timestamp*.
- **`updatedBy`** *(string)*: User who made the update.
- **`href`**: Link to the resource corresponding to this entity. Refer to *../../type/basic.json#/definitions/href*.
- **`profile`**: Team profile information. Refer to *../../type/profile.json*.
- **`users`**: Users that are part of the team. Refer to *../../type/entityReference.json#/definitions/entityReferenceList*. Default: `None`.
- **`owns`**: List of entities owned by the team. Refer to *../../type/entityReference.json#/definitions/entityReferenceList*.
- **`owner`**: Owner of this team. . Refer to *../../type/entityReference.json*. Default: `None`.
- **`isJoinable`** *(boolean)*: Can any user join this team during sign up? Value of true indicates yes, and false no. Default: `True`.
- **`changeDescription`**: Change that lead to this version of the entity. Refer to *../../type/entityHistory.json#/definitions/changeDescription*.
- **`deleted`** *(boolean)*: When `true` indicates the entity has been soft deleted. Default: `False`.
- **`defaultRoles`**: Default roles of a team. These roles will be inherited by all the users that are part of this team. Refer to *../../type/entityReference.json#/definitions/entityReferenceList*.


Documentation file automatically generated at 2022-07-13 10:27:46.766157.
