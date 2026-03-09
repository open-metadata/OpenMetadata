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

## Memory Management (Critical)

Storage connectors are the **highest OOM risk** because they read arbitrary user files. See `memory.md` for the full standard. Key rules:

### File Reading
- **Never** call `.read()` / `.readall()` / `.download_as_string()` on data files without a size check
- Metadata/manifest files (JSON configs) are usually small but check size before reading anyway
- Data files (Parquet, Avro, CSV, JSON) **must** use streaming/chunked readers

### Framework Readers
Use the framework's streaming readers in `metadata/readers/dataframe/`:

| Format | Reader | Streaming |
|--------|--------|-----------|
| Avro | `readers/dataframe/avro.py` | Yes — `fastavro.reader()` + chunked yield |
| Parquet | `readers/dataframe/parquet.py` | Yes — `iter_batches()` with fallback chain |
| CSV/DSV | `readers/dataframe/dsv.py` | Yes — `pd.read_csv(chunksize=CHUNKSIZE)` |
| JSON | `readers/dataframe/json.py` | Partial — `ijson` streaming, full-load fallback |

### Anti-Pattern: Raw File Read (BLOCKER)

```python
# WRONG — loads entire file into memory
content = self.client.get_object(Bucket=bucket, Key=path)["Body"].read()
data = json.loads(content)  # content + data both in memory

# CORRECT — stream-parse without buffering
response = self.client.get_object(Bucket=bucket, Key=path)
data = json.load(response["Body"])  # parse from stream
```

### Schema Inference
- Read only the first N rows (use `CHUNKSIZE` constant) to infer schema
- Do not load the entire file for schema detection

### Sample Data
- Limit sample rows and convert only what's needed
- `del` large DataFrames after extracting sample data, call `gc.collect()`
