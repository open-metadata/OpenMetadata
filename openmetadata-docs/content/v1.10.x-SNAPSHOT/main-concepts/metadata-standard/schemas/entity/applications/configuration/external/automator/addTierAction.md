---
title: addTierAction
slug: /main-concepts/metadata-standard/schemas/entity/applications/configuration/external/automator/addtieraction
---

# AddTierAction

*Add an owner to the selected assets.*

## Properties

- **`type`**: Application Type. Refer to *#/definitions/addTierActionType*. Default: `AddTierAction`.
- **`tier`**: tier to apply. Refer to *../../../../../type/tagLabel.json*.
- **`overwriteMetadata`** *(boolean)*: Update the tier even if it is defined in the asset. By default, we will only apply the tier to assets without tier. Default: `False`.
## Definitions

- **`addTierActionType`** *(string)*: Add Tier Action Type. Must be one of: `['AddTierAction']`. Default: `AddTierAction`.


Documentation file automatically generated at 2025-08-08 15:20:07.536378+00:00.
