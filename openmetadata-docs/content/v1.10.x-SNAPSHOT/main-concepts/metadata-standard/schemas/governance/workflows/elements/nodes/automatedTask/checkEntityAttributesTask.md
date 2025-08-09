---
title: checkEntityAttributesTask
slug: /main-concepts/metadata-standard/schemas/governance/workflows/elements/nodes/automatedtask/checkentityattributestask
---

# CheckEntityAttributesTaskDefinition

*Checks if an Entity attributes fit given rules.*

## Properties

- **`type`** *(string)*: Default: `automatedTask`.
- **`subType`** *(string)*: Default: `checkEntityAttributesTask`.
- **`name`**: Name that identifies this Node. Refer to *../../../../../type/basic.json#/definitions/entityName*.
- **`displayName`** *(string)*: Display Name that identifies this Node.
- **`description`**: Description of the Node. Refer to *../../../../../type/basic.json#/definitions/markdown*.
- **`config`** *(object)*: Cannot contain additional properties.
  - **`rules`** *(string)*: Define certain set of rules that you would like to check. If all the rules apply, this will be set as 'True' and will continue through the positive flow. Otherwise it will be set to 'False' and continue through the negative flow.
- **`input`** *(array)*: Default: `['relatedEntity']`.
  - **Items** *(string)*
- **`inputNamespaceMap`** *(object)*: Cannot contain additional properties.
  - **`relatedEntity`** *(string)*: Default: `global`.
- **`branches`** *(array)*: Default: `['true', 'false']`.
  - **Items** *(string)*


Documentation file automatically generated at 2025-08-08 15:20:07.536378+00:00.
