---
title: createTeam
slug: /main-concepts/metadata-standard/schemas/schema/api/teams
---

# CreateTeamRequest

*Team entity*

## Properties

- **`name`**: Refer to *../../type/basic.json#/definitions/entityName*.
- **`displayName`** *(string)*: Optional name used for display purposes. Example 'Marketing Team'.
- **`description`**: Optional description of the team. Refer to *../../type/basic.json#/definitions/markdown*.
- **`profile`**: Optional team profile information. Refer to *../../type/profile.json*.
- **`users`** *(array)*: Optional IDs of users that are part of the team. Default: `None`.
  - **Items**: Refer to *../../type/basic.json#/definitions/uuid*.
- **`defaultRoles`** *(array)*: Roles to be assigned to all users that are part of this team. Default: `None`.
  - **Items**: Refer to *../../type/basic.json#/definitions/uuid*.
- **`owner`**: Owner of this team. . Refer to *../../type/entityReference.json*. Default: `None`.
- **`isJoinable`** *(boolean)*: Can any user join this team during sign up? Value of true indicates yes, and false no. Default: `True`.


Documentation file automatically generated at 2022-07-13 10:27:46.766157.
