---
title: runAppTask
slug: /main-concepts/metadata-standard/schemas/governance/workflows/elements/nodes/automatedtask/runapptask
---

# RunAppTaskDefinition

*Runs an App based on its name.*

## Properties

- **`type`** *(string)*: Default: `automatedTask`.
- **`subType`** *(string)*: Default: `runAppTask`.
- **`name`**: Name that identifies this Node. Refer to *../../../../../type/basic.json#/definitions/entityName*.
- **`displayName`** *(string)*: Display Name that identifies this Node.
- **`description`**: Description of the Node. Refer to *../../../../../type/basic.json#/definitions/markdown*.
- **`config`** *(object)*: Cannot contain additional properties.
  - **`appName`** *(string)*: Set which App should Run.
  - **`waitForCompletion`** *(boolean)*: Set if this step should wait until the App finishes running. Default: `True`.
  - **`timeoutSeconds`** *(integer)*: Set the amount of seconds to wait before defining the App has timed out. Default: `3600`.
- **`input`** *(array)*: Default: `['relatedEntity']`.
  - **Items** *(string)*
- **`inputNamespaceMap`** *(object)*: Cannot contain additional properties.
  - **`relatedEntity`** *(string)*: Default: `global`.
- **`branches`** *(array)*: Default: `['success', 'failure']`.
  - **Items** *(string)*


Documentation file automatically generated at 2025-08-08 15:20:07.536378+00:00.
