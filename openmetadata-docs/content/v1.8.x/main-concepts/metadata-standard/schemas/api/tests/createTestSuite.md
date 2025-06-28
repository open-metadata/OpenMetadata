---
title: Create Test Suite | OpenMetadata Test Suite API
slug: /main-concepts/metadata-standard/schemas/api/tests/createtestsuite
---

# CreateTestSuiteRequest

*Schema corresponding to a Test Suite*

## Properties

- **`name`**: Name that identifies this test suite. Refer to *[#/definitions/testSuiteEntityName](#definitions/testSuiteEntityName)*.
- **`displayName`** *(string)*: Display Name that identifies this test suite.
- **`description`**: Description of the test suite. Refer to *[../../type/basic.json#/definitions/markdown](#/../type/basic.json#/definitions/markdown)*.
- **`owners`**: Owners of this test suite. Refer to *[../../type/entityReferenceList.json](#/../type/entityReferenceList.json)*.
- **`basicEntityReference`**: Entity reference the test suite needs to execute the test against. Only applicable if the test suite is basic. Refer to *[../../type/basic.json#/definitions/fullyQualifiedEntityName](#/../type/basic.json#/definitions/fullyQualifiedEntityName)*.
- **`executableEntityReference`**: DEPRECATED in 1.6.2: use 'basicEntityReference'. Refer to *[../../type/basic.json#/definitions/fullyQualifiedEntityName](#/../type/basic.json#/definitions/fullyQualifiedEntityName)*.
- **`domain`** *(string)*: Fully qualified name of the domain the Table belongs to.
- **`tags`** *(array)*: Tags for this TestSuite. Default: `null`.
  - **Items**: Refer to *[../../type/tagLabel.json](#/../type/tagLabel.json)*.
## Definitions

- **`testSuiteEntityName`** *(string)*: Name of a test suite entity. For executable testSuite, this should match the entity FQN in the platform.


Documentation file automatically generated at 2025-01-15 09:05:41.923720+00:00.
