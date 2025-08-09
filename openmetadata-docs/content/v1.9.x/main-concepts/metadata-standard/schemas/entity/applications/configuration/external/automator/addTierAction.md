---
title: Add Tier Action | OpenMetadata Tier Actions
description: Get started with addtieraction. Setup instructions, features, and configuration details inside.
slug: /main-concepts/metadata-standard/schemas/entity/applications/configuration/external/automator/addtieraction
---

# AddTierAction

*Add an owner to the selected assets.*

## Properties

- **`type`**: Application Type. Refer to *[#/definitions/addTierActionType](#definitions/addTierActionType)*. Default: `"AddTierAction"`.
- **`tier`**: tier to apply. Refer to *[../../../../../type/tagLabel.json](#/../../../../type/tagLabel.json)*.
- **`overwriteMetadata`** *(boolean)*: Update the tier even if it is defined in the asset. By default, we will only apply the tier to assets without tier. Default: `false`.
## Definitions

- **`addTierActionType`** *(string)*: Add Tier Action Type. Must be one of: `["AddTierAction"]`. Default: `"AddTierAction"`.


Documentation file automatically generated at 2025-01-15 09:05:41.923720+00:00.
