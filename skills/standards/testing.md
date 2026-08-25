# Testing Standards

## Philosophy

- **Test real behavior, not mock wiring.** If a test requires mocking 3+ classes just to verify a method call, write an integration test instead.
- **Use pytest, not unittest.** Plain `assert` statements, pytest fixtures, no `TestCase` inheritance.
- **Mocks are for boundaries.** Mock external services (HTTP clients, SDKs), not internal classes.

## Unit Tests

Location: `ingestion/tests/unit/topology/{service_type}/test_{name}.py`

### Structure

```python
"""Tests for {Name} connector"""
import json
from unittest.mock import patch

import pytest

from metadata.generated.schema.entity.services.connections.{service_type}.{module_name}Connection import (
    {Name}Connection,
)
from metadata.generated.schema.metadataIngestion.workflow import (
    OpenMetadataWorkflowConfig,
)

MOCK_CONFIG = {
    "source": {
        "type": "{Name}",
        "serviceName": "test_{name}",
        "serviceConnection": {
            "config": {
                "type": "{Name}",
                # Minimum required fields for the connection config
            }
        },
        "sourceConfig": {
            "config": {
                "type": "{MetadataType}"  # e.g., DatabaseMetadata, DashboardMetadata
            }
        },
    },
    "sink": {"type": "metadata-rest", "config": {}},
    "workflowConfig": {
        "openMetadataServerConfig": {
            "hostPort": "http://localhost:8585/api",
            "authProvider": "openmetadata",
            "securityConfig": {"jwtToken": "test-token"},
        }
    },
}


class TestSource:
    @patch("metadata.ingestion.source.{service_type}.{name}.connection.test_connection")
    @patch("metadata.ingestion.source.{service_type}.{name}.connection.get_connection")
    def test_create_source(self, mock_get_conn, mock_test_conn):
        config = OpenMetadataWorkflowConfig.model_validate(MOCK_CONFIG)
        # Verify the source can be instantiated from config
        assert config.source.type.value == "{Name}"
```

### sourceConfig Types by Service Type

| Service Type | `sourceConfig.config.type` |
|---|---|
| database | `DatabaseMetadata` |
| dashboard | `DashboardMetadata` |
| pipeline | `PipelineMetadata` |
| messaging | `MessagingMetadata` |
| mlmodel | `MlModelMetadata` |
| storage | `StorageMetadata` |
| search | `SearchMetadata` |
| api | `ApiMetadata` |

### What to Test

- Config validation: Valid config creates source, invalid config raises
- Connection: `get_connection()` returns expected client type
- Entity extraction: Mock API responses → verify correct entities yielded
- Error handling: Bad API responses → verify `Either(left=StackTraceError)` yielded
- Filter patterns: Verify entities matching exclude patterns are skipped

## Integration Tests

### Connection Test

Location: `ingestion/tests/integration/connections/test_{name}_connection.py`

Tests that the connection can be established against a real or containerized service. Uses `testcontainers` when a Docker image is available.

### Metadata Integration Test

Location: `ingestion/tests/integration/{name}/`

```
{name}/
├── conftest.py         # Container fixtures, service creation
└── test_metadata.py    # Run MetadataWorkflow, verify entities created
```

`conftest.py` pattern:
```python
import pytest
from testcontainers.core.container import DockerContainer

@pytest.fixture(scope="module")
def container():
    with DockerContainer("image:tag").with_exposed_ports(PORT) as container:
        # Wait for readiness
        yield container

@pytest.fixture(scope="module")
def create_service_request(container):
    host = container.get_container_host_ip()
    port = container.get_exposed_port(PORT)
    return {
        "name": "test_{name}",
        "serviceType": "{Name}",
        "connection": {
            "config": {
                "type": "{Name}",
                "hostPort": f"{host}:{port}",
            }
        },
    }
```

## Assertions

Use plain pytest assertions:

```python
assert result is not None
assert result.name == expected_name
assert len(items) == 3
assert "error" in str(exc.value)
```

Never use `self.assertEqual`, `self.assertIsNone`, or other unittest assertion methods.

## Fixtures Over Setup/Teardown

Use `@pytest.fixture` instead of `setUp`/`tearDown`:

```python
@pytest.fixture
def mock_client():
    with patch("metadata.ingestion.source.dashboard.my_dash.client.MyDashClient") as mock:
        mock.return_value.get_dashboards.return_value = [{"id": 1, "name": "test"}]
        yield mock.return_value
```

## Test Naming

- Test files: `test_{name}.py`
- Test classes: `TestSource`, `TestConnection`, `TestClient`
- Test methods: `test_create_source`, `test_yield_dashboard`, `test_connection_failure`
