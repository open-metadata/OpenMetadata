---
title: createTestCase
slug: /main-concepts/metadata-standard/schemas/api/tests/createtestcase
---

# CreateTestCaseRequest

*Test is a test definition to capture data quality tests.*

## Properties

- **`name`**: Name that identifies this test case. Refer to *../../type/basic.json#/definitions/entityName*.
- **`description`**: Description of the testcase. Refer to *../../type/basic.json#/definitions/markdown*.
- **`displayName`** *(string)*: Display Name that identifies this test.
- **`testDefinition`**: Fully qualified name of the test definition. Refer to *../../type/basic.json#/definitions/fullyQualifiedEntityName*.
- **`entityLink`**: Refer to *../../type/basic.json#/definitions/entityLink*.
- **`testSuite`**: Fully qualified name of the testSuite. Refer to *../../type/basic.json#/definitions/fullyQualifiedEntityName*.
- **`parameterValues`** *(array)*
  - **Items**: Refer to *../../tests/testCase.json#/definitions/testCaseParameterValue*.
- **`owner`**: Owner of this test. Refer to *../../type/entityReference.json*.


Documentation file automatically generated at 2023-07-07 05:50:35.981927.
