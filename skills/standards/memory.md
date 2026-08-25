# Memory Management Standards

## The OOM Problem

Ingestion connectors run inside containers with fixed memory limits (typically 512MB-2GB). When a connector loads an entire file, API response, query result, or cache into memory without bounds, it causes the ingestion process to OOM-kill — losing all progress and producing no error message the user can act on.

**Memory leaks and unbounded loads are BLOCKERs.** A connector that works on a small test instance but OOMs on a production instance with large files or many entities is broken.

## Rule 1: Never Load Unbounded Data Into Memory

### Anti-Pattern: Full File Read (BLOCKER)

```python
# WRONG — loads entire file into memory, OOMs on large files
def read_metadata_file(self, path: str) -> dict:
    content = self.client.get_object(Bucket=self.bucket, Key=path)["Body"].read()
    return json.loads(content)

# WRONG — reads entire blob into memory
def read_config(self, path: str) -> dict:
    blob = self.client.get_bucket(self.bucket).get_blob(path)
    return json.loads(blob.download_as_string())
```

### Correct: Streaming Read With Size Guard

```python
MAX_METADATA_FILE_SIZE = 50 * 1024 * 1024  # 50 MB

def read_metadata_file(self, path: str) -> Optional[dict]:
    """Read a metadata/manifest file with size guard."""
    head = self.client.head_object(Bucket=self.bucket, Key=path)
    size = head["ContentLength"]
    if size > MAX_METADATA_FILE_SIZE:
        logger.warning(
            f"Skipping {path}: file size {size} exceeds limit "
            f"{MAX_METADATA_FILE_SIZE}"
        )
        return None
    response = self.client.get_object(Bucket=self.bucket, Key=path)
    return json.load(response["Body"])  # stream-parse, don't .read() first
```

Key points:
- Check file size BEFORE reading
- Use `json.load(stream)` instead of `json.loads(stream.read())` — parses from stream without buffering the full content
- Log a warning and skip, don't crash

### Correct: Chunked/Streaming for Data Files

```python
# Streaming JSON arrays with ijson (no full load)
import ijson

def read_records(self, stream) -> Iterable[dict]:
    for record in ijson.items(stream, "item"):
        yield record

# Chunked Parquet reading
def read_parquet(self, path: str) -> Iterable[pd.DataFrame]:
    pf = pq.ParquetFile(path)
    for batch in pf.iter_batches(batch_size=CHUNKSIZE):
        yield batch.to_pandas()

# Chunked CSV reading
def read_csv(self, path: str) -> Iterable[pd.DataFrame]:
    for chunk in pd.read_csv(path, chunksize=CHUNKSIZE):
        yield chunk
```

## Rule 2: Delete Large Objects After Use

Python's garbage collector doesn't immediately reclaim memory from large objects. After processing a large file, query result, or API response, explicitly `del` the reference and call `gc.collect()`.

### Anti-Pattern: Holding References (WARNING)

```python
# WRONG — raw_data stays in memory for the entire method
def process_entities(self):
    raw_data = self.client.fetch_all_entities()  # could be huge
    parsed = [parse(item) for item in raw_data]
    for entity in parsed:
        self.sink.write(entity)
    # raw_data and parsed still in memory until method returns
```

### Correct: Explicit Cleanup

```python
import gc

def process_entities(self):
    raw_data = self.client.fetch_all_entities()
    parsed = [parse(item) for item in raw_data]
    del raw_data  # free the raw response immediately
    gc.collect()

    for entity in parsed:
        self.sink.write(entity)
    del parsed
    gc.collect()
```

### Correct: Generator Pipeline (Preferred)

```python
# Best — never hold more than one entity in memory
def process_entities(self):
    for item in self.client.stream_entities():  # generator
        entity = parse(item)
        self.sink.write(entity)
```

## Rule 3: Bound All Caches

Any in-memory cache (dict, list, LRU cache) must have a size limit. Unbounded caches grow with the number of entities and eventually OOM on large instances.

### Anti-Pattern: Unbounded Cache (WARNING)

```python
# WRONG — grows without limit across all schemas/databases
class MyConnector:
    def __init__(self):
        self._constraint_cache = {}  # grows forever

    def get_constraints(self, table):
        if table not in self._constraint_cache:
            self._constraint_cache[table] = self._fetch_constraints(table)
        return self._constraint_cache[table]
```

### Correct: Bounded Cache With Eviction

```python
from functools import lru_cache

class MyConnector:
    @lru_cache(maxsize=1024)
    def get_constraints(self, table_fqn: str):
        return self._fetch_constraints(table_fqn)
```

### Correct: Scope-Limited Cache With Explicit Clearing

```python
class MyConnector:
    def __init__(self):
        self._schema_cache = {}

    def process_schema(self, schema_name):
        # Cache is valid only for current schema
        self._schema_cache.clear()
        # ... process tables in this schema using cache
```

This is the pattern used by BigQuery (`clear_constraint_cache_for_schema()`).

## Rule 4: Use Generators for Yield Methods

Source `yield_*` methods should use generators — not accumulate results in a list and return them. The framework processes entities one at a time, so holding all entities in memory is wasteful.

### Anti-Pattern: Accumulate Then Return (WARNING)

```python
# WRONG — holds all entities in memory before yielding any
def yield_dashboard(self, dashboard_details):
    results = []
    for chart in dashboard_details.charts:
        results.append(self._create_chart(chart))
    results.append(self._create_dashboard(dashboard_details))
    return results
```

### Correct: Yield Immediately

```python
def yield_dashboard(self, dashboard_details):
    for chart in dashboard_details.charts:
        yield Either(right=self._create_chart(chart))
    yield Either(right=self._create_dashboard(dashboard_details))
```

## Rule 5: Close Resources Explicitly

File handles, database cursors, HTTP responses, and SDK clients that hold resources must be closed after use. Relying on garbage collection to close them causes resource leaks under load.

### Anti-Pattern: Leaked Cursor (WARNING)

```python
# WRONG — cursor stays open, holds server-side resources
def get_tables(self):
    cursor = self.connection.execute(text("SELECT * FROM tables"))
    return cursor.fetchall()  # cursor never closed
```

### Correct: Context Manager or Explicit Close

```python
def get_tables(self):
    with self.connection.execute(text("SELECT * FROM tables")) as cursor:
        return cursor.fetchall()

# Or for streaming large results:
def stream_tables(self):
    cursor = self.connection.execute(text("SELECT * FROM tables"))
    try:
        while batch := cursor.fetchmany(1000):
            yield from batch
    finally:
        cursor.close()
```

## Rule 6: Stream Query Results

For profiler and usage/lineage query log processing, never call `.all()` on large result sets. Use `.fetchmany()` or `.yield_per()` to stream in chunks.

### Anti-Pattern: Fetch All Rows (BLOCKER for large tables)

```python
# WRONG — loads entire table sample into memory
def get_sample(self):
    result = self.session.execute(self.sample_query)
    return result.all()  # could be millions of rows
```

### Correct: Fetch in Batches

```python
def get_sample(self):
    result = self.session.execute(self.sample_query)
    while batch := result.fetchmany(1000):
        yield from batch
```

## Storage Connector Specifics

Storage connectors are the highest OOM risk because they read arbitrary user files. Apply extra care:

1. **Metadata/manifest files** (JSON configs): Check file size before reading. Most are small (<1MB) but don't assume.
2. **Data files** (Parquet, Avro, CSV, JSON): Always use streaming/chunked readers. The framework provides these in `metadata.readers.dataframe.*`.
3. **Schema inference**: Read only the first N rows to infer schema, not the entire file.
4. **Sample data**: Limit sample rows (use `CHUNKSIZE` constant) and convert only what's needed.

### Existing Framework Support

| Reader | File | Streaming Support |
|--------|------|------------------|
| Avro | `readers/dataframe/avro.py` | Yes — `fastavro.reader()` with chunked yield |
| Parquet | `readers/dataframe/parquet.py` | Yes — `iter_batches()` with fallback chain |
| CSV/DSV | `readers/dataframe/dsv.py` | Yes — `pd.read_csv(chunksize=CHUNKSIZE)` |
| JSON | `readers/dataframe/json.py` | Partial — `ijson` streaming with full-load fallback |

**Warning**: The JSON reader falls back to `decompressed.read()` when `ijson` fails. If you're implementing a connector that reads large JSON files, ensure `ijson` is available and handle the fallback path with a size check.

### File Readers (Raw Bytes)

The raw file readers in `metadata/readers/file/` all use `.read()` / `.readall()` / `.download_as_string()`:
- `s3.py` — `response["Body"].read()`
- `gcs.py` — `blob.download_as_string()`
- `adls.py` — `download_blob().readall()`
- `local.py` — `file.read()`

When calling these readers for data files (not small configs), pass the result through a streaming parser — don't hold the raw bytes AND the parsed result simultaneously.

## Constants

| Constant | Value | Location | Purpose |
|----------|-------|----------|---------|
| `CHUNKSIZE` | 200,000 | `metadata/utils/constants.py` | Standard batch size for streaming reads |
| `MAX_FILE_SIZE_FOR_PREVIEW` | 50 MB | `readers/dataframe/base.py` | File size threshold for preview mode |

## Review Checklist

When reviewing a connector for memory issues:

```
[ ] No .read() / .readall() on unbounded files without size check
[ ] Large objects (raw API responses, file contents) are del'd after processing
[ ] gc.collect() called after processing large batches
[ ] All caches have a size limit or are cleared between scopes (per-schema, per-database)
[ ] Yield methods use generators, not list accumulation
[ ] Database cursors and file handles are closed explicitly (context managers or finally blocks)
[ ] Query results use .fetchmany() or streaming, not .all() on large result sets
[ ] Storage connectors use framework streaming readers (avro, parquet, dsv), not raw .read()
[ ] JSON parsing uses json.load(stream) not json.loads(stream.read()) where possible
[ ] No unbounded list growth in loops (e.g., appending to a results list inside pagination)
```
