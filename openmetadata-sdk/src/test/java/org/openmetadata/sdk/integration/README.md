# Integration Tests

The `.java.disabled` files in this directory are integration tests that require a running OpenMetadata server, database, and search infrastructure.

## Test Strategy

### Mock Tests (In SDK)
The SDK uses mock tests (similar to Stripe's Java SDK) to verify SDK behavior without requiring a running server. These tests:
- Use Mockito to mock the OpenMetadataClient and service APIs
- Verify that the SDK correctly transforms requests and responses
- Test error handling and edge cases
- Run quickly as part of the build process

See examples:
- `TableMockTest.java` - Mock tests for Table entity operations
- `DatabaseServiceMockTest.java` - Mock tests for DatabaseService operations
- `OMMockTest.java` - Mock tests for the OM wrapper

### Integration Tests (In openmetadata-service)
Real integration tests that require a running server should be placed in the `openmetadata-service` module where they can:
- Use `EntityResourceTest` as a base class
- Have access to the full test infrastructure
- Run against a real database and search engine
- Test end-to-end workflows

To enable these tests for running in openmetadata-service:
1. Move the `.java.disabled` files to `openmetadata-service/src/test/java/org/openmetadata/service/resources/`
2. Extend `EntityResourceTest` instead of `BaseSDKTest`
3. Use the test infrastructure provided by openmetadata-service

## Running Mock Tests

```bash
# Run all SDK mock tests
mvn test

# Run specific mock test
mvn test -Dtest=TableMockTest
```

## Benefits of This Approach

1. **Fast Feedback**: Mock tests run quickly without external dependencies
2. **Reliable**: No flaky tests due to network or server issues
3. **Complete Coverage**: Can test error conditions and edge cases easily
4. **CI/CD Friendly**: Tests can run in any environment without setup
5. **Clear Separation**: SDK tests verify SDK behavior, service tests verify server behavior