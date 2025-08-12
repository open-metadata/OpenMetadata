---
title: addTagsAction
slug: /main-concepts/metadata-standard/schemas/entity/applications/configuration/external/automator/addtagsaction
---

# AddTagsAction

*Apply Tags to the selected assets.*

## Properties

- **`type`**: Application Type. Refer to *#/definitions/addTagsActionType*. Default: `AddTagsAction`.
- **`tags`** *(array)*: Tags to apply.
  - **Items**: Refer to *../../../../../type/tagLabel.json*.
- **`applyToChildren`** *(array)*: Apply tags to the children of the selected assets that match the criteria. E.g., columns, tasks, topic fields,... Default: `None`.
  - **Items**: Refer to *../../../../../type/basic.json#/definitions/entityName*.
- **`overwriteMetadata`** *(boolean)*: Update tags even if they are already defined in the asset. By default, incoming tags are merged with the existing ones. Default: `False`.
## Definitions

- **`addTagsActionType`** *(string)*: Add Tags action type. Must be one of: `['AddTagsAction']`. Default: `AddTagsAction`.


Documentation file automatically generated at 2025-08-12 05:39:47.683420+00:00.
