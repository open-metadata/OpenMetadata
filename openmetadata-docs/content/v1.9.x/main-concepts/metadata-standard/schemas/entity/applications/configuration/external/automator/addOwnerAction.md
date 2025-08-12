---
title: Add Owner Action | OpenMetadata Ownership Actions
description: Get started with addowneraction. Setup instructions, features, and configuration details inside.
slug: /main-concepts/metadata-standard/schemas/entity/applications/configuration/external/automator/addowneraction
---

# AddOwnerAction

*Add owners to the selected assets.*

## Properties

- **`type`**: Application Type. Refer to *[#/definitions/addOwnerActionType](#definitions/addOwnerActionType)*. Default: `"AddOwnerAction"`.
- **`owners`**: Owners to apply. Refer to *[../../../../../type/entityReferenceList.json](#/../../../../type/entityReferenceList.json)*. Default: `null`.
- **`overwriteMetadata`** *(boolean)*: Update the owners even if it is defined in the asset. By default, we will only apply the owners to assets without owner. Default: `false`.
## Definitions

- **`addOwnerActionType`** *(string)*: Add Owner Action Type. Must be one of: `["AddOwnerAction"]`. Default: `"AddOwnerAction"`.


Documentation file automatically generated at 2025-01-15 09:05:41.923720+00:00.
