---
title: testDefinition | OpenMetadata Test Definition
slug: /main-concepts/metadata-standard/schemas/tests/testdefinition
---

# TestDefinition

*Test Definition is a type of test using which test cases are created to capture data quality tests against data entities.*

## Properties

- **`id`**: Unique identifier of this test case definition instance. Refer to *[../type/basic.json#/definitions/uuid](#/type/basic.json#/definitions/uuid)*.
- **`name`**: Name that identifies this test case. Refer to *[../type/basic.json#/definitions/testCaseEntityName](#/type/basic.json#/definitions/testCaseEntityName)*.
- **`displayName`** *(string)*: Display Name that identifies this test case.
- **`fullyQualifiedName`**: FullyQualifiedName same as `name`. Refer to *[../type/basic.json#/definitions/fullyQualifiedEntityName](#/type/basic.json#/definitions/fullyQualifiedEntityName)*.
- **`description`**: Description of the testcase. Refer to *[../type/basic.json#/definitions/markdown](#/type/basic.json#/definitions/markdown)*.
- **`entityType`**: Refer to *[#/definitions/entityType](#definitions/entityType)*.
- **`testPlatforms`** *(array)*
  - **Items**: Refer to *[#/definitions/testPlatform](#definitions/testPlatform)*.
- **`supportedDataTypes`** *(array)*
  - **Items**: Refer to *[../entity/data/table.json#/definitions/dataType](#/entity/data/table.json#/definitions/dataType)*.
- **`parameterDefinition`** *(array)*
  - **Items**: Refer to *[#/definitions/testCaseParameterDefinition](#definitions/testCaseParameterDefinition)*.
- **`dataQualityDimension`**: Refer to *[#/definitions/dataQualityDimensions](#definitions/dataQualityDimensions)*.
- **`owners`**: Owners of this TestCase definition. Refer to *[../type/entityReferenceList.json](#/type/entityReferenceList.json)*. Default: `null`.
- **`provider`**: Refer to *[../type/basic.json#/definitions/providerType](#/type/basic.json#/definitions/providerType)*.
- **`version`**: Metadata version of the entity. Refer to *[../type/entityHistory.json#/definitions/entityVersion](#/type/entityHistory.json#/definitions/entityVersion)*.
- **`updatedAt`**: Last update time corresponding to the new version of the entity in Unix epoch time milliseconds. Refer to *[../type/basic.json#/definitions/timestamp](#/type/basic.json#/definitions/timestamp)*.
- **`updatedBy`** *(string)*: User who made the update.
- **`href`**: Link to the resource corresponding to this entity. Refer to *[../type/basic.json#/definitions/href](#/type/basic.json#/definitions/href)*.
- **`changeDescription`**: Change that lead to this version of the entity. Refer to *[../type/entityHistory.json#/definitions/changeDescription](#/type/entityHistory.json#/definitions/changeDescription)*.
- **`deleted`** *(boolean)*: When `true` indicates the entity has been soft deleted. Default: `false`.
- **`supportsRowLevelPassedFailed`** *(boolean)*: When `true` indicates the test case supports row level passed/failed. Default: `false`.
- **`domain`**: Domain the asset belongs to. When not set, the asset inherits the domain from the parent it belongs to. Refer to *[../type/entityReference.json](#/type/entityReference.json)*.
- **`supportsDynamicAssertion`** *(boolean)*: When `true` indicates the test case supports dynamic assertions. Default: `false`.
## Definitions

- **`testPlatform`** *(string)*: This schema defines the platform where tests are defined and ran. Must be one of: `["OpenMetadata", "GreatExpectations", "DBT", "Deequ", "Soda", "Other"]`.
- **`testDataType`** *(string)*: This enum defines the type of data stored in a column. Must be one of: `["NUMBER", "INT", "FLOAT", "DOUBLE", "DECIMAL", "TIMESTAMP", "TIME", "DATE", "DATETIME", "ARRAY", "MAP", "SET", "STRING", "BOOLEAN"]`.
- **`entityType`** *(string)*: This enum defines the type for which this test definition applies to. Must be one of: `["TABLE", "COLUMN"]`.
- **`testCaseParameterDefinition`** *(object)*: This schema defines the parameters that can be passed for a Test Case.
  - **`name`** *(string)*: name of the parameter.
  - **`displayName`** *(string)*: Display Name that identifies this parameter name.
  - **`dataType`**: Data type of the parameter (int, date etc.). Refer to *[#/definitions/testDataType](#definitions/testDataType)*.
  - **`description`**: Description of the parameter. Refer to *[../type/basic.json#/definitions/markdown](#/type/basic.json#/definitions/markdown)*.
  - **`required`** *(boolean)*: Is this parameter required. Default: `false`.
  - **`optionValues`** *(array)*: List of values that can be passed for this parameter. Default: `[]`.
  - **`validationRule`** *(object)*: Validation for the test parameter value.
    - **`parameterField`** *(string)*: Name of the parameter to validate against.
    - **`rule`** *(string)*: This enum defines the type to use for a parameter validation rule. Must be one of: `["EQUALS", "NOT_EQUALS", "GREATER_THAN_OR_EQUALS", "LESS_THAN_OR_EQUALS"]`.
- **`dataQualityDimensions`** *(string)*: This enum defines the dimension a test case belongs to. Must be one of: `["Completeness", "Accuracy", "Consistency", "Validity", "Uniqueness", "Integrity", "SQL"]`.


Documentation file automatically generated at 2025-01-15 09:05:41.923720+00:00.
