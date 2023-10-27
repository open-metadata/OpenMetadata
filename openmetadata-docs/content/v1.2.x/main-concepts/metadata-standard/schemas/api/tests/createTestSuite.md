---
title: createTestSuite
slug: /main-concepts/metadata-standard/schemas/api/tests/createtestsuite
---

# CreateTestSuiteRequest

*Schema corresponding to a Test Suite*

## Properties

- **`name`**: Name that identifies this test suite. Refer to *[#/definitions/testSuiteEntityName](#definitions/testSuiteEntityName)*.
- **`displayName`** *(string)*: Display Name that identifies this test suite.
- **`description`**: Description of the test suite. Refer to *[../../type/basic.json#/definitions/markdown](#/../type/basic.json#/definitions/markdown)*.
- **`owner`**: Owner of this test suite. Refer to *[../../type/entityReference.json](#/../type/entityReference.json)*.
- **`executableEntityReference`**: FQN of the entity the test suite is executed against. Only applicable for executable test suites. Refer to *[../../type/basic.json#/definitions/fullyQualifiedEntityName](#/../type/basic.json#/definitions/fullyQualifiedEntityName)*.
## Definitions

- <a id="definitions/testSuiteEntityName"></a>**`testSuiteEntityName`** *(string)*: Name of a test suite entity. For executable testSuite, this should match the entity FQN in the platform.


Documentation file automatically generated at 2023-10-27 11:39:15.608628.
