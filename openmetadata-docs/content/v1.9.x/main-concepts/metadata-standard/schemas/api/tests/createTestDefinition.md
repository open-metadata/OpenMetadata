---
title: Create Test Definition | OpenMetadata Test Definition
description: Define a test definition to establish the logic and rules used in test cases across datasets and pipelines.
slug: /main-concepts/metadata-standard/schemas/api/tests/createtestdefinition
---

# CreateTestDefinitionRequest

*Schema corresponding to a Test Definition*

## Properties

- **`name`**: Name that identifies this test case. Refer to *[../../type/basic.json#/definitions/testCaseEntityName](#/../type/basic.json#/definitions/testCaseEntityName)*.
- **`displayName`** *(string)*: Display Name that identifies this test case.
- **`description`**: Description of the testcase. Refer to *[../../type/basic.json#/definitions/markdown](#/../type/basic.json#/definitions/markdown)*.
- **`owners`**: Owners of this TestCase definition. Refer to *[../../type/entityReferenceList.json](#/../type/entityReferenceList.json)*.
- **`entityType`**: Refer to *[../../tests/testDefinition.json#/definitions/entityType](#/../tests/testDefinition.json#/definitions/entityType)*.
- **`testPlatforms`** *(array)*
  - **Items**: Refer to *[../../tests/testDefinition.json#/definitions/testPlatform](#/../tests/testDefinition.json#/definitions/testPlatform)*.
- **`supportedDataTypes`** *(array)*
  - **Items**: Refer to *[../../entity/data/table.json#/definitions/dataType](#/../entity/data/table.json#/definitions/dataType)*.
- **`provider`**: Refer to *[../../type/basic.json#/definitions/providerType](#/../type/basic.json#/definitions/providerType)*.
- **`parameterDefinition`** *(array)*
  - **Items**: Refer to *[../../tests/testDefinition.json#/definitions/testCaseParameterDefinition](#/../tests/testDefinition.json#/definitions/testCaseParameterDefinition)*.
- **`domain`** *(string)*: Fully qualified name of the domain the Table belongs to.


Documentation file automatically generated at 2025-01-15 09:05:41.923720+00:00.
