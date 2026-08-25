# Search Connector Standards

## Base Class
`SearchServiceSource` in `ingestion/src/metadata/ingestion/source/search/search_service.py`

## Reference Connector
`ingestion/src/metadata/ingestion/source/search/elasticsearch/`

## Entity Hierarchy
```
SearchService → SearchIndex → SearchIndexField
```

## Key Methods

| Method | Purpose |
|--------|---------|
| `yield_search_index(index_details)` | Create search index entity with field mappings |

## Schema Properties
- `hostPort` (required)
- Auth (basic or API key)
- `searchIndexFilterPattern`
- `supportsMetadataExtraction`
