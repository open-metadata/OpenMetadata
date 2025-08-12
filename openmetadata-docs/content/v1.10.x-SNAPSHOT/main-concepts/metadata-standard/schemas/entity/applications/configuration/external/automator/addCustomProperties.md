---
title: addCustomProperties
slug: /main-concepts/metadata-standard/schemas/entity/applications/configuration/external/automator/addcustomproperties
---

# AddCustomPropertiesAction

*Add a Custom Property to the selected assets.*

## Properties

- **`type`**: Application Type. Refer to *#/definitions/AddCustomPropertiesActionType*. Default: `AddCustomPropertiesAction`.
- **`customProperties`**: Owners to apply. Refer to *../../../../../type/basic.json#/definitions/entityExtension*. Default: `None`.
- **`overwriteMetadata`** *(boolean)*: Update the Custom Property even if it is defined in the asset. By default, we will only apply the owners to assets without the given Custom Property informed. Default: `False`.
## Definitions

- **`AddCustomPropertiesActionType`** *(string)*: Add Custom Properties Action Type. Must be one of: `['AddCustomPropertiesAction']`. Default: `AddCustomPropertiesAction`.


Documentation file automatically generated at 2025-08-12 05:39:47.683420+00:00.
