---
title: testCase
slug: /main-concepts/metadata-standard/schemas/tests/testcase
---

# TestCase

*Test case is a test definition to capture data quality tests against tables, columns, and other data assets.*

## Properties

- **`id`**: Unique identifier of this table instance. Refer to *[../type/basic.json#/definitions/uuid](#/type/basic.json#/definitions/uuid)*.
- **`name`**: Name that identifies this test case. Refer to *[../type/basic.json#/definitions/testCaseEntityName](#/type/basic.json#/definitions/testCaseEntityName)*.
- **`displayName`** *(string)*: Display Name that identifies this test.
- **`fullyQualifiedName`**: FullyQualifiedName same as `name`. Refer to *[../type/basic.json#/definitions/fullyQualifiedEntityName](#/type/basic.json#/definitions/fullyQualifiedEntityName)*.
- **`description`**: Description of the testcase. Refer to *[../type/basic.json#/definitions/markdown](#/type/basic.json#/definitions/markdown)*.
- **`testDefinition`**: Test definition that this test case is based on. Refer to *[../type/entityReference.json](#/type/entityReference.json)*.
- **`entityLink`**: Link to the entity that this test case is testing. Refer to *[../type/basic.json#/definitions/entityLink](#/type/basic.json#/definitions/entityLink)*.
- **`entityFQN`** *(string)*
- **`testSuite`**: Basic Test Suite that this test case belongs to. Refer to *[../type/entityReference.json](#/type/entityReference.json)*.
- **`testSuites`** *(array)*: Basic and Logical Test Suites this test case belongs to.
  - **Items**: Refer to *[./testSuite.json](#testSuite.json)*.
- **`parameterValues`** *(array)*
  - **Items**: Refer to *[#/definitions/testCaseParameterValue](#definitions/testCaseParameterValue)*.
- **`testCaseResult`**: Latest test case result obtained for this test case. Refer to *[./basic.json#/definitions/testCaseResult](#basic.json#/definitions/testCaseResult)*.
- **`testCaseStatus`**: Status of Test Case run. Refer to *[./basic.json#/definitions/testCaseStatus](#basic.json#/definitions/testCaseStatus)*.
- **`version`**: Metadata version of the entity. Refer to *[../type/entityHistory.json#/definitions/entityVersion](#/type/entityHistory.json#/definitions/entityVersion)*.
- **`owners`**: Owners of this Pipeline. Refer to *[../type/entityReferenceList.json](#/type/entityReferenceList.json)*. Default: `null`.
- **`updatedAt`**: Last update time corresponding to the new version of the entity in Unix epoch time milliseconds. Refer to *[../type/basic.json#/definitions/timestamp](#/type/basic.json#/definitions/timestamp)*.
- **`updatedBy`** *(string)*: User who made the update.
- **`href`**: Link to the resource corresponding to this entity. Refer to *[../type/basic.json#/definitions/href](#/type/basic.json#/definitions/href)*.
- **`changeDescription`**: Change that lead to this version of the entity. Refer to *[../type/entityHistory.json#/definitions/changeDescription](#/type/entityHistory.json#/definitions/changeDescription)*.
- **`deleted`** *(boolean)*: When `true` indicates the entity has been soft deleted. Default: `false`.
- **`computePassedFailedRowCount`** *(boolean)*: Compute the passed and failed row count for the test case. Default: `false`.
- **`incidentId`**: Reference to an ongoing Incident ID (stateId) for this test case. Refer to *[../type/basic.json#/definitions/uuid](#/type/basic.json#/definitions/uuid)*.
- **`failedRowsSample`**: Sample of failed rows for this test case. Refer to *[../entity/data/table.json#/definitions/tableData](#/entity/data/table.json#/definitions/tableData)*.
- **`inspectionQuery`**: SQL query to retrieve the failed rows for this test case. Refer to *[../type/basic.json#/definitions/sqlQuery](#/type/basic.json#/definitions/sqlQuery)*.
- **`domain`**: Domain the test case belongs to. When not set, the test case inherits the domain from the table it belongs to. Refer to *[../type/entityReference.json](#/type/entityReference.json)*.
- **`useDynamicAssertion`** *(boolean)*: If the test definition supports it, use dynamic assertion to evaluate the test case. Default: `false`.
- **`tags`** *(array)*: Tags for this test case. This is an inherited field from the parent entity and is not set directly on the test case. Default: `[]`.
  - **Items**: Refer to *[../type/tagLabel.json](#/type/tagLabel.json)*.
## Definitions

- **`testCaseParameterValue`** *(object)*: This schema defines the parameter values that can be passed for a Test Case.
  - **`name`** *(string)*: name of the parameter. Must match the parameter names in testCaseParameterDefinition.
  - **`value`** *(string)*: value to be passed for the Parameters. These are input from Users. We capture this in string and convert during the runtime.


Documentation file automatically generated at 2025-01-15 09:05:41.923720+00:00.
