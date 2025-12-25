# Added DataContract Integration Tests

## Summary

I have created the missing validation and entity constraint tests for DataContractResourceIT. The tests are stored in:

`/Users/harsha/Code/dev/OpenMetadata/openmetadata-integration-tests/src/test/java/org/openmetadata/it/tests/DataContractResourceIT_NewTests.java`

## Tests Added

### Validation Tests (7 tests)

1. **testValidateDataContractAbortRunningValidation** - Tests that a new validation request aborts a running validation
2. **testValidateDataContractWithFailingSemantics** - Tests validation with semantics rules that fail
3. **testValidateDataContractWithPassingSemantics** - Tests validation with semantics rules that pass
4. **testValidateDataContractWithPassingSemanticsAndDQExpectations** - Tests passing semantics with DQ expectations
5. **testValidateDataContractWithPassingSemanticsButFailingDQExpectations** - Tests passing semantics but failing DQ
6. **testValidateDataContractWithSchemaValidationFailure** - Tests schema validation failure when a field doesn't exist

### Entity Constraint Tests (5 tests)

7. **testTableEntityConstraints** - Tests that tables support all validation types (schema, semantics, quality)
8. **testTopicEntityConstraints** - Tests that topics support semantics but may not support schema validation without messageSchema
9. **testApiEndpointEntityConstraints** - Tests that API endpoints support semantics validation
10. **testDashboardEntityConstraints** - Tests that dashboards only support semantics (not schema or quality)
11. **testDashboardDataModelEntityConstraints** - Tests that dashboard data models support both schema and semantics validation

## Key Implementation Details

### Technologies Used
- **SDK Services**: Uses `SdkClients.adminClient().dataContracts()` for all data contract operations
- **Validation**: Uses the `validate()` method from DataContractService
- **Assertions**: Uses JUnit 5 assertions (assertEquals, assertNotNull, assertThrows, assertTrue)
- **Entity Creation**: Uses SDK fluent builders for creating test services and entities

### Test Patterns
- All tests use `TestNamespace` for generating unique names
- Tests create necessary services and entities using SDK fluent APIs
- Validation tests call `SdkClients.adminClient().dataContracts().validate(contractId)`
- Entity constraint tests verify proper error messages when unsupported features are used
- Tests verify that successful operations return proper results and failed operations throw exceptions

### Services Created
Tests create the following services as needed:
- **Database Service**: PostgresConnection for Table entities
- **Messaging Service**: KafkaConnection for Topic entities
- **API Service**: RestAPIConnection for APIEndpoint entities
- **Dashboard Service**: SupersetConnection for Dashboard and DashboardDataModel entities

## Next Steps

To add these tests to the main DataContractResourceIT.java file:

1. Open `/Users/harsha/Code/dev/OpenMetadata/openmetadata-integration-tests/src/test/java/org/openmetadata/it/tests/DataContractResourceIT.java`
2. Navigate to the end of the file (before the closing `}`)
3. Copy the contents from `DataContractResourceIT_NewTests.java`
4. Paste them before the final closing brace
5. Run `mvn spotless:apply` to format the Java code
6. Run the tests with `mvn test -Dtest=DataContractResourceIT`

## File Locations

- **Main IT file**: `/Users/harsha/Code/dev/OpenMetadata/openmetadata-integration-tests/src/test/java/org/openmetadata/it/tests/DataContractResourceIT.java`
- **New tests file**: `/Users/harsha/Code/dev/OpenMetadata/openmetadata-integration-tests/src/test/java/org/openmetadata/it/tests/DataContractResourceIT_NewTests.java`
- **Source tests**: `/Users/harsha/Code/dev/OpenMetadata/openmetadata-service/src/test/java/org/openmetadata/service/resources/data/DataContractResourceTest.java`

## Important Notes

1. The tests use the SDK's `validate()` method which calls the `/v1/dataContracts/{id}/validate` endpoint
2. Schema validation failures are tested by attempting to create contracts with non-existent fields
3. Entity constraint tests verify error messages match expected patterns for unsupported operations
4. All tests follow the existing BaseEntityIT pattern and use proper namespace isolation for concurrent execution
5. Tests include proper cleanup through the BaseEntityIT framework
