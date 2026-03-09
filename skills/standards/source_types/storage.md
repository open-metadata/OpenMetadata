# Storage Connector Standards

## Base Class
`StorageServiceSource` in `ingestion/src/metadata/ingestion/source/storage/storage_service.py`

## Reference Connector
`ingestion/src/metadata/ingestion/source/storage/s3/`

## Entity Hierarchy
```
StorageService → Container (recursive: containers can nest)
```

## Key Methods

| Method | Purpose |
|--------|---------|
| `yield_create_container_requests(container)` | Create container entities (buckets, folders) |

## Schema Properties
- Cloud provider credentials (AWS, GCS, Azure)
- `containerFilterPattern`
- `supportsMetadataExtraction`
