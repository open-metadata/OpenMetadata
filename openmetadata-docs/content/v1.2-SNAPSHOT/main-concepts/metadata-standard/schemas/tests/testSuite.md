---
title: testSuite
slug: /main-concepts/metadata-standard/schemas/tests/testsuite
---

# TestSuite

*TestSuite is a set of test cases grouped together to capture data quality tests against data entities.*

## Properties

- **`id`**: Unique identifier of this test suite instance. Refer to *../type/basic.json#/definitions/uuid*.
- **`name`**: Name that identifies this test suite. Refer to *../api/tests/createTestSuite.json#/definitions/testSuiteEntityName*.
- **`displayName`** *(string)*: Display Name that identifies this test suite.
- **`fullyQualifiedName`**: FullyQualifiedName same as `name`. Refer to *../type/basic.json#/definitions/fullyQualifiedEntityName*.
- **`description`**: Description of the test suite. Refer to *../type/basic.json#/definitions/markdown*.
- **`tests`** *(array)*: Default: `None`.
  - **Items**: Refer to *../type/entityReference.json*.
- **`connection`**: Refer to *#/definitions/testSuiteConnection*.
- **`testConnectionResult`**: Refer to *../entity/services/connections/testConnectionResult.json*.
- **`pipelines`**: References to pipelines deployed for this database service to extract metadata, usage, lineage etc.. Refer to *../type/entityReferenceList.json#/definitions/entityReferenceList*. Default: `None`.
- **`serviceType`** *(string)*: Type of database service such as MySQL, BigQuery, Snowflake, Redshift, Postgres... Must be one of: `['TestSuite']`. Default: `TestSuite`.
- **`owner`**: Owner of this TestCase definition. Refer to *../type/entityReference.json*. Default: `None`.
- **`version`**: Metadata version of the entity. Refer to *../type/entityHistory.json#/definitions/entityVersion*.
- **`updatedAt`**: Last update time corresponding to the new version of the entity in Unix epoch time milliseconds. Refer to *../type/basic.json#/definitions/timestamp*.
- **`updatedBy`** *(string)*: User who made the update.
- **`href`**: Link to the resource corresponding to this entity. Refer to *../type/basic.json#/definitions/href*.
- **`changeDescription`**: Change that lead to this version of the entity. Refer to *../type/entityHistory.json#/definitions/changeDescription*.
- **`deleted`** *(boolean)*: When `true` indicates the entity has been soft deleted. Default: `False`.
- **`executable`** *(boolean)*: Indicates if the test suite is executable. Set on the backend. Default: `False`.
- **`executableEntityReference`**: Entity reference the test suite is executed against. Only applicable if the test suite is executable. Refer to *../type/entityReference.json*.
- **`summary`**: Summary of the previous day test cases execution for this test suite. Refer to *./basic.json#/definitions/testSummary*.
## Definitions

- **`testSuiteConnection`** *(object)*
  - **`config`** *(null)*


Documentation file automatically generated at 2023-07-07 05:50:35.981927.
