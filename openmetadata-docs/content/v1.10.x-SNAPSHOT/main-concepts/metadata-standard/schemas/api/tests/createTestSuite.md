---
title: createTestSuite
slug: /main-concepts/metadata-standard/schemas/api/tests/createtestsuite
---

# CreateTestSuiteRequest

*Schema corresponding to a Test Suite*

## Properties

- **`name`**: Name that identifies this test suite. Refer to *#/definitions/testSuiteEntityName*.
- **`displayName`** *(string)*: Display Name that identifies this test suite.
- **`description`**: Description of the test suite. Refer to *../../type/basic.json#/definitions/markdown*.
- **`owners`**: Owners of this test suite. Refer to *../../type/entityReferenceList.json*.
- **`basicEntityReference`**: Entity reference the test suite needs to execute the test against. Only applicable if the test suite is basic. Refer to *../../type/basic.json#/definitions/fullyQualifiedEntityName*.
- **`executableEntityReference`**: DEPRECATED in 1.6.2: use 'basicEntityReference'. Refer to *../../type/basic.json#/definitions/fullyQualifiedEntityName*.
- **`dataContract`**: Reference to the data contract that this test suite is associated with. Refer to *../../type/entityReference.json*. Default: `None`.
- **`domains`** *(array)*: Fully qualified names of the domains the Test Suite belongs to.
  - **Items** *(string)*
- **`tags`** *(array)*: Tags for this TestSuite. Default: `None`.
  - **Items**: Refer to *../../type/tagLabel.json*.
## Definitions

- **`testSuiteEntityName`** *(string)*: Name of a test suite entity. For executable testSuite, this should match the entity FQN in the platform.


Documentation file automatically generated at 2025-08-08 15:20:07.536378+00:00.
