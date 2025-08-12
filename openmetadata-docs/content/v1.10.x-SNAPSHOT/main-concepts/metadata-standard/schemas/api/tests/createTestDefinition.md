---
title: createTestDefinition
slug: /main-concepts/metadata-standard/schemas/api/tests/createtestdefinition
---

# CreateTestDefinitionRequest

*Schema corresponding to a Test Definition*

## Properties

- **`name`**: Name that identifies this test case. Refer to *../../type/basic.json#/definitions/testCaseEntityName*.
- **`displayName`** *(string)*: Display Name that identifies this test case.
- **`description`**: Description of the testcase. Refer to *../../type/basic.json#/definitions/markdown*.
- **`owners`**: Owners of this TestCase definition. Refer to *../../type/entityReferenceList.json*.
- **`entityType`**: Refer to *../../tests/testDefinition.json#/definitions/entityType*.
- **`testPlatforms`** *(array)*
  - **Items**: Refer to *../../tests/testDefinition.json#/definitions/testPlatform*.
- **`supportedDataTypes`** *(array)*
  - **Items**: Refer to *../../entity/data/table.json#/definitions/dataType*.
- **`provider`**: Refer to *../../type/basic.json#/definitions/providerType*.
- **`parameterDefinition`** *(array)*
  - **Items**: Refer to *../../tests/testDefinition.json#/definitions/testCaseParameterDefinition*.
- **`domains`** *(array)*: Fully qualified names of the domains the Test Definition belongs to.
  - **Items** *(string)*


Documentation file automatically generated at 2025-08-12 05:39:47.683420+00:00.
