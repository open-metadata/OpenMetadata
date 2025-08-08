---
title: addDataProductAction
slug: /main-concepts/metadata-standard/schemas/entity/applications/configuration/external/automator/adddataproductaction
---

# AddDataProductAction

*Add a Data Product to the selected assets.*

## Properties

- **`type`**: Application Type. Refer to *#/definitions/AddDataProductActionType*. Default: `AddDataProductAction`.
- **`dataProducts`** *(array)*: Data Products to apply. Default: `None`.
  - **Items**: Refer to *../../../../../type/entityReference.json*.
- **`overwriteMetadata`** *(boolean)*: Update the Data Product even if the asset belongs to a different Domain. By default, we will only add the Data Product if the asset has no Domain, or it belongs to the same domain as the Data Product. Default: `False`.
## Definitions

- **`AddDataProductActionType`** *(string)*: Add Data Products Action Type. Must be one of: `['AddDataProductAction']`. Default: `AddDataProductAction`.


Documentation file automatically generated at 2025-08-08 15:20:07.536378+00:00.
