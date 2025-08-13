---
title: removeTestCaseAction
slug: /main-concepts/metadata-standard/schemas/entity/applications/configuration/external/automator/removetestcaseaction
---

# RemoveTestCaseAction

*Remove Test Cases Action Type*

## Properties

- **`type`**: Application Type. Refer to *#/definitions/removeTestCaseActionType*. Default: `RemoveTestCaseAction`.
- **`testCaseDefinitions`** *(array)*: Test Cases to remove.
  - **Items**: Refer to *../../../../../type/basic.json#/definitions/fullyQualifiedEntityName*.
- **`applyToChildren`** *(array)*: Remove tests to the selected table columns. Default: `None`.
  - **Items**: Refer to *../../../../../type/basic.json#/definitions/entityName*.
- **`removeAll`** *(boolean)*: Remove all test cases. Default: `False`.
## Definitions

- **`removeTestCaseActionType`** *(string)*: Remove Test Case Action Type. Must be one of: `['RemoveTestCaseAction']`. Default: `RemoveTestCaseAction`.


Documentation file automatically generated at 2025-08-12 05:39:47.683420+00:00.
