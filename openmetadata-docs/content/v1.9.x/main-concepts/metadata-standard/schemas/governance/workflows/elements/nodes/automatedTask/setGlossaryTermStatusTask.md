---
title: setGlossaryTermStatusTask
description: Get started with setglossarytermstatustask. Setup instructions, features, and configuration details inside.
slug: /main-concepts/metadata-standard/schemas/governance/workflows/elements/nodes/automatedtask/setglossarytermstatustask
---

# SetGlossaryTermStatusTaskDefinition

*Sets the GlossaryTerm Status to the configured value.*

## Properties

- **`type`** *(string)*: Default: `"automatedTask"`.
- **`subType`** *(string)*: Default: `"setGlossaryTermStatusTask"`.
- **`name`**: Name that identifies this Node. Refer to *[../../../../../type/basic.json#/definitions/entityName](#/../../../../type/basic.json#/definitions/entityName)*.
- **`displayName`** *(string)*: Display Name that identifies this Node.
- **`description`**: Description of the Node. Refer to *[../../../../../type/basic.json#/definitions/markdown](#/../../../../type/basic.json#/definitions/markdown)*.
- **`config`** *(object)*: Cannot contain additional properties.
  - **`glossaryTermStatus`**: Refer to *[../../../../../entity/data/glossaryTerm.json#/definitions/status](#/../../../../entity/data/glossaryTerm.json#/definitions/status)*.
- **`input`** *(array)*: Length must be equal to 1. Default: `["relatedEntity"]`.
  - **Items** *(string)*


Documentation file automatically generated at 2025-01-15 09:05:41.923720+00:00.
