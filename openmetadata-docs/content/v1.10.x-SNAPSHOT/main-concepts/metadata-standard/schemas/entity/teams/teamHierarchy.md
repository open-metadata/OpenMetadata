---
title: teamHierarchy
slug: /main-concepts/metadata-standard/schemas/entity/teams/teamhierarchy
---

# Team Hierarchy

*This schema defines the Team entity with Hierarchy. Hierarchical teams are supported `Organization` -> `BusinessUnit` -> `Division` -> `Department` -> `Group`.*

## Properties

- **`id`**: Refer to *../../type/basic.json#/definitions/uuid*.
- **`teamType`**: Team type. Refer to *team.json#/definitions/teamType*.
- **`name`**: A unique name of the team typically the team ID from an identity provider. Example - group Id from LDAP. Refer to *../../type/basic.json#/definitions/entityName*.
- **`description`**: Description of the team. Refer to *../../type/basic.json#/definitions/markdown*.
- **`fullyQualifiedName`**: FullyQualifiedName same as `name`. Refer to *../../type/basic.json#/definitions/fullyQualifiedEntityName*.
- **`displayName`** *(string)*: Name used for display purposes. Example 'Data Science team'.
- **`href`**: Link to the resource corresponding to this entity. Refer to *../../type/basic.json#/definitions/href*.
- **`children`**: Children teams. An `Organization` can have `BusinessUnit`, `Division` or `Department` as children. A `BusinessUnit` can have `BusinessUnit`, `Division`, or `Department` as children. A `Division` can have `Division` or `Department` as children. A `Department` can have `Department` as children. Refer to *#/definitions/teamHierarchyList*.
- **`isJoinable`** *(boolean)*: Can any user join this team during sign up? Value of true indicates yes, and false no. Default: `True`.
## Definitions

- **`teamHierarchyList`** *(array)*: Default: `None`.
  - **Items**: Refer to *teamHierarchy.json*.


Documentation file automatically generated at 2025-08-08 15:20:07.536378+00:00.
