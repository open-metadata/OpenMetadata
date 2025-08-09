---
title: Add Tags Action | OpenMetadata Tag Actions
description: Get started with addtagsaction. Setup instructions, features, and configuration details inside.
slug: /main-concepts/metadata-standard/schemas/entity/applications/configuration/external/automator/addtagsaction
---

# AddTagsAction

*Apply Tags to the selected assets.*

## Properties

- **`type`**: Application Type. Refer to *[#/definitions/addTagsActionType](#definitions/addTagsActionType)*. Default: `"AddTagsAction"`.
- **`tags`** *(array)*: Tags to apply.
  - **Items**: Refer to *[../../../../../type/tagLabel.json](#/../../../../type/tagLabel.json)*.
- **`applyToChildren`** *(array)*: Apply tags to the children of the selected assets that match the criteria. E.g., columns, tasks, topic fields,... Default: `null`.
  - **Items**: Refer to *[../../../../../type/basic.json#/definitions/entityName](#/../../../../type/basic.json#/definitions/entityName)*.
- **`overwriteMetadata`** *(boolean)*: Update tags even if they are already defined in the asset. By default, incoming tags are merged with the existing ones. Default: `false`.
## Definitions

- **`addTagsActionType`** *(string)*: Add Tags action type. Must be one of: `["AddTagsAction"]`. Default: `"AddTagsAction"`.


Documentation file automatically generated at 2025-01-15 09:05:41.923720+00:00.
