---
title: uiCustomization | OpenMetadata UI Customization
description: Customize UI appearance using themes, font settings, and layout options for a consistent user experience.
slug: /main-concepts/metadata-standard/schemas/system/ui/uicustomization
---

# UICustomization

*Contains UI customization details for a Persona.*

## Properties

- **`id`**: Refer to *[../../type/basic.json#/definitions/uuid](#/../type/basic.json#/definitions/uuid)*.
- **`name`**: A unique name for the UI customization configuration. Refer to *[../../type/basic.json#/definitions/entityName](#/../type/basic.json#/definitions/entityName)*.
- **`displayName`** *(string)*: Name used for display purposes.
- **`description`**: Description of the UI customization. Refer to *[../../type/basic.json#/definitions/markdown](#/../type/basic.json#/definitions/markdown)*.
- **`pages`** *(array)*: List of Pages in the UI customization.
  - **Items**: Refer to *[page.json](#ge.json)*.
- **`navigation`** *(array)*: Site-wide navigation configuration.
  - **Items**: Refer to *[navigationItem.json](#vigationItem.json)*.
- **`updatedAt`**: Refer to *[../../type/basic.json#/definitions/timestamp](#/../type/basic.json#/definitions/timestamp)*.
- **`updatedBy`** *(string)*
- **`version`**: Refer to *[../../type/entityHistory.json#/definitions/entityVersion](#/../type/entityHistory.json#/definitions/entityVersion)*.
- **`changeDescription`**: Refer to *[../../type/entityHistory.json#/definitions/changeDescription](#/../type/entityHistory.json#/definitions/changeDescription)*.
- **`href`**: Refer to *[../../type/basic.json#/definitions/href](#/../type/basic.json#/definitions/href)*.


Documentation file automatically generated at 2025-01-15 09:05:41.923720+00:00.
