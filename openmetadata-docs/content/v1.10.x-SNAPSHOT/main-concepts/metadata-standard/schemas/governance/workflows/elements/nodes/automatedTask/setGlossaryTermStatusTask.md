---
title: setGlossaryTermStatusTask
slug: /main-concepts/metadata-standard/schemas/governance/workflows/elements/nodes/automatedtask/setglossarytermstatustask
---

# SetGlossaryTermStatusTaskDefinition

*Sets the GlossaryTerm Status to the configured value.*

## Properties

- **`type`** *(string)*: Default: `automatedTask`.
- **`subType`** *(string)*: Default: `setGlossaryTermStatusTask`.
- **`name`**: Name that identifies this Node. Refer to *../../../../../type/basic.json#/definitions/entityName*.
- **`displayName`** *(string)*: Display Name that identifies this Node.
- **`description`**: Description of the Node. Refer to *../../../../../type/basic.json#/definitions/markdown*.
- **`config`** *(object)*: Cannot contain additional properties.
  - **`glossaryTermStatus`**: Choose which Status to apply to the Glossary Term. Refer to *../../../../../entity/data/glossaryTerm.json#/definitions/status*.
- **`input`** *(array)*: Default: `['relatedEntity', 'updatedBy']`.
  - **Items** *(string)*
- **`inputNamespaceMap`** *(object)*: Cannot contain additional properties.
  - **`relatedEntity`** *(string)*: Default: `global`.
  - **`updatedBy`** *(string)*: Default: `None`.


Documentation file automatically generated at 2025-08-08 15:20:07.536378+00:00.
