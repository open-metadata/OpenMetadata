# Performance Standards

## The Silent Data Loss Problem

The most dangerous performance bug in connectors is **missing pagination**. When a REST API returns paginated results and the connector only fetches the first page, it silently ingests a subset of entities with no error or warning. Users see partial metadata and assume it's complete.

**This is a BLOCKER, not a suggestion.** Every list endpoint that can return more results than fit in one response MUST implement pagination.

## Pagination

### Rule: Every List Endpoint Must Paginate

Before implementing a client method that fetches a list of entities, check the API documentation for:
- `@odata.nextLink` (OData APIs like SSRS, SharePoint)
- `next_cursor` / `nextPage` / `next_token` (cursor-based APIs)
- `offset` + `limit` / `page` + `page_size` (offset-based APIs)
- `Link: <url>; rel="next"` headers (GitHub-style APIs)
- Response fields like `has_more`, `total_count`, `count`

If the API supports pagination, you MUST implement it. If unsure, assume it paginates.

### Anti-Pattern: Single-Page Fetch (BLOCKER)

```python
# WRONG — only gets first page, silently drops remaining entities
def get_reports(self) -> list[SsrsReport]:
    data = self._get("/Reports")
    return SsrsReportListResponse(**data).value

# WRONG — fetches all entities without any pagination handling
def get_dashboards(self) -> list:
    return self._get("/api/dashboards")["dashboards"]
```

### Correct: Offset-Based Pagination

```python
def get_reports(self) -> list[SsrsReport]:
    results = []
    offset = 0
    while True:
        data = self._get(f"/Reports?$skip={offset}&$top={self.PAGE_SIZE}")
        page = SsrsReportListResponse(**data).value
        results.extend(page)
        if len(page) < self.PAGE_SIZE:
            break
        offset += self.PAGE_SIZE
    return results
```

### Correct: Cursor/Link-Based Pagination

```python
def get_reports(self) -> list[SsrsReport]:
    results = []
    path = "/Reports"
    while path:
        data = self._get(path)
        results.extend(SsrsReportListResponse(**data).value)
        next_link = data.get("@odata.nextLink")
        path = next_link.replace(self.base_url, "") if next_link else None
    return results
```

### Correct: Generator-Based Pagination (Preferred)

When the caller doesn't need all results at once, use a generator:

```python
def _paginate(self, endpoint: str):
    """Yield items one page at a time."""
    offset = 0
    while True:
        data = self._get(endpoint, params={"offset": offset, "limit": self.PAGE_SIZE})
        items = data.get("data", [])
        if not items:
            break
        yield from items
        if len(items) < self.PAGE_SIZE:
            break
        offset += len(items)
```

### Verification Checklist

For every `client.py` method that returns a list:

```
[ ] Does the API documentation say this endpoint paginates?
[ ] If yes, does the method follow pagination links / increment offset?
[ ] Does it stop when: empty page, page < page_size, or no next link?
[ ] On large instances (1000+ entities), will this return ALL entities?
```

## Lookup Complexity

### Rule: Pre-Build Dicts for Repeated Lookups

When you need to look up entities by ID, path, or name during iteration, build a dictionary ONCE and use O(1) lookups — don't iterate a list every time.

### Anti-Pattern: O(n*m) Iteration Lookup (WARNING)

```python
# WRONG — for each dashboard (m), iterates all folders (n) → O(n*m)
def get_project_name(self, dashboard_details):
    parts = dashboard_details.path.split("/")
    folder_path = f"/{parts[1]}" if len(parts) > 1 else None
    if folder_path:
        for folder in self.folders:       # O(n) per call
            if folder.path == folder_path:
                return folder.name
    return None
```

### Correct: Dict Lookup (O(1) per call)

```python
# Build dict once in prepare()
def prepare(self):
    super().prepare()
    self.folders = self.client.get_folders()
    self._folder_by_path = {f.path: f for f in self.folders}

# O(1) lookup
def get_project_name(self, dashboard_details):
    parts = dashboard_details.path.split("/")
    folder_path = f"/{parts[1]}" if len(parts) > 1 else None
    folder = self._folder_by_path.get(folder_path)
    return folder.name if folder else None
```

### When This Matters

This pattern applies whenever you:
- Look up a parent entity for each child entity (folders for reports, projects for dashboards)
- Map IDs to names during iteration
- Resolve references between entity types

The impact scales with entity count: 100 folders × 500 reports = 50,000 iterations vs 500 dict lookups.

## Connection Reuse

- SQLAlchemy: The `BaseConnection` class handles connection caching automatically
- REST clients: Create one `requests.Session()` and reuse it for all requests
- SDK clients: Initialize once in `get_connection()`, not per-entity

### Anti-Pattern: Per-Request Sessions

```python
# WRONG — creates new session per request
def _get(self, endpoint):
    response = requests.get(f"{self.base_url}{endpoint}")
    return response.json()
```

### Correct: Shared Session

```python
def __init__(self, config):
    self._session = requests.Session()
    self._session.headers["Authorization"] = f"Bearer {config.token.get_secret_value()}"

def _get(self, endpoint):
    response = self._session.get(f"{self.base_url}{endpoint}")
    response.raise_for_status()
    return response.json()
```

## Batch Operations

When fetching details for each entity, prefer batch endpoints if available:

```python
# Prefer batch fetch
details = self.client.get_dashboards_batch(ids=[d.id for d in dashboards])

# Over individual fetches (N+1 problem)
for dashboard in dashboards:
    detail = self.client.get_dashboard(dashboard.id)
```

## Rate Limiting

For REST APIs with rate limits, implement retry with backoff in the client:

```python
from tenacity import retry, stop_after_attempt, wait_exponential

@retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=1, max=30))
def _get(self, endpoint):
    response = self._session.get(f"{self._base_url}{endpoint}")
    if response.status_code == 429:
        retry_after = int(response.headers.get("Retry-After", 30))
        logger.warning(f"Rate limited, retrying after {retry_after}s")
        raise RateLimitError(retry_after)
    response.raise_for_status()
    return response.json()
```

## Lazy Loading

Only fetch entity details when needed. The framework applies filter patterns between `get_dashboards_list()` and `get_dashboard_details()`, so filtered entities never trigger detail fetches:

```python
def get_dashboard_details(self, dashboard):
    """Called only for dashboards that pass filters."""
    return self.client.get_dashboard(dashboard.id)
```

## Memory

See `memory.md` for the full memory management standard. Key rules:

- Never `.read()` an entire file without a size check — OOMs on large files
- `del` large objects and call `gc.collect()` after processing
- Bound all caches with `lru_cache(maxsize=)` or clear between scopes
- Use generators in yield methods, not list accumulation
- Stream query results with `.fetchmany()`, never `.all()` on large tables
- Close cursors and file handles explicitly (context managers or `finally`)
- Use `json.load(stream)` instead of `json.loads(stream.read())`
- Storage connectors: use framework streaming readers (avro, parquet, dsv)

## Empty Test Stubs

Test files with empty `pass` bodies are a performance anti-pattern for the project. They:
- Give false confidence (100% of tests "pass")
- Mask missing coverage
- Signal that the author didn't validate the connector works

```python
# WRONG — gives false confidence
def test_metadata_ingestion(self):
    pass

# If you can't write the test yet, don't create the file.
# If you must create a placeholder, mark it:
@pytest.mark.skip(reason="Requires SSRS instance - TODO")
def test_metadata_ingestion(self):
    ...
```

## Review Checklist

When reviewing a connector for performance issues, verify:

```
[ ] Every client method that returns a list implements pagination
[ ] No list endpoint fetches only the first page without warning
[ ] Lookups inside loops use dicts, not list iteration
[ ] REST client uses a shared requests.Session
[ ] No N+1 API calls (batch where API supports it)
[ ] Test files have real assertions, not empty pass stubs
[ ] Generator-based pagination used where possible
[ ] No unbounded .read() on files without size checks (see memory.md)
[ ] Large objects del'd after use, gc.collect() called between batches
[ ] Caches bounded or cleared between scopes
```
