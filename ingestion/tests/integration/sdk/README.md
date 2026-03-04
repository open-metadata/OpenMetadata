# SDK Integration Tests

These integration tests verify the SDK fluent API functionality with a running OpenMetadata server.

## Prerequisites

1. **Running OpenMetadata Server**: The tests require an OpenMetadata server running at `http://localhost:8585`
   ```bash
   # Start OpenMetadata server
   ./docker/run_local_docker.sh -m ui -d mysql
   ```

2. **Valid JWT Token**: The tests use the default admin JWT token configured in `_openmetadata_testutils/ometa.py`

## Running the Tests

### Run All SDK Integration Tests
```bash
# From the ingestion directory
pytest tests/integration/sdk/test_sdk_integration.py -v
```

### Run Specific Test
```bash
# Run a specific test class
pytest tests/integration/sdk/test_sdk_integration.py::TestSDKIntegration -v

# Run a specific test method
pytest tests/integration/sdk/test_sdk_integration.py::TestSDKIntegration::test_tables_crud_operations -v
```

### Run with Coverage
```bash
coverage run --rcfile pyproject.toml -m pytest tests/integration/sdk/ -v
coverage report
```

## Test Structure

The integration tests follow the existing OpenMetadata testing patterns:

1. **Fixtures**: Uses the `metadata` fixture from `conftest.py` which provides an authenticated OpenMetadata client
2. **Cleanup**: Each test includes proper cleanup to remove created entities
3. **Naming**: Test entities use unique names with UUID suffixes to avoid conflicts

## Tests Included

- **test_tables_crud_operations**: Tests CRUD operations for Tables entity
- **test_users_crud_operations**: Tests CRUD operations for Users entity
- **test_glossary_terms_workflow**: Tests Glossary and GlossaryTerms workflow
- **test_teams_workflow**: Tests Teams entity operations
- **test_list_all_with_pagination**: Tests automatic pagination in list_all method
- **test_database_schemas_operations**: Tests DatabaseSchemas entity operations

## Troubleshooting

1. **Server Not Running**: Ensure OpenMetadata server is running at localhost:8585
2. **Authentication Failed**: Check that the JWT token in `_openmetadata_testutils/ometa.py` is valid
3. **Port Conflicts**: If port 8585 is already in use, update the server URL in the tests

## Adding New Tests

To add new integration tests:

1. Create test methods in `test_sdk_integration.py`
2. Use the `metadata` fixture for OpenMetadata client
3. Set default client for SDK entities: `EntityClass.set_default_client(metadata)`
4. Include proper cleanup in try/finally blocks
5. Use unique names with UUID suffixes for test entities