# ServiceSpec Standards

## What ServiceSpec Does

The ServiceSpec tells the framework how to load a connector. It maps capabilities to their implementing classes.

The framework resolves it at: `metadata.ingestion.source.{service_type}.{name}.service_spec.ServiceSpec`

## Database Connectors

Use `DefaultDatabaseSpec`, which pre-wires profiler, sampler, and test suite:

```python
from metadata.ingestion.source.database.my_db.connection import MyDbConnectionObj
from metadata.ingestion.source.database.my_db.lineage import MyDbLineageSource
from metadata.ingestion.source.database.my_db.metadata import MyDbSource
from metadata.ingestion.source.database.my_db.usage import MyDbUsageSource
from metadata.utils.service_spec.default import DefaultDatabaseSpec

ServiceSpec = DefaultDatabaseSpec(
    metadata_source_class=MyDbSource,
    lineage_source_class=MyDbLineageSource,     # Only if lineage capability
    usage_source_class=MyDbUsageSource,          # Only if usage capability
    connection_class=MyDbConnectionObj,          # Only for SQLAlchemy connectors
)
```

`DefaultDatabaseSpec` automatically provides:
- `profiler_class` → `SQAProfilerInterface`
- `sampler_class` → `SQASampler`
- `test_suite_class` → `SQATestSuiteInterface`
- `data_diff` → `BaseTableParameter`

### Non-SQLAlchemy Database

For REST/SDK database connectors (e.g., Salesforce), omit `connection_class`:

```python
ServiceSpec = DefaultDatabaseSpec(
    metadata_source_class=MyRestDbSource,
)
```

## Non-Database Connectors

Use `BaseSpec` with only the metadata source class:

```python
from metadata.ingestion.source.dashboard.my_dash.metadata import MyDashSource
from metadata.utils.service_spec import BaseSpec

ServiceSpec = BaseSpec(metadata_source_class=MyDashSource)
```

This applies to: dashboard, pipeline, messaging, mlmodel, storage, search, api.

## Rules

1. The variable MUST be named `ServiceSpec` (exact casing)
2. The module MUST be named `service_spec.py`
3. Import paths must use the full module path
4. Do not add extra capabilities that the connector doesn't support
5. `connection_class` is only for `BaseConnection` subclasses (SQLAlchemy pattern)
