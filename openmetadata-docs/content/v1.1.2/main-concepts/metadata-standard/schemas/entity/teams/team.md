---
title: team
slug: /main-concepts/metadata-standard/schemas/entity/teams/team
---

# Team

*This schema defines the Team entity. A `Team` is a group of zero or more users and/or other teams. Teams can own zero or more data assets. Hierarchical teams are supported `Organization` -> `BusinessUnit` -> `Division` -> `Department`.*

## Properties

- **`id`**: Refer to *../../type/basic.json#/definitions/uuid*.
- **`teamType`**: Team type. Refer to *#/definitions/teamType*.
- **`name`**: A unique name of the team typically the team ID from an identity provider. Example - group Id from LDAP. Refer to *../../type/basic.json#/definitions/entityName*.
- **`email`**: Email address of the team. Refer to *../../type/basic.json#/definitions/email*.
- **`fullyQualifiedName`**: FullyQualifiedName same as `name`. Refer to *../../type/basic.json#/definitions/fullyQualifiedEntityName*.
- **`displayName`** *(string)*: Name used for display purposes. Example 'Data Science team'.
- **`description`**: Description of the team. Refer to *../../type/basic.json#/definitions/markdown*.
- **`version`**: Metadata version of the entity. Refer to *../../type/entityHistory.json#/definitions/entityVersion*.
- **`updatedAt`**: Last update time corresponding to the new version of the entity in Unix epoch time milliseconds. Refer to *../../type/basic.json#/definitions/timestamp*.
- **`updatedBy`** *(string)*: User who made the update.
- **`href`**: Link to the resource corresponding to this entity. Refer to *../../type/basic.json#/definitions/href*.
- **`profile`**: Team profile information. Refer to *../../type/profile.json*.
- **`parents`**: Parent teams. For an `Organization` the `parent` is always null. A `BusinessUnit` always has only one parent of type `BusinessUnit` or an `Organization`. A `Division` can have multiple parents of type `BusinessUnit` or `Division`. A `Department` can have multiple parents of type `Division` or `Department`. Refer to *../../type/entityReferenceList.json#/definitions/entityReferenceList*.
- **`children`**: Children teams. An `Organization` can have `BusinessUnit`, `Division` or `Department` as children. A `BusinessUnit` can have `BusinessUnit`, `Division`, or `Department` as children. A `Division` can have `Division` or `Department` as children. A `Department` can have can have `Department` as children. Refer to *../../type/entityReferenceList.json#/definitions/entityReferenceList*.
- **`users`**: Users that are part of the team. Refer to *../../type/entityReferenceList.json#/definitions/entityReferenceList*. Default: `None`.
- **`childrenCount`** *(integer)*: Total count of Children teams.
- **`userCount`** *(integer)*: Total count of users that are part of the team.
- **`owns`**: List of entities owned by the team. Refer to *../../type/entityReferenceList.json#/definitions/entityReferenceList*.
- **`owner`**: Owner of this team. . Refer to *../../type/entityReference.json*. Default: `None`.
- **`isJoinable`** *(boolean)*: Can any user join this team during sign up? Value of true indicates yes, and false no. Default: `True`.
- **`changeDescription`**: Change that lead to this version of the entity. Refer to *../../type/entityHistory.json#/definitions/changeDescription*.
- **`deleted`** *(boolean)*: When `true` indicates the entity has been soft deleted. Default: `False`.
- **`defaultRoles`**: Default roles of a team. These roles will be inherited by all the users that are part of this team. Refer to *../../type/entityReferenceList.json#/definitions/entityReferenceList*.
- **`inheritedRoles`**: Roles that a team is inheriting through membership in teams that have set team default roles. Refer to *../../type/entityReferenceList.json#/definitions/entityReferenceList*.
- **`policies`**: Policies that is attached to this team. Refer to *../../type/entityReferenceList.json#/definitions/entityReferenceList*.
- **`domain`**: Domain the Team belongs to. Refer to *../../type/entityReference.json*.
## Definitions

- **`teamType`** *(string)*: Organization is the highest level entity. An Organization has one of more Business Units, Division, Departments, Group, or Users. A Business Unit has one or more Divisions, Departments, Group, or Users. A Division has one or more Divisions, Departments, Group, or Users. A Department has one or more Departments, Group, or Users. A Group has a only Users. Must be one of: `['Group', 'Department', 'Division', 'BusinessUnit', 'Organization']`. Default: `Group`.


Documentation file automatically generated at 2023-07-07 05:50:35.981927.
