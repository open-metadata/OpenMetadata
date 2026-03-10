# Connection Standards

## Two Connection Patterns

### Pattern 1: BaseConnection (Database SQLAlchemy)

```python
from sqlalchemy.engine import Engine

from metadata.generated.schema.entity.services.connections.database.myDbConnection import (
    MyDbConnection,
)
from metadata.ingestion.connections.connection import BaseConnection


class MyDbConnectionObj(BaseConnection[MyDbConnection, Engine]):
    def _get_client(self) -> Engine:
        return get_connection(self.service_connection)
```

`BaseConnection` provides:
- Automatic connection caching
- `client` property returning the engine
- Type-safe config access via `self.service_connection`

### Pattern 2: Functions (Non-Database & Non-SQLAlchemy Database)

```python
from metadata.generated.schema.entity.services.connections.dashboard.myDashConnection import (
    MyDashConnection,
)
from metadata.ingestion.connections.test_connections import test_connection_steps


def get_connection(connection: MyDashConnection):
    """Create and return a client for the service."""
    return MyDashClient(connection)


def test_connection(
    metadata,
    client,
    service_connection: MyDashConnection,
    automation_workflow=None,
) -> None:
    test_fn = {
        "CheckAccess": partial(test_access, client),
        "GetDashboards": partial(test_list_dashboards, client),
    }
    test_connection_steps(
        metadata=metadata,
        test_fn=test_fn,
        service_type=service_connection.type.value,
        automation_workflow=automation_workflow,
    )
```

## Test Connection Steps

The `test_fn` dict keys must exactly match the `name` field in the test connection JSON. Each function should:
- Take no arguments (use `functools.partial` to bind)
- Raise an exception on failure
- Return `None` on success

Common steps by service type:

| Service Type | Steps |
|---|---|
| Database | `CheckAccess`, `GetSchemas`, `GetTables`, `GetViews` (add `GetDatabases` for multi-database sources) |
| Dashboard | `CheckAccess`, `GetDashboards`, `GetCharts` |
| Pipeline | `CheckAccess`, `GetPipelines` |
| Messaging | `CheckAccess`, `GetTopics` |
| Storage | `CheckAccess`, `GetContainers` |

## Connection URL Building (SQLAlchemy)

Use `get_connection_url_common` for standard patterns, override for custom URL logic:

```python
from metadata.ingestion.connections.builders import (
    get_connection_url_common,
    init_empty_connection_arguments,
)

def get_connection(connection: MyDbConnection) -> Engine:
    url = get_connection_url_common(connection)
    connection_args = init_empty_connection_arguments(connection)
    return create_generic_db_connection(
        connection=connection,
        get_connection_url_fn=lambda _: url,
        get_connection_args_fn=lambda _: connection_args,
    )
```

## SSL Configuration (SonarQube Required)

SSL must be wired **end-to-end** — schema, connection handler, and client. Missing any layer triggers SonarQube Security Review failure.

### Step 1: JSON Schema

```json
"verifySSL": {
    "$ref": "../../../../security/ssl/verifySSLConfig.json#/definitions/verifySSL",
    "default": "no-ssl"
},
"sslConfig": {
    "$ref": "../../../../security/ssl/verifySSLConfig.json#/definitions/sslConfig"
}
```

### Step 2: connection.py — resolve SSL config

```python
from metadata.utils.ssl_registry import get_verify_ssl_fn

def get_connection(connection: MyDashConnection) -> MyDashClient:
    verify_ssl = None
    if connection.verifySSL:
        verify_ssl_fn = get_verify_ssl_fn(connection.verifySSL)
        verify_ssl = verify_ssl_fn(connection.sslConfig)
    return MyDashClient(connection, verify_ssl=verify_ssl)
```

The `ssl_registry` maps the `VerifySSL` enum:
- `no-ssl` → `None` (requests default behavior)
- `ignore` → `False` (skip certificate validation)
- `validate` → CA certificate path string from `sslConfig`

### Step 3: client.py — apply to session

```python
class MyDashClient:
    def __init__(self, config, verify_ssl=None):
        self.session = requests.Session()
        # ... auth setup ...
        if verify_ssl is not None:
            self.session.verify = verify_ssl
```

**References**: Grafana connector (`session.verify = self.verify_ssl`), Tableau connector (`SSLManager` pattern for temp cert files).

## Client Wrapper Pattern (Non-Database)

```python
class MyDashClient:
    def __init__(self, config: MyDashConnection, verify_ssl=None):
        self.config = config
        self._session = requests.Session()
        self._base_url = config.hostPort
        self._setup_auth()
        if verify_ssl is not None:
            self._session.verify = verify_ssl

    def _setup_auth(self):
        if self.config.token:
            self._session.headers["Authorization"] = (
                f"Bearer {self.config.token.get_secret_value()}"
            )

    def _get(self, endpoint: str, **kwargs):
        response = self._session.get(f"{self._base_url}{endpoint}", **kwargs)
        response.raise_for_status()
        return response.json()

    def test_access(self):
        """Raises on failure."""
        self._get("/api/v1/health")

    def get_dashboards(self) -> list:
        return list(self._paginate("/api/v1/dashboards"))
```
