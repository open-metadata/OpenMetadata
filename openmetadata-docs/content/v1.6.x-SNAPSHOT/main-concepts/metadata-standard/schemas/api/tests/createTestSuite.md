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
- **`owner`**: Owner of this test suite. Refer to *../../type/entityReference.json*.
- **`executableEntityReference`**: FQN of the entity the test suite is executed against. Only applicable for executable test suites. Refer to *../../type/basic.json#/definitions/fullyQualifiedEntityName*.
## Definitions

- **`testSuiteEntityName`** *(string)*: Name of a test suite entity. For executable testSuite, this should match the entity FQN in the platform.


Documentation file automatically generated at 2023-10-27 13:55:46.343512.
