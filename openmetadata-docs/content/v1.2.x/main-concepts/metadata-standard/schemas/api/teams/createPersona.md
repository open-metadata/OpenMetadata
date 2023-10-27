---
title: createPersona
slug: /main-concepts/metadata-standard/schemas/api/teams/createpersona
---

# CreatePersonaRequest

*Persona entity*

## Properties

- **`name`**: Refer to *../../type/basic.json#/definitions/entityName*.
- **`displayName`** *(string)*: Optional name used for display purposes. Example 'Data Steward'.
- **`description`**: Optional description of the team. Refer to *../../type/basic.json#/definitions/markdown*.
- **`users`** *(array)*: Optional IDs of users that are going to assign a Persona. Default: `None`.
  - **Items**: Refer to *../../type/basic.json#/definitions/uuid*.


Documentation file automatically generated at 2023-10-27 13:55:46.343512.
