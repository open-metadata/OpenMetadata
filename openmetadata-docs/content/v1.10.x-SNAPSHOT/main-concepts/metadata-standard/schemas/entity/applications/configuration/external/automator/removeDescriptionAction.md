---
title: removeDescriptionAction
slug: /main-concepts/metadata-standard/schemas/entity/applications/configuration/external/automator/removedescriptionaction
---

# RemoveDescriptionAction

*Remove Owner Action Type*

## Properties

- **`type`**: Application Type. Refer to *#/definitions/removeDescriptionActionType*. Default: `RemoveDescriptionAction`.
- **`applyToChildren`** *(array)*: Remove descriptions from the children of the selected assets. E.g., columns, tasks, topic fields,... Default: `None`.
  - **Items**: Refer to *../../../../../type/basic.json#/definitions/entityName*.
- **`applyToAll`** *(boolean)*: Remove descriptions from all the children and parent of the selected assets. Default: `None`.
## Definitions

- **`removeDescriptionActionType`** *(string)*: Remove Description Action Type. Must be one of: `['RemoveDescriptionAction']`. Default: `RemoveDescriptionAction`.


Documentation file automatically generated at 2025-08-08 15:20:07.536378+00:00.
