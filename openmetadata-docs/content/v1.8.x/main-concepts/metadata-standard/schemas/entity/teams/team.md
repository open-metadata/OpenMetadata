---
title: Team | OpenMetadata Team API and Management
slug: /main-concepts/metadata-standard/schemas/entity/teams/team
---

# Team

*This schema defines the Team entity. A `Team` is a group of zero or more users and/or other teams. Teams can own zero or more data assets. Hierarchical teams are supported `Organization` -> `BusinessUnit` -> `Division` -> `Department`.*

## Properties

- **`id`**: Refer to *[../../type/basic.json#/definitions/uuid](#/../type/basic.json#/definitions/uuid)*.
- **`teamType`**: Team type. Refer to *[#/definitions/teamType](#definitions/teamType)*.
- **`name`**: A unique name of the team typically the team ID from an identity provider. Example - group Id from LDAP. Refer to *[../../type/basic.json#/definitions/entityName](#/../type/basic.json#/definitions/entityName)*.
- **`email`**: Email address of the team. Refer to *[../../type/basic.json#/definitions/email](#/../type/basic.json#/definitions/email)*.
- **`fullyQualifiedName`**: FullyQualifiedName same as `name`. Refer to *[../../type/basic.json#/definitions/fullyQualifiedEntityName](#/../type/basic.json#/definitions/fullyQualifiedEntityName)*.
- **`displayName`** *(string)*: Name used for display purposes. Example 'Data Science team'.
- **`description`**: Description of the team. Refer to *[../../type/basic.json#/definitions/markdown](#/../type/basic.json#/definitions/markdown)*.
- **`version`**: Metadata version of the entity. Refer to *[../../type/entityHistory.json#/definitions/entityVersion](#/../type/entityHistory.json#/definitions/entityVersion)*.
- **`updatedAt`**: Last update time corresponding to the new version of the entity in Unix epoch time milliseconds. Refer to *[../../type/basic.json#/definitions/timestamp](#/../type/basic.json#/definitions/timestamp)*.
- **`updatedBy`** *(string)*: User who made the update.
- **`href`**: Link to the resource corresponding to this entity. Refer to *[../../type/basic.json#/definitions/href](#/../type/basic.json#/definitions/href)*.
- **`profile`**: Team profile information. Refer to *[../../type/profile.json](#/../type/profile.json)*.
- **`parents`**: Parent teams. For an `Organization` the `parent` is always null. A `BusinessUnit` always has only one parent of type `BusinessUnit` or an `Organization`. A `Division` can have multiple parents of type `BusinessUnit` or `Division`. A `Department` can have multiple parents of type `Division` or `Department`. Refer to *[../../type/entityReferenceList.json](#/../type/entityReferenceList.json)*.
- **`children`**: Children teams. An `Organization` can have `BusinessUnit`, `Division` or `Department` as children. A `BusinessUnit` can have `BusinessUnit`, `Division`, or `Department` as children. A `Division` can have `Division` or `Department` as children. A `Department` can have `Department` as children. Refer to *[../../type/entityReferenceList.json](#/../type/entityReferenceList.json)*.
- **`users`**: Users that are part of the team. Refer to *[../../type/entityReferenceList.json](#/../type/entityReferenceList.json)*. Default: `null`.
- **`childrenCount`** *(integer)*: Total count of Children teams.
- **`userCount`** *(integer)*: Total count of users that are part of the team.
- **`owns`**: List of entities owned by the team. Refer to *[../../type/entityReferenceList.json](#/../type/entityReferenceList.json)*.
- **`owners`**: Owner of this team. . Refer to *[../../type/entityReferenceList.json](#/../type/entityReferenceList.json)*. Default: `null`.
- **`isJoinable`** *(boolean)*: Can any user join this team during sign up? Value of true indicates yes, and false no. Default: `true`.
- **`changeDescription`**: Change that lead to this version of the entity. Refer to *[../../type/entityHistory.json#/definitions/changeDescription](#/../type/entityHistory.json#/definitions/changeDescription)*.
- **`deleted`** *(boolean)*: When `true` indicates the entity has been soft deleted. Default: `false`.
- **`defaultRoles`**: Default roles of a team. These roles will be inherited by all the users that are part of this team. Refer to *[../../type/entityReferenceList.json](#/../type/entityReferenceList.json)*.
- **`inheritedRoles`**: Roles that a team is inheriting through membership in teams that have set team default roles. Refer to *[../../type/entityReferenceList.json](#/../type/entityReferenceList.json)*.
- **`policies`**: Policies that is attached to this team. Refer to *[../../type/entityReferenceList.json](#/../type/entityReferenceList.json)*.
- **`domains`**: Domain the Team belongs to. Refer to *[../../type/entityReferenceList.json](#/../type/entityReferenceList.json)*.
## Definitions

- **`teamType`** *(string)*: Organization is the highest level entity. An Organization has one of more Business Units, Division, Departments, Group, or Users. A Business Unit has one or more Divisions, Departments, Group, or Users. A Division has one or more Divisions, Departments, Group, or Users. A Department has one or more Departments, Group, or Users. A Group has only Users. Must be one of: `["Group", "Department", "Division", "BusinessUnit", "Organization"]`. Default: `"Group"`.


Documentation file automatically generated at 2025-01-15 09:05:41.923720+00:00.
