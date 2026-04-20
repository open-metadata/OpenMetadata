# Capability Mapping

## Capabilities by Service Type

| Capability | Database | Dashboard | Pipeline | Messaging | ML Model | Storage | Search | API |
|-----------|----------|-----------|----------|-----------|----------|---------|--------|-----|
| `metadata` | Always | Always | Always | Always | Always | Always | Always | Always |
| `lineage` | If query logs | If dashboard→table | If task→table | — | — | — | — | — |
| `usage` | If query logs | If view counts | — | — | — | — | — | — |
| `profiler` | If SQLAlchemy | — | — | — | — | — | — | — |
| `stored_procedures` | If supported | — | — | — | — | — | — | — |
| `data_diff` | If SQLAlchemy | — | — | — | — | — | — | — |
| `dbt` | If SQLAlchemy | — | — | — | — | — | — | — |
| `query_comment` | If SQLAlchemy | — | — | — | — | — | — | — |

## Capability → JSON Schema Flags

Each capability maps to a `$ref` in the connection schema:

```json
"supportsMetadataExtraction": {
    "$ref": "../connectionBasicType.json#/definitions/supportsMetadataExtraction"
},
"supportsLineageExtraction": {
    "$ref": "../connectionBasicType.json#/definitions/supportsLineageExtraction"
},
"supportsUsageExtraction": {
    "$ref": "../connectionBasicType.json#/definitions/supportsUsageExtraction"
},
"supportsProfiler": {
    "$ref": "../connectionBasicType.json#/definitions/supportsProfiler"
},
"supportsDBTExtraction": {
    "$ref": "../connectionBasicType.json#/definitions/supportsDBTExtraction"
},
"supportsDataDiff": {
    "$ref": "../connectionBasicType.json#/definitions/supportsDataDiff"
},
"supportsQueryComment": {
    "$ref": "../connectionBasicType.json#/definitions/supportsQueryComment"
}
```

## Capability → Generated Files

| Capability | Extra Files Generated |
|-----------|---------------------|
| `metadata` | `metadata.py`, `connection.py`, `service_spec.py` (always) |
| `lineage` | `lineage.py`, `query_parser.py`, `queries.py` |
| `usage` | `usage.py`, `query_parser.py`, `queries.py` |
| `profiler` | None extra — handled by `DefaultDatabaseSpec` |
| `stored_procedures` | None extra — handled by Inspector |
| `data_diff` | None extra — handled by `DefaultDatabaseSpec` |

## Capability → Test Connection Steps

| Capability | Extra Test Step |
|-----------|----------------|
| `lineage` or `usage` | `GetQueries` — verify query log access |
| `profiler` | No extra step (uses existing table access) |

## Capability → ServiceSpec Configuration

```python
# Full capabilities
ServiceSpec = DefaultDatabaseSpec(
    metadata_source_class=MyDbSource,
    lineage_source_class=MyDbLineageSource,      # If lineage
    usage_source_class=MyDbUsageSource,           # If usage
    connection_class=MyDbConnectionObj,           # If BaseConnection
    # profiler, sampler, test_suite, data_diff — included by DefaultDatabaseSpec
)

# Metadata only
ServiceSpec = DefaultDatabaseSpec(
    metadata_source_class=MyDbSource,
    connection_class=MyDbConnectionObj,
)
```
