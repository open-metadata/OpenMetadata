---
title: Add Description Action | OpenMetadata Description Actions
slug: /main-concepts/metadata-standard/schemas/entity/applications/configuration/external/automator/adddescriptionaction
---

# AddDescriptionAction

*Apply Tags to the selected assets.*

## Properties

- **`type`**: Application Type. Refer to *[#/definitions/addDescriptionActionType](#definitions/addDescriptionActionType)*. Default: `"AddDescriptionAction"`.
- **`description`** *(string)*: Description to apply.
- **`applyToChildren`** *(array)*: Apply the description to the children of the selected assets that match the criteria. E.g., columns, tasks, topic fields,... Default: `null`.
  - **Items**: Refer to *[../../../../../type/basic.json#/definitions/entityName](#/../../../../type/basic.json#/definitions/entityName)*.
- **`overwriteMetadata`** *(boolean)*: Update the description even if they are already defined in the asset. By default, we'll only add the descriptions to assets without the description set. Default: `false`.
## Definitions

- **`addDescriptionActionType`** *(string)*: Add Description Action Type. Must be one of: `["AddDescriptionAction"]`. Default: `"AddDescriptionAction"`.


Documentation file automatically generated at 2025-01-15 09:05:41.923720+00:00.
