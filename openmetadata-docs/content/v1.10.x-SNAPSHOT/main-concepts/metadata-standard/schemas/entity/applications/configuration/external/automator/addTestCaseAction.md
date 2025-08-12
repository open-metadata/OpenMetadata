---
title: addTestCaseAction
slug: /main-concepts/metadata-standard/schemas/entity/applications/configuration/external/automator/addtestcaseaction
---

# AddTestCaseAction

*Add Test Cases to the selected assets.*

## Properties

- **`type`**: Application Type. Refer to *#/definitions/addTestCaseActionType*. Default: `AddTestCaseAction`.
- **`testCases`** *(array)*: Test Cases to apply.
  - **Items**: Refer to *#/definitions/testCaseDefinitions*.
- **`applyToChildren`** *(array)*: Add tests to the selected table columns. Default: `None`.
  - **Items**: Refer to *../../../../../type/basic.json#/definitions/entityName*.
- **`overwriteMetadata`** *(boolean)*: Update the test even if it is defined in the asset. By default, we will only apply the test to assets without the existing test already existing. Default: `False`.
## Definitions

- **`addTestCaseActionType`** *(string)*: Add Test Case Action Type. Must be one of: `['AddTestCaseAction']`. Default: `AddTestCaseAction`.
- **`testCaseDefinitions`** *(object)*: Minimum set of requirements to get a Test Case request ready.
  - **`testDefinition`**: Fully qualified name of the test definition. Refer to *../../../../../type/basic.json#/definitions/fullyQualifiedEntityName*.
  - **`parameterValues`** *(array)*
    - **Items**: Refer to *../../../../../tests/testCase.json#/definitions/testCaseParameterValue*.
  - **`computePassedFailedRowCount`** *(boolean)*: Compute the passed and failed row count for the test case. Default: `False`.
  - **`useDynamicAssertion`** *(boolean)*: If the test definition supports it, use dynamic assertion to evaluate the test case. Default: `False`.
  - **`tags`** *(array)*: Tags to apply. Default: `[]`.
    - **Items**: Refer to *../../../../../type/tagLabel.json*.


Documentation file automatically generated at 2025-08-12 05:39:47.683420+00:00.
