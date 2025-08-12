---
title: uiCustomization
slug: /main-concepts/metadata-standard/schemas/system/ui/uicustomization
---

# UICustomization

*Contains UI customization details for a Persona.*

## Properties

- **`id`**: Refer to *../../type/basic.json#/definitions/uuid*.
- **`name`**: A unique name for the UI customization configuration. Refer to *../../type/basic.json#/definitions/entityName*.
- **`displayName`** *(string)*: Name used for display purposes.
- **`description`**: Description of the UI customization. Refer to *../../type/basic.json#/definitions/markdown*.
- **`pages`** *(array)*: List of Pages in the UI customization.
  - **Items**: Refer to *page.json*.
- **`navigation`** *(array)*: Site-wide navigation configuration.
  - **Items**: Refer to *navigationItem.json*.
- **`personaPreferences`** *(array)*: Persona default preferences. Admin can customize certain UI elements per persona as base configuration. Default: `[]`.
  - **Items**: Refer to *../../type/personaPreferences.json*.
- **`updatedAt`**: Refer to *../../type/basic.json#/definitions/timestamp*.
- **`updatedBy`** *(string)*
- **`version`**: Refer to *../../type/entityHistory.json#/definitions/entityVersion*.
- **`changeDescription`**: Refer to *../../type/entityHistory.json#/definitions/changeDescription*.
- **`href`**: Refer to *../../type/basic.json#/definitions/href*.


Documentation file automatically generated at 2025-08-12 05:39:47.683420+00:00.
