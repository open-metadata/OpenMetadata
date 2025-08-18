---
title: addOwnerAction
slug: /main-concepts/metadata-standard/schemas/entity/applications/configuration/external/automator/addowneraction
---

# AddOwnerAction

*Add owners to the selected assets.*

## Properties

- **`type`**: Application Type. Refer to *#/definitions/addOwnerActionType*. Default: `AddOwnerAction`.
- **`owners`**: Owners to apply. Refer to *../../../../../type/entityReferenceList.json*. Default: `None`.
- **`overwriteMetadata`** *(boolean)*: Update the owners even if it is defined in the asset. By default, we will only apply the owners to assets without owner. Default: `False`.
## Definitions

- **`addOwnerActionType`** *(string)*: Add Owner Action Type. Must be one of: `['AddOwnerAction']`. Default: `AddOwnerAction`.


Documentation file automatically generated at 2025-08-12 05:39:47.683420+00:00.
