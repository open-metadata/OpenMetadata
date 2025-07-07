---
title: Add Custom Properties | OpenMetadata Custom Properties
slug: /main-concepts/metadata-standard/schemas/entity/applications/configuration/external/automator/addcustomproperties
---

# AddCustomPropertiesAction

*Add a Custom Property to the selected assets.*

## Properties

- **`type`**: Application Type. Refer to *[#/definitions/AddCustomPropertiesActionType](#definitions/AddCustomPropertiesActionType)*. Default: `"AddCustomPropertiesAction"`.
- **`customProperties`**: Owners to apply. Refer to *[../../../../../type/basic.json#/definitions/entityExtension](#/../../../../type/basic.json#/definitions/entityExtension)*. Default: `null`.
- **`overwriteMetadata`** *(boolean)*: Update the Custom Property even if it is defined in the asset. By default, we will only apply the owners to assets without the given Custom Property informed. Default: `false`.
## Definitions

- **`AddCustomPropertiesActionType`** *(string)*: Add Custom Properties Action Type. Must be one of: `["AddCustomPropertiesAction"]`. Default: `"AddCustomPropertiesAction"`.


Documentation file automatically generated at 2025-01-15 09:05:41.923720+00:00.
