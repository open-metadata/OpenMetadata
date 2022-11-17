---
title: createTestDefinition
slug: /main-concepts/metadata-standard/schemas/api/tests/createtestdefinition
---

# CreateTestDefinitionRequest

*Schema corresponding to a Test Definition*

## Properties

- **`name`**: Name that identifies this test case. Refer to *../../type/basic.json#/definitions/entityName*.
- **`displayName`** *(string)*: Display Name that identifies this test case.
- **`description`**: Description of the testcase. Refer to *../../type/basic.json#/definitions/markdown*.
- **`entityType`**: Refer to *../../tests/testDefinition.json#/definitions/entityType*.
- **`testPlatforms`** *(array)*
  - **Items**: Refer to *../../tests/testDefinition.json#/definitions/testPlatform*.
- **`supportedDataTypes`** *(array)*
  - **Items**: Refer to *../../entity/data/table.json#/definitions/dataType*.
- **`parameterDefinition`** *(array)*
  - **Items**: Refer to *../../tests/testDefinition.json#/definitions/testCaseParameterDefinition*.


Documentation file automatically generated at 2022-11-17 03:44:30.373132.
