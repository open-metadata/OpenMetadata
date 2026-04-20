# API Connector Standards

## Base Class
`ApiServiceSource` in `ingestion/src/metadata/ingestion/source/api/api_service.py`

## Reference Connector
`ingestion/src/metadata/ingestion/source/api/rest/`

## Entity Hierarchy
```
ApiService → ApiCollection → ApiEndpoint
```

## Key Methods

| Method | Purpose |
|--------|---------|
| `yield_api_collection(collection)` | Create API collection entity |
| `yield_api_endpoint(endpoint)` | Create API endpoint entity |

## Schema Properties
- `openAPISchemaURL` or `hostPort`
- Auth (token or basic)
- `apiCollectionFilterPattern`
- `supportsMetadataExtraction`
