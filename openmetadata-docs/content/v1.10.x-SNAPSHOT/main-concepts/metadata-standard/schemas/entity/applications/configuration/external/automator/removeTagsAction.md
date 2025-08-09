---
title: removeTagsAction
slug: /main-concepts/metadata-standard/schemas/entity/applications/configuration/external/automator/removetagsaction
---

# RemoveTagsAction

*Remove Tags Action Type*

## Properties

- **`type`**: Application Type. Refer to *#/definitions/removeTagsActionType*. Default: `AddTagsAction`.
- **`tags`** *(array)*: Tags to remove.
  - **Items**: Refer to *../../../../../type/tagLabel.json*.
- **`labels`** *(array)*: Remove tags by its label type. Default: `None`.
  - **Items**: Refer to *#/definitions/labelType*.
- **`applyToChildren`** *(array)*: Remove tags from the children of the selected assets. E.g., columns, tasks, topic fields,... Default: `None`.
  - **Items**: Refer to *../../../../../type/basic.json#/definitions/entityName*.
- **`applyToAll`** *(boolean)*: Remove tags from all the children and parent of the selected assets. Default: `None`.
## Definitions

- **`removeTagsActionType`** *(string)*: Remove Tags Action Type. Must be one of: `['RemoveTagsAction']`. Default: `RemoveTagsAction`.
- **`labelType`** *(string)*: Remove tags by its label type. Must be one of: `['Manual', 'Propagated', 'Automated']`.


Documentation file automatically generated at 2025-08-08 15:20:07.536378+00:00.
