# Connector Patterns

## Error Handling

### Connection Errors
Always wrap connection creation in try/except and raise meaningful errors:

```python
from metadata.ingestion.ometa.utils import _get_connection_error

try:
    engine = create_engine(url)
    engine.connect()
except Exception as exc:
    raise _get_connection_error(exc) from exc
```

### Source Errors
Use `Either` for error handling in yield methods. Never swallow exceptions silently:

```python
from metadata.ingestion.api.models import Either
from metadata.utils.logger import ingestion_logger

logger = ingestion_logger()

def yield_dashboard(self, dashboard_details):
    try:
        yield Either(right=CreateDashboardRequest(...))
    except Exception as exc:
        yield Either(
            left=StackTraceError(
                name=dashboard_details.get("name", "Unknown"),
                error=f"Error creating dashboard: {exc}",
                stackTrace=traceback.format_exc(),
            )
        )
```

### Test Connection Errors
Each test step should raise on failure — the framework catches and reports:

```python
def test_fn(connection) -> dict:
    return {
        "CheckAccess": partial(test_access, connection),
        "GetDatabases": partial(test_list_databases, connection),
    }
```

## Logging

Use the ingestion logger, not the standard library logger:

```python
from metadata.utils.logger import ingestion_logger
logger = ingestion_logger()
```

Log at appropriate levels:
- `logger.debug()` — Per-entity processing details
- `logger.info()` — Workflow milestones (start, complete, counts)
- `logger.warning()` — Recoverable issues (skipped entities, fallbacks)
- `logger.error()` — Unrecoverable issues (use with `traceback.format_exc()`)

## Pagination

### REST API Pagination
Implement pagination as a generator:

```python
def _paginate(self, endpoint: str):
    offset = 0
    while True:
        response = self._get(endpoint, params={"offset": offset, "limit": self.PAGE_SIZE})
        items = response.get("data", [])
        if not items:
            break
        yield from items
        offset += len(items)
```

### Cursor-Based Pagination
```python
def _paginate_cursor(self, endpoint: str):
    cursor = None
    while True:
        params = {"limit": self.PAGE_SIZE}
        if cursor:
            params["cursor"] = cursor
        response = self._get(endpoint, params=params)
        yield from response.get("data", [])
        cursor = response.get("next_cursor")
        if not cursor:
            break
```

## Authentication

### Map to Shared Schemas
Always use existing `$ref` schemas rather than defining custom auth fields:

| Auth Type | Schema `$ref` |
|-----------|--------------|
| Username/password | `./common/basicAuth.json` |
| AWS IAM | `./common/iamAuthConfig.json` |
| Azure AD | `./common/azureConfig.json` |
| JWT token | `./common/jwtAuth.json` |
| API token | Custom `token` string property |
| OAuth2 | Custom properties or existing OAuth refs |

### Token Injection
For REST clients, inject auth in the session:

```python
def __init__(self, config):
    self.session = requests.Session()
    if config.token:
        self.session.headers["Authorization"] = f"Bearer {config.token.get_secret_value()}"
    elif config.basicAuth:
        self.session.auth = (config.basicAuth.username, config.basicAuth.password.get_secret_value())
```

## Filter Patterns

Support standard filter patterns via `$ref` in the JSON Schema:

```json
"databaseFilterPattern": {
    "$ref": "../../../../type/filterPattern.json#/definitions/filterPattern"
}
```

Apply filters using the framework utility:

```python
from metadata.utils.filters import filter_by_fqn
if filter_by_fqn(entity_fqn, self.source_config.schemaFilterPattern):
    continue
```

## Yields and Topology

Non-database connectors yield entities in topology order:

```
Dashboard connectors:  yield_dashboard → yield_dashboard_chart → yield_dashboard_lineage_details
Pipeline connectors:   yield_pipeline → yield_pipeline_status → yield_pipeline_lineage_details
Messaging connectors:  yield_topic → yield_topic_sample_data
```

Each yield method is a generator that produces `Either[StackTraceError, CreateEntityRequest]`.

## Secrets

Never log or expose secrets. Use Pydantic `SecretStr` for sensitive fields:

```json
"password": {
    "title": "Password",
    "type": "string",
    "format": "password"
}
```

The `format: "password"` marker tells the UI to mask the field and the framework to handle it as a secret.
