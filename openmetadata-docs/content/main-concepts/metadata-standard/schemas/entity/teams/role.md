---
title: role
slug: /main-concepts/metadata-standard/schemas/entity/teams/role
---

# Role

*This schema defines the Role entity. A Role has access to zero or more data assets.*

## Properties

- **`id`**: Refer to *../../type/basic.json#/definitions/uuid*.
- **`name`**: Refer to *#/definitions/roleName*.
- **`fullyQualifiedName`**: FullyQualifiedName same as `name`. Refer to *../../type/basic.json#/definitions/fullyQualifiedEntityName*.
- **`displayName`** *(string)*: Name used for display purposes. Example 'Data Consumer'.
- **`description`**: Description of the role. Refer to *../../type/basic.json#/definitions/markdown*.
- **`version`**: Metadata version of the entity. Refer to *../../type/entityHistory.json#/definitions/entityVersion*.
- **`updatedAt`**: Last update time corresponding to the new version of the entity in Unix epoch time milliseconds. Refer to *../../type/basic.json#/definitions/timestamp*.
- **`updatedBy`** *(string)*: User who made the update.
- **`href`**: Link to the resource corresponding to this entity. Refer to *../../type/basic.json#/definitions/href*.
- **`changeDescription`**: Change that lead to this version of the entity. Refer to *../../type/entityHistory.json#/definitions/changeDescription*.
- **`deleted`** *(boolean)*: When `true` indicates the entity has been soft deleted. Default: `False`.
- **`policies`**: Policies that is attached to this role. Refer to *../../type/entityReference.json#/definitions/entityReferenceList*.
- **`defaultRole`** *(boolean)*: If `true`, this role is set as default system role and will be inherited by all the users. Default: `False`.
- **`users`**: Users that have this role assigned to them. Refer to *../../type/entityReference.json#/definitions/entityReferenceList*.
- **`teams`**: Teams that have this role assigned to them. Refer to *../../type/entityReference.json#/definitions/entityReferenceList*.
## Definitions

- **`roleName`**: A unique name for the role. Refer to *../../type/basic.json#/definitions/entityName*.


Documentation file automatically generated at 2022-07-13 15:15:58.612083.
