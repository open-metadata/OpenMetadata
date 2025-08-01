---
title: Team Hierarchy | OpenMetadata Team Hierarchy
description: Model team hierarchy including nested relationships to reflect organizational structure.
slug: /main-concepts/metadata-standard/schemas/entity/teams/teamhierarchy
---

# Team Hierarchy

*This schema defines the Team entity with Hierarchy. Hierarchical teams are supported `Organization` -> `BusinessUnit` -> `Division` -> `Department` -> `Group`.*

## Properties

- **`id`**: Refer to *[../../type/basic.json#/definitions/uuid](#/../type/basic.json#/definitions/uuid)*.
- **`teamType`**: Team type. Refer to *[team.json#/definitions/teamType](#am.json#/definitions/teamType)*.
- **`name`**: A unique name of the team typically the team ID from an identity provider. Example - group Id from LDAP. Refer to *[../../type/basic.json#/definitions/entityName](#/../type/basic.json#/definitions/entityName)*.
- **`description`**: Description of the team. Refer to *[../../type/basic.json#/definitions/markdown](#/../type/basic.json#/definitions/markdown)*.
- **`fullyQualifiedName`**: FullyQualifiedName same as `name`. Refer to *[../../type/basic.json#/definitions/fullyQualifiedEntityName](#/../type/basic.json#/definitions/fullyQualifiedEntityName)*.
- **`displayName`** *(string)*: Name used for display purposes. Example 'Data Science team'.
- **`href`**: Link to the resource corresponding to this entity. Refer to *[../../type/basic.json#/definitions/href](#/../type/basic.json#/definitions/href)*.
- **`children`**: Children teams. An `Organization` can have `BusinessUnit`, `Division` or `Department` as children. A `BusinessUnit` can have `BusinessUnit`, `Division`, or `Department` as children. A `Division` can have `Division` or `Department` as children. A `Department` can have `Department` as children. Refer to *[#/definitions/teamHierarchyList](#definitions/teamHierarchyList)*.
- **`isJoinable`** *(boolean)*: Can any user join this team during sign up? Value of true indicates yes, and false no. Default: `true`.
## Definitions

- **`teamHierarchyList`** *(array)*: Default: `null`.
  - **Items**: Refer to *[teamHierarchy.json](#amHierarchy.json)*.


Documentation file automatically generated at 2025-01-15 09:05:41.923720+00:00.
