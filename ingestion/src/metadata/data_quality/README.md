# OpenMetadata Data Quality
## Structure
OpenMetadata data quality is structured around 3 componants:
1. Test Definition: a test definition is a generic definition describing a test (supported data types, platform is was created from (OM, dbt, etc.), parameter definition, etc.)
2. Test Case: a test case is the implementation of a specific test definition. It specifies the values parameters should respect for the test to pass or fail
3. Test Suite: a test suite is a logical or an executable container. Executable test suites are automatically created when you add a new test case to an entity. Logical test suite allow users to logically group together tests from different entity to create data contracts.

## Backend implementation
### Test Suite
#### Executable
Executable test suites are created (`POST`) / update (`PUT`) using the `/v1/dataQuality/testSuites/executable` endpoint. Executable test suite name should match that of an entity inside OpenMetadata. Trying to create an executable entity with an entity name not matching any assets inside the platform will throw an error. When creating a test case for the first time against an entity, an executable test suite will automatically be created.

#### Logical
Logical test suites are created (`POST`) / update (`PUT`) using the `/v1/dataQuality/testSuites` endpoint. Logical test suites allow user to group together multiple non-related existing test cases. Trying to create a new test case against a logical test suite will throw an error. Only existing test cases can be added to a logical test suite.

### Test Cases
#### Creating new test cases
New test cases are created using the `/v1/dataQuality/testCase` endpoint. New test cases can only be created against an executable test suite. Creating a new test case against a logical test suite will throw an error.

#### Adding/Removing existing test cases to logical test suites
Existing test cases are added (`PUT`) to logical test suites using the `/v1/dataQuality/testCase/logicalTestCases` endpoint with the below payload structure. 
```json
{
    "testSuiteId": 1234,
    "testCaseIds": [
        4567,
        8910
    ]

}
```
Only existing test cases can be added to a logical test suite. Trying to create a new case against a logical test suite will throw an error.

Test case are removed (`DELETE`) from a logical test suite using the `/logicalTestCases/{testSuiteId}/{id}` endpoint where `testSuiteId` is the ID of the logical test suite and `id` is the test case id.
