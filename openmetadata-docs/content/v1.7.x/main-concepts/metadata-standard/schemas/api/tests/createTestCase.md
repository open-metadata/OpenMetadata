---
title: Create Test Case | OpenMetadata Test Case API
slug: /main-concepts/metadata-standard/schemas/api/tests/createtestcase
---

# CreateTestCaseRequest

*Test is a test definition to capture data quality tests.*

## Properties

- **`name`**: Name that identifies this test case. Refer to *[../../type/basic.json#/definitions/testCaseEntityName](#/../type/basic.json#/definitions/testCaseEntityName)*.
- **`description`**: Description of the testcase. Refer to *[../../type/basic.json#/definitions/markdown](#/../type/basic.json#/definitions/markdown)*.
- **`displayName`** *(string)*: Display Name that identifies this test.
- **`testDefinition`**: Fully qualified name of the test definition. Refer to *[../../type/basic.json#/definitions/fullyQualifiedEntityName](#/../type/basic.json#/definitions/fullyQualifiedEntityName)*.
- **`entityLink`**: Refer to *[../../type/basic.json#/definitions/entityLink](#/../type/basic.json#/definitions/entityLink)*.
- **`testSuite`**: Fully qualified name of the testSuite. Refer to *[../../type/basic.json#/definitions/fullyQualifiedEntityName](#/../type/basic.json#/definitions/fullyQualifiedEntityName)*.
- **`parameterValues`** *(array)*
  - **Items**: Refer to *[../../tests/testCase.json#/definitions/testCaseParameterValue](#/../tests/testCase.json#/definitions/testCaseParameterValue)*.
- **`owners`**: Owners of this test. Refer to *[../../type/entityReferenceList.json](#/../type/entityReferenceList.json)*.
- **`computePassedFailedRowCount`** *(boolean)*: Compute the passed and failed row count for the test case. Default: `false`.
- **`useDynamicAssertion`** *(boolean)*: If the test definition supports it, use dynamic assertion to evaluate the test case. Default: `false`.


Documentation file automatically generated at 2025-01-15 09:05:41.923720+00:00.
