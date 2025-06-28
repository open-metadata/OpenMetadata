---
title: testSuite
slug: /main-concepts/metadata-standard/schemas/tests/testsuite
---

# TestSuite

*TestSuite is a set of test cases grouped together to capture data quality tests against data entities.*

## Properties

- **`id`**: Unique identifier of this test suite instance. Refer to *[../type/basic.json#/definitions/uuid](#/type/basic.json#/definitions/uuid)*.
- **`name`**: Name that identifies this test suite. Refer to *[../api/tests/createTestSuite.json#/definitions/testSuiteEntityName](#/api/tests/createTestSuite.json#/definitions/testSuiteEntityName)*.
- **`displayName`** *(string)*: Display Name that identifies this test suite.
- **`fullyQualifiedName`**: FullyQualifiedName same as `name`. Refer to *[../type/basic.json#/definitions/fullyQualifiedEntityName](#/type/basic.json#/definitions/fullyQualifiedEntityName)*.
- **`description`**: Description of the test suite. Refer to *[../type/basic.json#/definitions/markdown](#/type/basic.json#/definitions/markdown)*.
- **`tests`** *(array)*: Default: `null`.
  - **Items**: Refer to *[../type/entityReference.json](#/type/entityReference.json)*.
- **`connection`**: TestSuite mock connection, since it needs to implement a Service. Refer to *[#/definitions/testSuiteConnection](#definitions/testSuiteConnection)*.
- **`testConnectionResult`**: Result of the test connection. Refer to *[../entity/services/connections/testConnectionResult.json](#/entity/services/connections/testConnectionResult.json)*.
- **`pipelines`**: References to pipelines deployed for this Test Suite to execute the tests. Refer to *[../type/entityReferenceList.json](#/type/entityReferenceList.json)*. Default: `null`.
- **`serviceType`** *(string)*: Type of database service such as MySQL, BigQuery, Snowflake, Redshift, Postgres... Must be one of: `["TestSuite"]`. Default: `"TestSuite"`.
- **`owners`**: Owners of this TestCase definition. Refer to *[../type/entityReferenceList.json](#/type/entityReferenceList.json)*. Default: `null`.
- **`version`**: Metadata version of the entity. Refer to *[../type/entityHistory.json#/definitions/entityVersion](#/type/entityHistory.json#/definitions/entityVersion)*.
- **`updatedAt`**: Last update time corresponding to the new version of the entity in Unix epoch time milliseconds. Refer to *[../type/basic.json#/definitions/timestamp](#/type/basic.json#/definitions/timestamp)*.
- **`updatedBy`** *(string)*: User who made the update.
- **`href`**: Link to the resource corresponding to this entity. Refer to *[../type/basic.json#/definitions/href](#/type/basic.json#/definitions/href)*.
- **`changeDescription`**: Change that lead to this version of the entity. Refer to *[../type/entityHistory.json#/definitions/changeDescription](#/type/entityHistory.json#/definitions/changeDescription)*.
- **`deleted`** *(boolean)*: When `true` indicates the entity has been soft deleted. Default: `false`.
- **`basic`** *(boolean)*: Indicates if the test suite is basic, i.e., the parent suite of a test and linked to an entity. Set on the backend. Default: `false`.
- **`executable`** *(boolean)*: DEPRECATED in 1.6.2: Use 'basic'.
- **`basicEntityReference`**: Entity reference the test suite needs to execute the test against. Only applicable if the test suite is basic. Refer to *[../type/entityReference.json](#/type/entityReference.json)*.
- **`executableEntityReference`**: DEPRECATED in 1.6.2: Use 'basicEntityReference'. Refer to *[../type/entityReference.json](#/type/entityReference.json)*.
- **`summary`**: Summary of the previous day test cases execution for this test suite. Refer to *[./basic.json#/definitions/testSummary](#basic.json#/definitions/testSummary)*.
- **`testCaseResultSummary`** *(array)*: Summary of test case execution.
  - **Items**: Refer to *[#/definitions/testSuiteConnection/resultSummary](#definitions/testSuiteConnection/resultSummary)*.
- **`domain`**: Domain the test Suite belongs to. When not set, the test Suite inherits the domain from the table it belongs to. Refer to *[../type/entityReference.json](#/type/entityReference.json)*.
- **`tags`** *(array)*: Tags for this test suite. This is an inherited field from the parent entity if the testSuite is native. Default: `[]`.
  - **Items**: Refer to *[../type/tagLabel.json](#/type/tagLabel.json)*.
- **`inherited`** *(boolean)*: Indicates if the test suite is inherited from a parent entity. Default: `false`.
## Definitions

- **`testSuiteConnection`** *(object)*
  - **`config`** *(null)*


Documentation file automatically generated at 2025-01-15 09:05:41.923720+00:00.
