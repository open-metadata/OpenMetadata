---
title: addDescriptionAction
slug: /main-concepts/metadata-standard/schemas/entity/applications/configuration/external/automator/adddescriptionaction
---

# AddDescriptionAction

*Apply Tags to the selected assets.*

## Properties

- **`type`**: Application Type. Refer to *#/definitions/addDescriptionActionType*. Default: `AddDescriptionAction`.
- **`description`** *(string)*: Description to apply.
- **`applyToChildren`** *(array)*: Apply the description to the children of the selected assets that match the criteria. E.g., columns, tasks, topic fields,... Default: `None`.
  - **Items**: Refer to *../../../../../type/basic.json#/definitions/entityName*.
- **`overwriteMetadata`** *(boolean)*: Update the description even if they are already defined in the asset. By default, we'll only add the descriptions to assets without the description set. Default: `False`.
## Definitions

- **`addDescriptionActionType`** *(string)*: Add Description Action Type. Must be one of: `['AddDescriptionAction']`. Default: `AddDescriptionAction`.


Documentation file automatically generated at 2025-08-08 15:20:07.536378+00:00.
