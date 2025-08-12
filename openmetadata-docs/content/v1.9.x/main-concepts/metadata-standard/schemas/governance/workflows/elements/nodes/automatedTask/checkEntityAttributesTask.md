---
title: Checkentityattributestask | Official Documentation
description: Get started with checkentityattributestask. Setup instructions, features, and configuration details inside.
slug: /main-concepts/metadata-standard/schemas/governance/workflows/elements/nodes/automatedtask/checkentityattributestask
---

# CheckEntityAttributesTaskDefinition

*Checks if an Entity attributes fit given rules.*

## Properties

- **`type`** *(string)*: Default: `"automatedTask"`.
- **`subType`** *(string)*: Default: `"checkEntityAttributesTask"`.
- **`name`**: Name that identifies this Node. Refer to *[../../../../../type/basic.json#/definitions/entityName](#/../../../../type/basic.json#/definitions/entityName)*.
- **`displayName`** *(string)*: Display Name that identifies this Node.
- **`description`**: Description of the Node. Refer to *[../../../../../type/basic.json#/definitions/markdown](#/../../../../type/basic.json#/definitions/markdown)*.
- **`config`** *(object)*: Cannot contain additional properties.
  - **`rules`** *(string, format: queryBuilder)*
- **`input`** *(array)*: Length must be equal to 1. Default: `["relatedEntity"]`.
  - **Items** *(string)*
- **`output`** *(array)*: Length must be equal to 1. Default: `["result"]`.
  - **Items** *(string)*


Documentation file automatically generated at 2025-01-15 09:05:41.923720+00:00.
