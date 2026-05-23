# Prefect Integration Tests

Integration tests for the Prefect connector that verify pipeline metadata, status, and lineage ingestion.

## Prerequisites

1. **Docker** installed and running
2. **OpenMetadata server** running at `localhost:8585`
3. **Python environment** with OpenMetadata ingestion dependencies installed

## What These Tests Do

The integration tests:

1. **Spin up a Prefect server** in Docker (`prefecthq/prefect:3-latest`)
2. **Create test flows** with lineage tags via Prefect API
3. **Run the Prefect connector** to ingest metadata
4. **Verify** that:
   - Pipelines are created in OpenMetadata
   - Pipeline statuses are ingested (if runs exist)
   - Tag-based lineage creates proper edges between tables

## Running the Tests

### Option 1: Run all Prefect integration tests

```bash
cd /workspaces/OpenMetadata/ingestion
pytest tests/integration/prefect/ -v
```

### Option 2: Run specific test

```bash
cd /workspaces/OpenMetadata/ingestion
pytest tests/integration/prefect/test_prefect_lineage.py::PrefectLineageTest::test_pipeline_ingestion -v
```

### Option 3: Run with custom OpenMetadata server

```bash
export OM_HOST_PORT="http://your-om-server:8585/api"
export OM_JWT="your-jwt-token"
pytest tests/integration/prefect/ -v
```

## Test Structure

```
tests/integration/prefect/
├── __init__.py
├── conftest.py                    # Fixtures (prefect_server, om_config)
├── test_prefect_lineage.py        # Main integration tests
└── README.md                      # This file
```

## Fixtures

### `prefect_server` (conftest.py)

- Starts Prefect server in Docker on port 4200
- Waits for server to be healthy
- Yields the API URL (`http://localhost:4200/api`)
- Cleans up container after tests

### `om_config` (conftest.py)

- Provides OpenMetadata workflow configuration
- Uses the `prefect_server` fixture for hostPort
- Configures connector for self-hosted mode (no API key needed)

## Test Cases

### `test_create_flows_in_prefect`

Creates test flows in Prefect with lineage tags:
- `test-integration-flow` with `om-source:` and `om-destination:` tags
- `test-simple-flow` without lineage tags

### `test_pipeline_ingestion`

Verifies that:
- Connector successfully ingests pipelines from Prefect
- Pipelines appear in OpenMetadata with correct FQNs
- Pipeline metadata (name, tags) is preserved

### `test_pipeline_status_ingestion`

Verifies that:
- Connector fetches pipeline run history
- Status information is ingested (if runs exist)
- Connector doesn't crash if no runs exist

### `test_lineage_from_tags`

Verifies that:
- Flows with `om-source:` and `om-destination:` tags create lineage
- Lineage edges connect the correct tables
- Pipeline is referenced in lineage details

## Troubleshooting

### Docker not found

```
Error: docker: command not found
```

**Solution**: Install Docker and ensure it's in your PATH.

### Prefect server won't start

```
RuntimeError: Prefect server did not start in time
```

**Solution**: 
- Check Docker is running: `docker ps`
- Check port 4200 is not in use: `lsof -i :4200`
- Increase timeout in `conftest.py` if your system is slow

### OpenMetadata connection failed

```
Error: Could not connect to OpenMetadata server
```

**Solution**:
- Ensure OpenMetadata is running: `curl http://localhost:8585/api/v1/system/version`
- Check JWT token is valid
- Set correct `OM_HOST_PORT` and `OM_JWT` environment variables

### Tests pass but lineage not created

This is expected if:
- Tables don't exist in OpenMetadata before running the connector
- FQNs in tags don't match actual table FQNs
- The test creates tables in `setUpClass` but lineage requires exact FQN match

**Solution**: The test creates tables first, then runs connector. If lineage still doesn't appear, check:
```python
# Verify table FQNs match tag FQNs exactly
source_fqn = "test-service-prefect-lineage.test-db.test-schema.prefect-lineage-source"
```

## CI/CD Integration

These tests are designed to run in CI/CD pipelines:

```yaml
# Example GitHub Actions
- name: Run Prefect Integration Tests
  run: |
    docker pull prefecthq/prefect:3-latest
    cd ingestion
    pytest tests/integration/prefect/ -v
  env:
    OM_HOST_PORT: http://localhost:8585/api
    OM_JWT: ${{ secrets.OM_JWT_TOKEN }}
```

## Notes

- Tests use module-scoped fixtures to minimize Docker container restarts
- Each test is independent and can run in isolation
- Cleanup happens automatically in `tearDownClass`
- Tests work with both Prefect Cloud and self-hosted Prefect Server
