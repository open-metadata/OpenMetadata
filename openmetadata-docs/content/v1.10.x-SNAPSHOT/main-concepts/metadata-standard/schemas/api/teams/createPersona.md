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
- **`domains`** *(array)*: Fully qualified names of the domains the Persona belongs to.
  - **Items** *(string)*
- **`default`** *(boolean)*: When true, this persona is the system-wide default persona that will be applied to users who don't have any persona assigned or no default persona set. Default: `False`.


Documentation file automatically generated at 2025-08-12 05:39:47.683420+00:00.
