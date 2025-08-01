---
title: Remove Tags Action | OpenMetadata Tag Removal
description: Get started with removetagsaction. Setup instructions, features, and configuration details inside.
slug: /main-concepts/metadata-standard/schemas/entity/applications/configuration/external/automator/removetagsaction
---

# RemoveTagsAction

*Remove Tags Action Type*

## Properties

- **`type`**: Application Type. Refer to *[#/definitions/removeTagsActionType](#definitions/removeTagsActionType)*. Default: `"AddTagsAction"`.
- **`tags`** *(array)*: Tags to remove.
  - **Items**: Refer to *[../../../../../type/tagLabel.json](#/../../../../type/tagLabel.json)*.
- **`applyToChildren`** *(array)*: Remove tags from all the children of the selected assets. E.g., columns, tasks, topic fields,... Default: `null`.
  - **Items**: Refer to *[../../../../../type/basic.json#/definitions/entityName](#/../../../../type/basic.json#/definitions/entityName)*.
## Definitions

- **`removeTagsActionType`** *(string)*: Remove Tags Action Type. Must be one of: `["RemoveTagsAction"]`. Default: `"RemoveTagsAction"`.


Documentation file automatically generated at 2025-01-15 09:05:41.923720+00:00.
