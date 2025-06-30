---
title: removeDescriptionAction
slug: /main-concepts/metadata-standard/schemas/entity/applications/configuration/external/automator/removedescriptionaction
---

# RemoveDescriptionAction

*Remove Owner Action Type*

## Properties

- **`type`**: Application Type. Refer to *[#/definitions/removeDescriptionActionType](#definitions/removeDescriptionActionType)*. Default: `"RemoveDescriptionAction"`.
- **`applyToChildren`** *(array)*: Remove descriptions from all children of the selected assets. E.g., columns, tasks, topic fields,... Default: `null`.
  - **Items**: Refer to *[../../../../../type/basic.json#/definitions/entityName](#/../../../../type/basic.json#/definitions/entityName)*.
## Definitions

- **`removeDescriptionActionType`** *(string)*: Remove Description Action Type. Must be one of: `["RemoveDescriptionAction"]`. Default: `"RemoveDescriptionAction"`.


Documentation file automatically generated at 2025-01-15 09:05:41.923720+00:00.
