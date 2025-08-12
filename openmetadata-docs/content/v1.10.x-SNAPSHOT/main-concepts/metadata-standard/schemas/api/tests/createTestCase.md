---
title: createTestCase
slug: /main-concepts/metadata-standard/schemas/api/tests/createtestcase
---

# CreateTestCaseRequest

*Test is a test definition to capture data quality tests.*

## Properties

- **`name`**: Name that identifies this test case. Refer to *../../type/basic.json#/definitions/testCaseEntityName*.
- **`description`**: Description of the testcase. Refer to *../../type/basic.json#/definitions/markdown*.
- **`displayName`** *(string)*: Display Name that identifies this test.
- **`testDefinition`**: Fully qualified name of the test definition. Refer to *../../type/basic.json#/definitions/fullyQualifiedEntityName*.
- **`entityLink`**: Refer to *../../type/basic.json#/definitions/entityLink*.
- **`parameterValues`** *(array)*
  - **Items**: Refer to *../../tests/testCase.json#/definitions/testCaseParameterValue*.
- **`owners`**: Owners of this test. Refer to *../../type/entityReferenceList.json*.
- **`computePassedFailedRowCount`** *(boolean)*: Compute the passed and failed row count for the test case. Default: `False`.
- **`useDynamicAssertion`** *(boolean)*: If the test definition supports it, use dynamic assertion to evaluate the test case. Default: `False`.
- **`tags`** *(array)*: Tags for this test case. This is an inherited field from the parent entity and is not set directly on the test case. Default: `[]`.
  - **Items**: Refer to *../../type/tagLabel.json*.


Documentation file automatically generated at 2025-08-12 05:39:47.683420+00:00.
